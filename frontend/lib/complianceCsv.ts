import type { SupplierInput } from "@/lib/types";

/** Headers that map to supplier name (first match wins). */
const NAME_HEADERS = new Set([
  "name",
  "supplier_name",
  "supplier",
  "company",
  "company_name",
  "vendor",
  "vendor_name",
]);

/** Headers that map to short description / role (first match wins). */
const DESC_HEADERS = new Set([
  "role",
  "supplier_role",
  "description",
  "company_description",
  "short_description",
  "what_they_do",
  "summary",
  "about",
  "business",
  "type",
  "function",
]);

function normalizeHeader(cell: string): string {
  return cell
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function headerLooksLikeName(h: string): boolean {
  if (NAME_HEADERS.has(h)) return true;
  if (h === "supplier" || h.endsWith("_name")) return true;
  return h === "company" || h === "vendor";
}

function headerLooksLikeDesc(h: string): boolean {
  if (DESC_HEADERS.has(h)) return true;
  return h.includes("description") || h.includes("role") || h === "summary" || h === "about";
}

function findColumnIndex(headers: string[], pred: (h: string) => boolean): number {
  for (let i = 0; i < headers.length; i++) {
    if (pred(headers[i]!)) return i;
  }
  return -1;
}

/**
 * Parse pasted/uploaded CSV rows (no Papa): first row may be a header row.
 * - If row 0 looks like name + description headers, map named columns (supports extra columns).
 * - Otherwise treat every row as: column 0 = name, column 1 = description/role.
 */
export function parseSupplierRowsFromMatrix(raw: string[][]): SupplierInput[] {
  const rows = raw
    .map((r) =>
      r.map((c) => (c == null ? "" : String(c)).replace(/^\uFEFF/, "").trim()),
    )
    .filter((r) => r.some((c) => c.length > 0));
  if (!rows.length) return [];

  const h0 = rows[0]!.map(normalizeHeader);
  let nameIdx = findColumnIndex(h0, headerLooksLikeName);
  let descIdx = findColumnIndex(h0, headerLooksLikeDesc);
  if (nameIdx >= 0 && descIdx < 0 && h0.length >= 2 && rows.length > 1) {
    descIdx = nameIdx === 0 ? 1 : 0;
    if (descIdx === nameIdx) descIdx = nameIdx + 1 < h0.length ? nameIdx + 1 : -1;
  }
  const looksLikeHeaderRow =
    h0.length >= 2 && nameIdx >= 0 && descIdx >= 0 && nameIdx !== descIdx && rows.length > 1;

  const dataRows = looksLikeHeaderRow ? rows.slice(1) : rows;

  const out: SupplierInput[] = [];
  if (looksLikeHeaderRow) {
    for (const cols of dataRows) {
      const name = (cols[nameIdx] ?? "").trim();
      const role = (cols[descIdx] ?? "").trim();
      if (name) out.push({ name, role });
    }
  } else {
    for (const cols of dataRows) {
      const name = (cols[0] ?? "").trim();
      const role = (cols[1] ?? "").trim();
      if (name) out.push({ name, role });
    }
  }
  return out;
}
