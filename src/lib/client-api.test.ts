import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "./client-api";

describe("client API errors", () => {
  it("adds the server request reference to safe errors", async () => {
    const response = new Response(JSON.stringify({ error: { message: "Try again.", requestId: "req-123" } }), { status: 429, headers: { "content-type": "application/json" } });
    await expect(apiErrorMessage(response, "Fallback")).resolves.toBe("Try again. (Reference req-123)");
  });
});
