import type { ReportRequest, ReportResponse } from "./types";

function baseUrl(): string {
  const u = process.env.NEXT_PUBLIC_API_URL;
  if (!u) {
    throw new Error("This app isn't configured to reach the report service. Contact your administrator.");
  }
  return u.replace(/\/$/, "");
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
