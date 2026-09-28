import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadCsv, downloadPdf } from "./client-download";

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
    vi.useFakeTimers();
    await downloadCsv("/api/export", "fallback.csv");
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    // Revoked later, not synchronously, so Safari can still read the blob.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    vi.useRealTimers();
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

  it("downloads an actual PDF response and rejects a mislabeled file", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("%PDF-1.7", {
      headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=jobs.pdf" },
    })).mockResolvedValueOnce(new Response("not a CSV", {
      headers: { "content-type": "application/pdf" },
    }));
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("URL", { createObjectURL: vi.fn().mockReturnValue("blob:pdf"), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    await downloadPdf("/report?format=pdf", "fallback.pdf");
    expect(click).toHaveBeenCalledOnce();
    await expect(downloadCsv("/report", "report.csv")).rejects.toThrow("did not return a CSV");
  });
});
