"use client";

interface ExportErrorBody {
  error?: string | { message?: string; requestId?: string };
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
    const message = body.error?.message ?? fallback;
    return body.error?.requestId
      ? `${message} (Reference ${body.error.requestId})`
      : message;
  } catch {
    return fallback;
  }
}

async function downloadFile(url: string, fallbackName: string, contentType: string) {
  const response = await fetch(url, { headers: { accept: contentType } });
  if (!response.ok) throw new Error(await safeErrorMessage(response));
  if (!response.headers.get("content-type")?.startsWith(contentType))
    throw new Error(`The server did not return ${fallbackName.endsWith(".pdf") ? "a PDF" : fallbackName.endsWith(".xlsx") ? "an Excel" : "a CSV"} file.`);

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filenameFromDisposition(
    response.headers.get("content-disposition"),
    fallbackName,
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export const downloadCsv = (url: string, fallbackName: string) => downloadFile(url, fallbackName, "text/csv");
export const downloadPdf = (url: string, fallbackName: string) => downloadFile(url, fallbackName, "application/pdf");
export const downloadXlsx = (url: string, fallbackName: string) => downloadFile(url, fallbackName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
