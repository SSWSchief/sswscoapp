import { authorizedInvoiceApi } from "@/lib/invoices/api";
import { requireStripeInvoicing } from "@/lib/stripe/client";
import { STRIPE_SERVICE_TAX_CODE } from "@/lib/stripe/invoice-push";

type PreviewBody = {
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: "US";
  };
  items: Array<{ id: string; amountCents: number }>;
};

export async function POST(request: Request) {
  const api = await authorizedInvoiceApi(request, "/api/invoices/tax-preview", "POST");
  if (api.denied) return api.denied;
  let body: PreviewBody;
  try {
    body = (await request.json()) as PreviewBody;
  } catch {
    return api.fail("invalid_tax_preview", "Tax preview details are invalid.", 400);
  }
  const address = body.address;
  const items = body.items?.filter(
    (item) => item && typeof item.id === "string" && Number.isSafeInteger(item.amountCents) && item.amountCents > 0,
  );
  if (!address?.line1?.trim() || !address.city?.trim() || !address.state?.trim() || !address.postalCode?.trim() || address.country !== "US" || !items?.length)
    return api.fail("invalid_tax_preview", "A complete billing address and positive line items are required.", 400);
  try {
    const stripe = await requireStripeInvoicing();
    const calculation = await stripe.tax.calculations.create({
      currency: "usd",
      customer_details: {
        address: {
          line1: address.line1.trim(),
          line2: address.line2?.trim() || undefined,
          city: address.city.trim(),
          state: address.state.trim().toUpperCase(),
          postal_code: address.postalCode.trim(),
          country: "US",
        },
        address_source: "billing",
      },
      line_items: items.map((item) => ({
        amount: item.amountCents,
        reference: item.id,
        tax_behavior: "exclusive",
        tax_code: STRIPE_SERVICE_TAX_CODE,
      })),
    });
    const firstBreakdown = calculation.tax_breakdown?.[0];
    const rawRate = firstBreakdown?.tax_rate_details?.percentage_decimal;
    const rate = rawRate == null ? null : Number(rawRate);
    return api.success({
      subtotalCents: calculation.amount_total - calculation.tax_amount_exclusive,
      taxCents: calculation.tax_amount_exclusive,
      totalCents: calculation.amount_total,
      taxabilityReason: firstBreakdown?.taxability_reason ?? "unknown",
      rate,
      ratePercent: rate === null ? null : Number((rate * 100).toFixed(2)),
    });
  } catch {
    return api.fail("tax_preview_unavailable", "Stripe tax could not be calculated yet.", 502);
  }
}