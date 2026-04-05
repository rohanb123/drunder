import { baseUrl } from "./api";
import type { ProfileContext } from "./simulation-types";

export type ProfileSummary = { id: string; name: string; updatedAt: number };

export type SupplyProfile = {
  id: string;
  name: string;
  updatedAt: number;
  suppliers: { id: string; name: string; country: string }[];
  htsCodes: { code: string; description: string | null }[];
  categories: { name: string }[];
};

async function parseErr(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: string | string[] };
    const d = j.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map(String).join(", ");
  } catch {
    /* ignore */
  }
  return res.statusText || "Request failed";
}

export async function sentinelListProfiles(): Promise<ProfileSummary[]> {
  const res = await fetch(`${baseUrl()}/sentinel/profiles`);
  if (!res.ok) throw new Error(await parseErr(res));
  return res.json() as Promise<ProfileSummary[]>;
}

export async function sentinelCreateProfile(name: string): Promise<SupplyProfile> {
  const res = await fetch(`${baseUrl()}/sentinel/profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await parseErr(res));
  return res.json() as Promise<SupplyProfile>;
}

export async function sentinelGetProfile(id: string): Promise<SupplyProfile> {
  const res = await fetch(`${baseUrl()}/sentinel/profiles/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(await parseErr(res));
  return res.json() as Promise<SupplyProfile>;
}

export async function sentinelAddSupplier(
  profileId: string,
  body: { name: string; country: string },
): Promise<SupplyProfile> {
  const res = await fetch(`${baseUrl()}/sentinel/profiles/${encodeURIComponent(profileId)}/suppliers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseErr(res));
  return res.json() as Promise<SupplyProfile>;
}

export async function sentinelSimulateSync(
  event: string,
  profile: ProfileContext,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl()}/sentinel/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, profile }),
  });
  if (!res.ok) throw new Error(await parseErr(res));
  return res.json() as Promise<Record<string, unknown>>;
}
