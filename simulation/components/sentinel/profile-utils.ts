import type { ProfileContext } from "@/lib/simulation-types";

export function toProfileContext(detail: {
  profile: { name: string };
  suppliers: { name: string; country: string }[];
  htsCodes: { code: string; description?: string | null }[];
  categories: { name: string }[];
}): ProfileContext {
  return {
    profileName: detail.profile.name,
    suppliers: detail.suppliers.map((s) => ({ name: s.name, country: s.country })),
    htsCodes: detail.htsCodes.map((h) => ({ code: h.code, description: h.description ?? null })),
    categories: detail.categories.map((c) => ({ name: c.name })),
  };
}

export function countryShares(suppliers: { country: string }[]): { country: string; value: number }[] {
  if (suppliers.length === 0) return [];
  const counts = new Map<string, number>();
  for (const s of suppliers) {
    const c = s.country.toUpperCase() || "?";
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const total = suppliers.length;
  return [...counts.entries()]
    .map(([country, n]) => ({ country, value: Math.round((n / total) * 1000) / 10 }))
    .sort((a, b) => b.value - a.value);
}

export function highRiskSupplierCount(suppliers: { country: string }[]): number {
  return suppliers.filter((s) => {
    const u = s.country.toUpperCase();
    return u === "CN" || u === "RU";
  }).length;
}
