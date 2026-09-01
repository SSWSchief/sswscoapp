import {
  apiFailure,
  apiSuccess,
  logRequest,
  requestId,
} from "@/lib/api-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAppUrl } from "@/lib/app-url";
import { emailDeliveryEnabled } from "@/lib/email-delivery";
import { pushConfigurationStatus } from "@/lib/push/env";
import { stripeConfigurationStatus } from "@/lib/stripe/env";

export const dynamic = "force-dynamic";
const route = "/api/health";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestIdValue = requestId(request);
  const appUrl = resolveAppUrl();
  try {
    const databaseStartedAt = Date.now();
    const result = await createAdminClient()
      .from("company_settings")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (result.error) throw result.error;
    const data = {
      status: "ok",
      dependencies: {
        database: {
          status: "reachable",
          latencyMs: Date.now() - databaseStartedAt,
        },
      },
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local",
      // Reported so the address emailed links point at can be read from
      // outside in one request. It is the public URL of this application, so
      // there is nothing here a visitor does not already know — and the last
      // time it was wrong it took ten days and three support rounds to find.
      emailLinks: {
        appUrl: appUrl.url,
        source: appUrl.source,
        emailDeliveryEnabled: emailDeliveryEnabled(),
      },
      // Booleans only — never the keys themselves. Push failing because a
      // deployment never received its VAPID keys is invisible from the app
      // (the opt-in simply does nothing), so it needs to be readable here.
      push: pushConfigurationStatus(),
      // Same reasoning as push, and the same booleans-only rule: a deployment
      // without its webhook secret refuses every Stripe event as unsigned,
      // which looks identical to Stripe being broken.
      stripe: stripeConfigurationStatus(),
    };
    logRequest("info", "health_check_complete", {
      requestId: requestIdValue,
      route,
      method: "GET",
      startedAt,
      status: 200,
    });
    return apiSuccess(data, requestIdValue);
  } catch {
    logRequest("error", "health_check_failed", {
      requestId: requestIdValue,
      route,
      method: "GET",
      startedAt,
      status: 503,
      code: "dependency_unavailable",
    });
    return apiFailure(
      "dependency_unavailable",
      "A required dependency is unavailable.",
      503,
      requestIdValue,
    );
  }
}
