/** Approximate [longitude, latitude] for ISO 3166-1 alpha-2 (for map arcs). */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  CN: [104.2, 35.9],
  US: [-98.35, 39.5],
  VN: [108.28, 14.06],
  MX: [-102.55, 23.63],
  DE: [10.45, 51.17],
  KR: [127.77, 35.91],
  JP: [138.25, 36.2],
  IN: [78.96, 20.59],
  TW: [120.96, 23.7],
  TH: [100.99, 15.87],
  MY: [101.98, 4.21],
  SG: [103.82, 1.35],
  GB: [-3.44, 55.38],
  FR: [2.21, 46.23],
  CA: [-106.35, 56.13],
  BR: [-51.93, -14.24],
  PL: [19.15, 51.92],
  NL: [5.29, 52.13],
  ID: [113.92, -0.79],
  PH: [122.56, 11.78],
  AU: [133.78, -25.27],
  IT: [12.57, 41.87],
  ES: [-3.75, 40.46],
  TR: [35.24, 38.96],
  BD: [90.36, 23.68],
  CH: [8.23, 46.82],
  SE: [18.64, 60.13],
  CZ: [15.47, 49.82],
  HU: [19.5, 47.16],
};

export function getCentroid(code: string): [number, number] | null {
  const k = code.trim().toUpperCase();
  return COUNTRY_CENTROIDS[k] ?? null;
}
