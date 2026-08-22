import { z } from "zod";
import { permissionKeys } from "./permissions";

export const employeeCreateSchema = z
  .object({
    /**
     * Optional: derived from the name when omitted. Only a company that numbers
     * its staff has an answer here, and requiring one invited job titles into a
     * unique key. See `@/lib/employee-id`.
     */
    employeeId: z.string().trim().min(1).max(50).optional(),
    fullName: z.string().trim().min(2).max(120),
    email: z.email().max(254),
    phone: z.string().trim().max(30).optional().default(""),
    role: z.enum(["dispatcher", "driver", "office", "management"]),
    accessRole: z.enum(["admin", "dispatcher", "driver"]),
    /**
     * How the employee first gets in. `temporary_password` sends no email at
     * all, so onboarding works before SMTP is configured and for staff who do
     * not read email during the working day. It is the default because it is
     * the mode that works in every deployment; an invitation depends on SMTP
     * being connected and is rejected outright when it is not.
     */
    delivery: z
      .enum(["invitation", "temporary_password"])
      .optional()
      .default("temporary_password"),
  })
  .strict()
  .refine(
    (input) =>
      (input.role === "driver") === (input.accessRole === "driver") &&
      (input.role !== "management" || input.accessRole === "admin"),
    { message: "Operational role and access role are incompatible." },
  );

export const employeePatchSchema = z
  .object({
    status: z.enum(["active", "inactive"]).optional(),
    accessRole: z.enum(["admin", "dispatcher", "driver"]).optional(),
    permissionOverrides: z
      .record(z.enum(permissionKeys), z.boolean())
      .optional(),
    employeeId: z.string().trim().min(1).max(50).optional(),
    fullName: z.string().trim().min(2).max(120).optional(),
    email: z.email().max(254).optional(),
    phone: z.string().trim().max(30).optional(),
    role: z.enum(["dispatcher", "driver", "office", "management"]).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "No supported changes supplied.",
  });

export const exportQuerySchema = z
  .object({
    from: z.iso.date().default("0000-01-01"),
    to: z.iso.date().default("9999-12-31"),
  })
  .refine((range) => range.from <= range.to, {
    message: "The From date must not be after the Through date.",
  });

export function jsonBodySizeAllowed(request: Request, maximumBytes = 32_768) {
  const length = Number(request.headers.get("content-length") ?? 0);
  return Number.isFinite(length) && length <= maximumBytes;
}
