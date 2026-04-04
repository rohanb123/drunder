import type { ReportRequest, ReportResponse } from "./types";

function baseUrl(): string {
  const u = process.env.NEXT_PUBLIC_API_URL;
  if (!u) throw new Error("Set NEXT_PUBLIC_API_URL (see .env.local.example)");
  return u.replace(/\/$/, "");
}

export async function postReport(body: ReportRequest): Promise<ReportResponse> {
  const res = await fetch(`${baseUrl()}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Report failed: ${res.status}`);
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
    const text = await res.text();
    throw new Error(text || `PDF failed: ${res.status}`);
  }
  return res.blob();
}
