import { z } from "zod";

const lineItem = z.object({
  description: z.string().trim().min(1).max(500),
  amountCents: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).refine((amount) => amount !== 0, "Line-item amount cannot be zero."),
  jobId: z.string().trim().min(1).nullable().optional(),
  category: z.enum([
    "service",
    "rental",
    "tonnage",
    "fee",
    "surcharge",
    "adjustment",
  ]),
});

/**
 * Billing details typed on the invoice. Blank fields are allowed on a draft;
 * sending is what requires a complete contact and address.
 */
const invoiceBillingSchema = z.object({
  contactName: z.string().trim().max(200),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(320)
    .refine((value) => value === "" || /^\S+@\S+\.\S+$/.test(value), "Enter a valid billing email."),
  phone: z.string().trim().max(40),
  addressLine1: z.string().trim().max(200),
  addressLine2: z.string().trim().max(200),
  city: z.string().trim().max(120),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === "" || /^[A-Z]{2}$/.test(value), "Use a two-letter state, like NV."),
  postalCode: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{5}(-\d{4})?$/.test(value), "Enter a 5-digit ZIP code."),
});

export const invoiceDraftSchema = z
  .object({
    // Empty when the office typed a name that matches no customer yet.
    customerId: z.string().trim(),
    customerName: z.string().trim().max(200).optional(),
    billing: invoiceBillingSchema.optional(),
    saveBillingToCustomer: z.boolean().optional(),
    chargeSalesTax: z.boolean().optional(),
    billingMode: z.enum(["per_job", "statement", "one_off"]),
    // Emptiness is decided per billing mode below, not here.
    jobIds: z.array(z.string().trim().min(1)).max(100),
    paymentTerms: z.enum(["due_on_receipt", "net_15", "net_30"]),
    poNumber: z.string().trim().max(140),
    notes: z.string().trim().max(500),
    items: z.array(lineItem).min(1).max(100),
  })
  .superRefine((value, context) => {
    if (!value.customerId && !value.customerName)
      context.addIssue({
        code: "custom",
        path: ["customerId"],
        message: "Pick a customer or type a new name.",
      });
    if (value.billingMode === "per_job" && value.jobIds.length !== 1)
      context.addIssue({
        code: "custom",
        path: ["jobIds"],
        message: "Per-job invoices require exactly one completed job.",
      });
    if (value.billingMode === "statement" && value.jobIds.length < 1)
      context.addIssue({
        code: "custom",
        path: ["jobIds"],
        message: "A statement requires at least one completed job.",
      });
    // A one-off must carry none, so a statement cannot become jobless simply by
    // having its selections dropped.
    if (value.billingMode === "one_off" && value.jobIds.length !== 0)
      context.addIssue({
        code: "custom",
        path: ["jobIds"],
        message: "A one-off invoice carries no jobs.",
      });
    if (new Set(value.jobIds).size !== value.jobIds.length)
      context.addIssue({
        code: "custom",
        path: ["jobIds"],
        message: "A job can appear only once on an invoice.",
      });
    const jobs = new Set(value.jobIds);
    value.items.forEach((item, index) => {
      if (item.jobId && !jobs.has(item.jobId))
        context.addIssue({
          code: "custom",
          path: ["items", index, "jobId"],
          message: "Line-item jobs must be attached to the invoice.",
        });
    });
    const total = value.items.reduce((sum, item) => sum + item.amountCents, 0);
    if (!Number.isSafeInteger(total) || total <= 0)
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Invoice total must be a positive, safe integer amount.",
      });
  });

export function invoiceValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invoice details are invalid.";
}
