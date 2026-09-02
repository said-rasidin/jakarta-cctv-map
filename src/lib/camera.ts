import type { CameraSite } from "@/lib/types";

export const JAKARTA_CENTER: [number, number] = [-6.2088, 106.8456];
export const JAKARTA_BOUNDS = { minLat: -6.4, maxLat: -6.05, minLng: 106.65, maxLng: 107.05 };

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function filterSites(sites: CameraSite[], query: string, agencies: Set<string>) {
  const normalizedQuery = normalizeText(query);
  return sites.filter((site) => {
    const queryMatches = !normalizedQuery || site.searchText.includes(normalizedQuery);
    return queryMatches && (!agencies.size || agencies.has(site.agency));
  });
}

export function distanceInKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371;
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function withinJakarta(lat: number, lng: number) {
  return lat >= JAKARTA_BOUNDS.minLat && lat <= JAKARTA_BOUNDS.maxLat && lng >= JAKARTA_BOUNDS.minLng && lng <= JAKARTA_BOUNDS.maxLng;
}

export function normalizeReferenceCoordinates(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const restoreDecimal = (value: number, integerDigits: number) => {
    const sign = value < 0 ? -1 : 1;
    const digits = Math.abs(value).toString().replace(/^0+/, "");
    return sign * Number(`${digits.slice(0, integerDigits)}.${digits.slice(integerDigits)}`);
  };
  const normalizedLat = Math.abs(lat) > 10 ? restoreDecimal(lat, 1) : lat;
  const normalizedLng = Math.abs(lng) > 180 ? restoreDecimal(lng, 3) : lng;
  return withinJakarta(normalizedLat, normalizedLng) ? { lat: normalizedLat, lng: normalizedLng } : null;
}

const GROUP_PREFIXES = /^(?:jk[ubpst]\s+)?(?:(?:satpol\s*pp|dishub|polda|polri|dbm|disgulkarmat|bakesbangpol)\s+)+/i;
const CAMERA_SUFFIX = /(?:[-\s]+(?:c(?:ctv)?[-\s]*)?0*\d+)$/i;

export function cameraGroup(site: Pick<CameraSite, "name" | "address">) {
  const roadAddress = site.address?.split("(")[0].replace(/[.,]+$/, "").trim();
  const rawLabel = roadAddress && /^(?:jl\.?|jalan|simpang|flyover|jpo|tol)\b/i.test(roadAddress) ? roadAddress : site.name;
  const label = rawLabel.replace(GROUP_PREFIXES, "").replace(CAMERA_SUFFIX, "").replace(/\s+/g, " ").trim() || site.name;
  return { key: normalizeText(label), label };
}

export type ReferenceCameraLocation = { id: number; name: string; address: string | null; lat: number; lng: number };

function significantLocationWords(value: string) {
  const ignored = new Set(["jkp", "jkb", "jku", "jks", "jkt", "dishub", "polda", "polri", "satpol", "pp", "dbm", "cctv", "simpang", "jalan", "jl", "jpo", "jend", "letjen"]);
  return normalizeText(value).split(" ").filter((word) => word && !ignored.has(word) && !/^c?0*\d+$/.test(word));
}

export function findReferenceCamera(name: string, current: { lat: number; lng: number }, references: ReferenceCameraLocation[]) {
  const exact = references.find((camera) => normalizeText(camera.name) === normalizeText(name));
  if (exact) return exact;
  const words = significantLocationWords(name);
  if (words.length < 2) return null;
  const matches = references.map((camera) => {
    const haystack = new Set(significantLocationWords(`${camera.name} ${camera.address ?? ""}`));
    const coverage = words.filter((word) => haystack.has(word)).length / words.length;
    return { camera, coverage, distance: distanceInKm(current, camera) };
  }).filter((candidate) => candidate.coverage >= 0.75).sort((a, b) => b.coverage - a.coverage || a.distance - b.distance);
  return matches[0]?.camera ?? null;
}
