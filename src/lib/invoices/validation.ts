import { z } from "zod";
import { lineDescriptionProblem } from "./line-catalog";

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

export const invoiceDraftSchema = z
  .object({
    customerId: z.string().trim().min(1),
    billingMode: z.enum(["per_job", "statement", "one_off"]),
    // A one-off charge has no job behind it, so the floor is zero and the
    // per-mode rules below decide what each mode actually requires.
    jobIds: z.array(z.string().trim().min(1)).max(100),
    paymentTerms: z.enum(["due_on_receipt", "net_15", "net_30"]),
    poNumber: z.string().trim().max(140),
    notes: z.string().trim().max(500),
    items: z.array(lineItem).min(1).max(100),
  })
  .superRefine((value, context) => {
    if (value.billingMode === "per_job" && value.jobIds.length !== 1)
      context.addIssue({
        code: "custom",
        path: ["jobIds"],
        message: "Per-job invoices require exactly one completed job.",
      });
    if (value.billingMode === "statement" && !value.jobIds.length)
      context.addIssue({
        code: "custom",
        path: ["jobIds"],
        message: "A statement needs at least one completed job.",
      });
    if (value.billingMode === "one_off" && value.jobIds.length)
      context.addIssue({
        code: "custom",
        path: ["jobIds"],
        message: "A one-off charge carries no job. Bill it per job or on a statement instead.",
      });
    if (new Set(value.jobIds).size !== value.jobIds.length)
      context.addIssue({
        code: "custom",
        path: ["jobIds"],
        message: "A job can appear only once on an invoice.",
      });
    const jobs = new Set(value.jobIds);
    value.items.forEach((item, index) => {
      // A fee or an adjustment is a number the customer cannot check against
      // anything, so it has to say what it is for. Enforced here as well as in
      // the editor: the API is reachable without it.
      const problem = lineDescriptionProblem(item.category, item.description);
      if (problem)
        context.addIssue({
          code: "custom",
          path: ["items", index, "description"],
          message: problem,
        });
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
