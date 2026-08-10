import {
  apiFailure,
  apiSuccess,
  logRequest,
  requestId,
} from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { employeeCreateSchema, jsonBodySizeAllowed } from "@/lib/validation";

const route = "/api/admin/employees";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const id = requestId(request);
  const fail = (code: string, message: string, status: number) => {
    logRequest(
      status >= 500 ? "error" : "warn",
      "admin_employee_create_failed",
      { requestId: id, route, method: "POST", startedAt, status, code },
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
  const limited = await access.client.rpc("consume_api_rate_limit", {
    rate_bucket: "admin:employee:create",
    maximum_attempts: 10,
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
  const parsed = employeeCreateSchema.safeParse(raw);
  if (!parsed.success)
    return fail(
      "invalid_employee",
      parsed.error.issues[0]?.message ?? "Employee details are invalid.",
      400,
    );
  const input = parsed.data;
  const admin = createAdminClient();
  const initials = input.fullName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const profile = await admin
    .from("users")
    .insert({
      employee_id: input.employeeId,
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
  if (profile.error)
    return fail(
      "employee_conflict",
      "An employee with those details already exists.",
      409,
    );
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
