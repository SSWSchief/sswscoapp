import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "./client-api";

describe("client API errors", () => {
  it("adds the server request reference to safe errors", async () => {
    const response = new Response(JSON.stringify({ error: { message: "Try again.", requestId: "req-123" } }), { status: 429, headers: { "content-type": "application/json" } });
    await expect(apiErrorMessage(response, "Fallback")).resolves.toBe("Try again. (Reference req-123)");
  });

  it("handles string, header-only, and malformed error responses", async () => {
    await expect(
      apiErrorMessage(
        new Response(JSON.stringify({ error: "Denied" }), { status: 403 }),
        "Fallback",
      ),
    ).resolves.toBe("Denied");
    await expect(
      apiErrorMessage(
        new Response(JSON.stringify({}), {
          status: 500,
          headers: { "x-request-id": "header-1" },
        }),
        "Fallback",
      ),
    ).resolves.toBe("Fallback (Reference header-1)");
    await expect(
      apiErrorMessage(new Response("not-json", { status: 500 }), "Fallback"),
    ).resolves.toBe("Fallback");
  });
});
