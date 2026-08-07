import {
  apiFailure,
  apiSuccess,
  logRequest,
  requestId,
} from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { isOwnerEmail } from "@/lib/owners";
import { createAdminClient } from "@/lib/supabase/admin";
import { employeePatchSchema, jsonBodySizeAllowed } from "@/lib/validation";

const route = "/api/admin/employees/[id]";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const requestIdValue = requestId(request);
  const fail = (code: string, message: string, status: number) => {
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
    .select("id,email,role,status,access_role,auth_user_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing.data)
    return fail("employee_not_found", "Employee not found.", 404);
  if (isOwnerEmail(existing.data.email)) {
    const ownerAccessChange =
      (input.accessRole && input.accessRole !== "admin") ||
      input.status === "inactive" ||
      Boolean(
        input.permissionOverrides &&
          Object.keys(input.permissionOverrides).length,
      );
    if (ownerAccessChange)
      return fail(
        "owner_protected",
        "Owner profiles must retain active full administrator access.",
        400,
      );
  }
  const demotesAdmin =
    existing.data.access_role === "admin" &&
    input.accessRole &&
    input.accessRole !== "admin";
  const deactivatesAdmin =
    existing.data.access_role === "admin" && input.status === "inactive";
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
  if (input.accessRole === "driver") changes.role = "driver";
  else if (existing.data.role === "driver" && input.accessRole)
    changes.role = "dispatcher";
  let authChanged = false;
  if (existing.data.auth_user_id && input.status) {
    const banDuration = input.status === "inactive" ? "876000h" : "none";
    const authUpdate = await admin.auth.admin.updateUserById(
      existing.data.auth_user_id,
      { ban_duration: banDuration },
    );
    if (authUpdate.error)
      return fail(
        "auth_update_failed",
        "Authentication access could not be updated.",
        502,
      );
    authChanged = true;
  }
  const result = await admin
    .from("users")
    .update(changes)
    .eq("id", id)
    .select()
    .single();
  if (result.error) {
    if (authChanged && existing.data.auth_user_id) {
      const rollback = existing.data.status === "inactive" ? "876000h" : "none";
      await createAdminClient().auth.admin.updateUserById(
        existing.data.auth_user_id,
        { ban_duration: rollback },
      );
    }
    return fail(
      "profile_update_failed",
      "The employee profile could not be updated and authentication changes were rolled back.",
      400,
    );
  }
  await access.client.rpc("audit_admin_action", {
    target_user_id: id,
    admin_action: input.status
      ? `status_${input.status}`
      : input.accessRole
        ? "access_role_changed"
        : "permissions_changed",
  });
  logRequest("info", "admin_employee_updated", {
    requestId: requestIdValue,
    route,
    method: "PATCH",
    startedAt,
    status: 200,
  });
  return apiSuccess({ id: result.data.id }, requestIdValue);
}
