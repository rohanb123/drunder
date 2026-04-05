"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import { ExposureSnapshot } from "../ExposureSnapshot";
import { RiskBadge } from "../RiskBadge";

type Props = {
  profiles: Doc<"supplyChainProfiles">[];
  profileDetail: {
    suppliers: { _id: string; name: string; country: string }[];
    htsCodes: { code: string }[];
  } | null | undefined;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  newProfileName: string;
  setNewProfileName: (v: string) => void;
  createProfile: (args: { name: string }) => Promise<unknown>;
  onCsv: (file: File | null) => Promise<void>;
  exposureRows: { country: string; value: number }[];
};

export function ProfileTab({
  profiles,
  profileDetail,
  selectedId,
  setSelectedId,
  newProfileName,
  setNewProfileName,
  createProfile,
  onCsv,
  exposureRows,
}: Props) {
  if (profiles.length === 0) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2">
          <p className="mb-4 text-sm text-zinc-600">Create a profile to manage suppliers and HTS data.</p>
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Profile name"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
            />
            <button
              type="button"
              disabled={!newProfileName.trim()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              onClick={() => {
                const n = newProfileName.trim();
                if (!n) return;
                void createProfile({ name: n }).then(() => setNewProfileName(""));
              }}
            >
              Create
            </button>
          </div>
        </div>
        <ExposureSnapshot byCountry={[]} />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold uppercase text-zinc-500">
            Active profile
            <select
              className="mt-1 block w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
            >
              <option value="">Select…</option>
              {profiles.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50">
            Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void onCsv(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {profileDetail && (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <h2 className="font-semibold text-zinc-900">Active suppliers</h2>
              <span className="text-xs text-zinc-500">
                {profileDetail.suppliers.length} rows · HTS {profileDetail.htsCodes.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-2">Supplier</th>
                    <th className="px-4 py-2">Location</th>
                    <th className="px-4 py-2">HTS</th>
                    <th className="px-4 py-2">Risk</th>
                    <th className="px-4 py-2">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {profileDetail.suppliers.map((s) => {
                    const hts = profileDetail.htsCodes[0]?.code ?? "—";
                    const risk =
                      s.country.toUpperCase() === "CN" || s.country.toUpperCase() === "RU" ? "high" : "low";
                    const share = Math.round((1 / profileDetail.suppliers.length) * 1000) / 10;
                    return (
                      <tr key={s._id} className="border-t border-zinc-100">
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-zinc-600">{s.country}</td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-500">{hts}</td>
                        <td className="px-4 py-3">
                          <RiskBadge risk={risk} variant="compact" />
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zinc-600">~{share}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <ExposureSnapshot byCountry={exposureRows} />
    </div>
  );
}
