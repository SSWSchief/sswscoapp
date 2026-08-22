import {
  apiFailure,
  apiSuccess,
  logRequest,
  requestId,
} from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { employeePatchSchema, jsonBodySizeAllowed } from "@/lib/validation";
import {
  employeeConflictMessage,
  isIncompatibleRole,
  uniqueViolationField,
  writeErrorDetail,
} from "@/lib/employee-conflict";

const route = "/api/admin/employees/[id]";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const requestIdValue = requestId(request);
  const fail = (
    code: string,
    message: string,
    status: number,
    detail?: Record<string, unknown>,
  ) => {
    logRequest(
      status >= 500 ? "error" : "warn",
      "admin_employee_update_failed",
      {
        requestId: requestIdValue,
        route,
        method: "PATCH",
        startedAt,
        status,
        code,
        detail,
      },
    );
    return apiFailure(code, message, status, requestIdValue);
  };
  if (!jsonBodySizeAllowed(request))
    return fail("payload_too_large", "Request body is too large.", 413);
  const access = await requireAdmin();
  if (!access.ok)
    return fail(
      access.status === 401 ? "unauthorized" : "forbidden",
      access.error,
      access.status,
    );
  const limited = await access.client.rpc("consume_api_rate_limit", {
    rate_bucket: "admin:employee:update",
    maximum_attempts: 60,
    window_seconds: 3600,
  });
  if (limited.error)
    return fail(
      "rate_limit_unavailable",
      "The request could not be safely processed.",
      503,
    );
  if (!limited.data)
    return fail(
      "rate_limited",
      "Too many employee changes. Try again later.",
      429,
    );
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail("invalid_json", "Invalid JSON body.", 400);
  }
  const parsed = employeePatchSchema.safeParse(raw);
  if (!parsed.success)
    return fail(
      "invalid_employee_update",
      parsed.error.issues[0]?.message ?? "Employee changes are invalid.",
      400,
    );
  const input = parsed.data;
  const admin = createAdminClient();
  const { id } = await params;
  const existing = await admin
    .from("users")
    .select(
      "id,employee_id,full_name,email,phone,role,status,access_role,auth_user_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!existing.data)
    return fail("employee_not_found", "Employee not found.", 404);
  const record = existing.data;
  const newEmail = input.email?.toLowerCase();
  const emailChanged = Boolean(newEmail && newEmail !== record.email);
  const protectedAdministrator = await admin
    .from("protected_administrators")
    .select("user_id,expires_at")
    .eq("user_id", id)
    .maybeSingle();
  if (protectedAdministrator.error)
    return fail(
      "administrator_protection_unavailable",
      "Administrator protections could not be verified.",
      503,
    );
  const protectionIsActive =
    protectedAdministrator.data &&
    (!protectedAdministrator.data.expires_at ||
      Date.parse(protectedAdministrator.data.expires_at) > Date.now());
  if (protectionIsActive) {
    const ownerAccessChange =
      (input.accessRole && input.accessRole !== "admin") ||
      input.status === "inactive" ||
      Boolean(
        input.permissionOverrides &&
          Object.keys(input.permissionOverrides).length,
      ) ||
      Boolean(input.role && input.role !== "management") ||
      emailChanged;
    if (ownerAccessChange)
      return fail(
        "administrator_protected",
        "Protected administrators must retain their full administrator access, role, and email address.",
        400,
      );
  }
  const demotesAdmin =
    record.access_role === "admin" &&
    input.accessRole &&
    input.accessRole !== "admin";
  const deactivatesAdmin =
    record.access_role === "admin" && input.status === "inactive";
  if (demotesAdmin || deactivatesAdmin) {
    const admins = await admin
      .from("users")
      .select("id")
      .eq("access_role", "admin")
      .eq("status", "active")
      .is("deleted_at", null);
    if ((admins.data?.length ?? 0) <= 1)
      return fail(
        "last_admin",
        "At least one active administrator is required.",
        400,
      );
  }
  const changes: Record<string, unknown> = {};
  if (input.status) changes.status = input.status;
  if (input.accessRole) {
    changes.access_role = input.accessRole;
    changes.permission_overrides = {};
  }
  if (input.permissionOverrides)
    changes.permission_overrides = input.permissionOverrides;
  if (input.employeeId) changes.employee_id = input.employeeId;
  if (input.fullName) changes.full_name = input.fullName;
  if (input.phone !== undefined) changes.phone = input.phone;
  if (input.role) changes.role = input.role;
  else if (input.accessRole === "driver") changes.role = "driver";
  else if (record.role === "driver" && input.accessRole)
    changes.role = "dispatcher";
  const finalAccessRole =
    (changes.access_role as string | undefined) ?? record.access_role;
  const finalRole = (changes.role as string | undefined) ?? record.role;
  if (
    (finalRole === "driver") !== (finalAccessRole === "driver") ||
    (finalRole === "management" && finalAccessRole !== "admin")
  )
    return fail(
      "incompatible_role",
      "Operational role and access role are incompatible.",
      400,
    );
  // Rolled back in reverse if the profile write below fails, so a partial
  // auth-side change never survives a rejected employee update.
  const rollbacks: Array<() => Promise<void>> = [];
  if (record.auth_user_id && input.status) {
    const banDuration = input.status === "inactive" ? "876000h" : "none";
    const authUpdate = await admin.auth.admin.updateUserById(
      record.auth_user_id,
      { ban_duration: banDuration },
    );
    if (authUpdate.error)
      return fail(
        "auth_update_failed",
        "Authentication access could not be updated.",
        502,
      );
    const priorBan = record.status === "inactive" ? "876000h" : "none";
    rollbacks.push(async () => {
      await admin.auth.admin.updateUserById(record.auth_user_id!, {
        ban_duration: priorBan,
      });
    });
  }
  if (emailChanged) {
    changes.email = newEmail;
    if (record.auth_user_id) {
      const authEmailUpdate = await admin.auth.admin.updateUserById(
        record.auth_user_id,
        { email: newEmail, email_confirm: true },
      );
      if (authEmailUpdate.error) {
        for (const rollback of rollbacks.reverse()) await rollback();
        return fail(
          "email_taken",
          "That email address is already in use by another account.",
          409,
        );
      }
      const priorEmail = record.email;
      rollbacks.push(async () => {
        await admin.auth.admin.updateUserById(record.auth_user_id!, {
          email: priorEmail,
          email_confirm: true,
        });
      });
    }
  }
  const result = await admin
    .from("users")
    .update(changes)
    .eq("id", id)
    .select()
    .single();
  if (result.error) {
    for (const rollback of rollbacks.reverse()) await rollback();
    // Same reasoning as the create route: name the field that collided and the
    // employee holding it, including the removed records that hold a value
    // while appearing in no list. The cause is logged either way, so a reported
    // reference ID can be answered.
    const detail = writeErrorDetail(result.error);
    if (isIncompatibleRole(result.error))
      return fail(
        "incompatible_role",
        "That operational role and access role cannot be combined. Choose a different access role.",
        400,
        detail,
      );
    const field = uniqueViolationField(result.error);
    const value = field === "employee_id" ? input.employeeId : newEmail;
    if (field && value) {
      const holder = await admin
        .from("users")
        .select("full_name,status,deleted_at")
        .eq(field, value)
        .neq("id", id)
        .limit(1)
        .maybeSingle();
      return fail(
        field === "employee_id" ? "employee_id_taken" : "email_taken",
        employeeConflictMessage(
          field,
          value,
          holder.data
            ? {
                fullName: holder.data.full_name,
                removed: Boolean(holder.data.deleted_at),
                inactive: holder.data.status === "inactive",
              }
            : null,
        ),
        409,
        detail,
      );
    }
    return fail(
      "profile_update_failed",
      "The employee profile could not be updated and authentication changes were rolled back.",
      400,
      detail,
    );
  }
  const auditActions = [
    input.status ? `status_${input.status}` : null,
    input.accessRole ? "access_role_changed" : null,
    input.permissionOverrides ? "permissions_changed" : null,
    input.role ? "role_changed" : null,
    emailChanged ? "email_changed" : null,
    input.fullName ? "name_changed" : null,
    input.phone !== undefined ? "phone_changed" : null,
    input.employeeId ? "employee_id_changed" : null,
  ].filter((action): action is string => action !== null);
  for (const admin_action of auditActions) {
    await access.client.rpc("audit_admin_action", {
      target_user_id: id,
      admin_action,
    });
  }
  logRequest("info", "admin_employee_updated", {
    requestId: requestIdValue,
    route,
    method: "PATCH",
    startedAt,
    status: 200,
  });
  return apiSuccess({ id: result.data.id }, requestIdValue);
}
