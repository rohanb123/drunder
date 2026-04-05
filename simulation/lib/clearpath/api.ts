import type { ReportRequest, ReportResponse } from "./types";

function baseUrl(): string {
  const u = process.env.NEXT_PUBLIC_API_URL;
  if (!u) {
    throw new Error(
      "This app isn't configured to reach the report service. Set NEXT_PUBLIC_API_URL (Clearpath API base URL).",
    );
  }
  return u.replace(/\/$/, "");
}

export function regulatorySourcePdfUrl(
  sourceFile: string | null | undefined,
  sourcePage: number | null | undefined,
): string | null {
  const rel = (sourceFile ?? "").trim();
  if (!rel) return null;
  const u = new URL(`${baseUrl()}/regulatory/pdfs`);
  u.searchParams.set("path", rel);
  let href = u.toString();
  if (sourcePage != null && Number.isFinite(sourcePage) && sourcePage >= 1) {
    href += `#page=${Math.floor(sourcePage)}`;
  }
  return href;
}

export async function postReport(body: ReportRequest): Promise<ReportResponse> {
  const res = await fetch(`${baseUrl()}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    await res.text().catch(() => {});
    throw new Error("We couldn't complete your report. Please try again in a moment.");
  }
  return res.json() as Promise<ReportResponse>;
}

export async function postReportPdf(body: ReportRequest): Promise<Blob> {
  const res = await fetch(`${baseUrl()}/report/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    await res.text().catch(() => {});
    throw new Error("We couldn't generate the PDF. Please try again in a moment.");
  }
  return res.blob();
}
