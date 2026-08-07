"use client";

interface ExportErrorBody {
  error?: string | { message?: string };
}

function filenameFromDisposition(header: string | null, fallbackName: string) {
  const match = header?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match?.[1] ? decodeURIComponent(match[1]) : fallbackName;
}

async function safeErrorMessage(response: Response) {
  const fallback = `Download failed (${response.status}).`;
  try {
    const body = (await response.json()) as ExportErrorBody;
    if (typeof body.error === "string") return body.error;
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export async function downloadCsv(url: string, fallbackName: string) {
  const response = await fetch(url, { headers: { accept: "text/csv" } });
  if (!response.ok) throw new Error(await safeErrorMessage(response));

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filenameFromDisposition(response.headers.get("content-disposition"), fallbackName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
