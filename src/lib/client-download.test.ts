import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadCsv } from "./client-download";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("downloadCsv", () => {
  it("downloads a successful CSV with the server filename", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("a,b", {
          headers: {
            "content-type": "text/csv",
            "content-disposition": "attachment; filename*=UTF-8''jobs.csv",
          },
        }),
      ),
    );
    const createObjectURL = vi.fn().mockReturnValue("blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    await downloadCsv("/api/export", "fallback.csv");
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  it("returns structured and fallback download errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: { message: "Denied", requestId: "request-1" },
            }),
            { status: 403 },
          ),
        )
        .mockResolvedValueOnce(new Response("not-json", { status: 500 })),
    );
    await expect(downloadCsv("/denied", "file.csv")).rejects.toThrow(
      "Denied (Reference request-1)",
    );
    await expect(downloadCsv("/broken", "file.csv")).rejects.toThrow(
      "Download failed (500)",
    );
  });
});
