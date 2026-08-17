import {
  apiFailure,
  apiSuccess,
  logRequest,
  requestId,
} from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { employeeCreateSchema, jsonBodySizeAllowed } from "@/lib/validation";
import { generateTemporaryPassword } from "@/lib/temporary-password";
import { emailDeliveryEnabled } from "@/lib/email-delivery";
import { findAuthUserIdByEmail } from "@/lib/supabase/auth-users";
import {
  employeeWriteFailure,
  writeErrorDetail,
} from "@/lib/employee-conflicts";
import {
  deriveEmployeeId,
  nextAvailableEmployeeId,
} from "@/lib/employee-id";

const route = "/api/admin/employees";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const id = requestId(request);
  const fail = (
    code: string,
    message: string,
    status: number,
    detail?: Record<string, unknown>,
  ) => {
    logRequest(
      status >= 500 ? "error" : "warn",
      "admin_employee_create_failed",
      { requestId: id, route, method: "POST", startedAt, status, code, detail },
    );
    return apiFailure(code, message, status, id);
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
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail("invalid_json", "Invalid JSON body.", 400);
  }
  const parsed = employeeCreateSchema.safeParse(raw);
  if (!parsed.success)
    return fail(
      "invalid_employee",
      parsed.error.issues[0]?.message ?? "Employee details are invalid.",
      400,
    );
  const input = parsed.data;
  // Refused before anything is written. Supabase accepts `inviteUserByEmail`
  // without SMTP but never delivers it, and the old behaviour was to create the
  // profile, watch the send fail, then delete the profile again — leaving the
  // administrator with an error code and no employee. The modal hides this
  // option entirely; this covers a stale page or a direct call.
  if (input.delivery === "invitation" && !emailDeliveryEnabled())
    return fail(
      "email_delivery_disabled",
      "Email sending is not configured, so an invitation cannot be delivered. Create the employee with a temporary password instead.",
      409,
    );
  const admin = createAdminClient();
  const initials = input.fullName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  // Assigned here rather than in the browser because only this side can see
  // soft-deleted employees, who keep their ID while appearing on no screen an
  // administrator can reach.
  const assignEmployeeId = async () => {
    const base = deriveEmployeeId(input.fullName);
    const siblings = await admin
      .from("users")
      .select("employee_id")
      .ilike("employee_id", `${base}%`);
    if (siblings.error) return null;
    return nextAvailableEmployeeId(
      base,
      siblings.data.map((row) => row.employee_id),
    );
  };
  const insertProfile = (employeeId: string) =>
    admin
      .from("users")
      .insert({
        employee_id: employeeId,
        full_name: input.fullName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        role: input.role,
        access_role: input.accessRole,
        initials,
        status: "active",
        permission_overrides: {},
      })
      .select()
      .single();
  const firstId = input.employeeId ?? (await assignEmployeeId());
  if (!firstId)
    return fail(
      "employee_id_unavailable",
      "An Employee ID could not be assigned. Try again.",
      503,
    );
  let profile = await insertProfile(firstId);
  // Two administrators adding staff in the same moment can be handed the same
  // derived ID. Only a generated one is retried — a typed ID that collides is
  // the administrator's to resolve, and quietly changing it would be worse.
  const lostTheRace = () =>
    !input.employeeId &&
    employeeWriteFailure(profile.error)?.code === "employee_id_taken";
  for (let attempt = 0; attempt < 3 && lostTheRace(); attempt += 1) {
    const retryId = await assignEmployeeId();
    if (!retryId) break;
    profile = await insertProfile(retryId);
  }
  // Every rejected insert used to be reported as a duplicate, which named
  // neither the field that collided nor the possibility that the row holding it
  // was removed and is no longer on screen. The cause is also logged, so a
  // reported reference ID can be answered.
  if (profile.error) {
    const conflict = employeeWriteFailure(profile.error, {
      employeeId: input.employeeId,
    });
    const detail = writeErrorDetail(profile.error);
    // A generated ID that survives the retries is our problem, not something to
    // hand back as though the administrator had chosen it.
    if (!input.employeeId && conflict?.code === "employee_id_taken")
      return fail(
        "employee_id_unavailable",
        "An Employee ID could not be assigned. Try again.",
        503,
        detail,
      );
    return conflict
      ? fail(conflict.code, conflict.message, conflict.status, detail)
      : fail(
          "profile_create_failed",
          "The employee could not be created.",
          500,
          detail,
        );
  }
  // Checked here rather than at the top of the request: this is the first
  // point a request has actually done something — a real profile row now
  // exists. Counting invalid JSON, failed validation, or a rejected duplicate
  // against the budget meant an administrator fixing a typo could exhaust it
  // before creating anyone, which is what happened when two owners were both
  // typed in as Employee ID "Owner." The budget still limits the same thing
  // it always did: how many employee accounts can be minted per hour.
  const limited = await access.client.rpc("consume_api_rate_limit", {
    rate_bucket: "admin:employee:create",
    maximum_attempts: 10,
    window_seconds: 3600,
  });
  if (limited.error || !limited.data) {
    await admin.from("users").delete().eq("id", profile.data.id);
    return limited.error
      ? fail(
          "rate_limit_unavailable",
          "The request could not be safely processed.",
          503,
        )
      : fail(
          "rate_limited",
          "Too many employees created this hour. Try again later.",
          429,
        );
  }
  // The profile is created first in both paths. `link_auth_user` attaches the
  // Auth account to it by email on insert, so the account lands linked either
  // way. If the Auth step fails the profile is rolled back so a half-created
  // employee never lingers.
  if (input.delivery === "temporary_password") {
    const email = input.email.toLowerCase();
    const temporaryPassword = generateTemporaryPassword();
    // An earlier attempt can leave an Auth account with no profile behind it —
    // a failed invitation, or an employee deleted and re-added. `createUser`
    // rejects those as duplicates, which used to strand the administrator on
    // "the account could not be created" with no way forward, so an orphan is
    // adopted and given the new password instead.
    const existing = await findAuthUserIdByEmail(admin.auth.admin, email);
    if (!existing.ok) {
      await admin.from("users").delete().eq("id", profile.data.id);
      return fail(
        "account_lookup_failed",
        "The employee profile was rolled back because existing accounts could not be checked.",
        502,
      );
    }
    const created = existing.id
      ? await admin.auth.admin.updateUserById(existing.id, {
          password: temporaryPassword,
          email_confirm: true,
        })
      : await admin.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: { full_name: input.fullName },
        });
    if (created.error) {
      await admin.from("users").delete().eq("id", profile.data.id);
      return fail(
        "account_failed",
        "The employee profile was rolled back because the account could not be created.",
        502,
      );
    }
    // `link_auth_user` only fires when an Auth row is inserted, so an adopted
    // account has to be attached to the profile here. An unchecked failure here
    // would hand over a working password for an account that reaches no
    // profile, so it is rolled back rather than reported as success.
    if (existing.id) {
      const linked = await admin
        .from("users")
        .update({ auth_user_id: existing.id })
        .eq("id", profile.data.id);
      if (linked.error) {
        await admin.from("users").delete().eq("id", profile.data.id);
        return fail(
          "account_link_failed",
          "The employee profile was rolled back because an existing account for that email could not be attached to it.",
          502,
        );
      }
    }
    await access.client.rpc("audit_admin_action", {
      target_user_id: profile.data.id,
      admin_action: "temporary_password_issued",
    });
    logRequest("info", "admin_employee_created", {
      requestId: id,
      route,
      method: "POST",
      startedAt,
      status: 201,
    });
    // Returned once and never stored in plaintext. The administrator hands it
    // to the employee, who replaces it from Change Password.
    return apiSuccess({ id: profile.data.id, temporaryPassword }, id, 201);
  }

  const invite = await admin.auth.admin.inviteUserByEmail(
    input.email.toLowerCase(),
    { data: { full_name: input.fullName } },
  );
  if (invite.error) {
    await admin.from("users").delete().eq("id", profile.data.id);
    return fail(
      "invite_failed",
      "The employee profile was rolled back because the invitation could not be sent.",
      502,
    );
  }
  await access.client.rpc("audit_admin_action", {
    target_user_id: profile.data.id,
    admin_action: "invite_created",
  });
  logRequest("info", "admin_employee_created", {
    requestId: id,
    route,
    method: "POST",
    startedAt,
    status: 201,
  });
  return apiSuccess({ id: profile.data.id }, id, 201);
}
