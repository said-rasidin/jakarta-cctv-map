import type { CameraSite, StreamHealth } from "@/domain/cameras/types";

export type CameraStatus = "active" | "inactive" | "checking";

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

const GROUP_PREFIXES = /^(?:jk[ubpst]\s+)?(?:(?:satpol\s*pp|dishub|polda|polri|dbm|disgulkarmat|bakesbangpol)\s+)+/i;
const CAMERA_SUFFIX = /(?:[-\s]+(?:c(?:ctv)?[-\s]*)?0*\d+)$/i;

export function cameraGroup(site: Pick<CameraSite, "name" | "address">) {
  const roadAddress = site.address?.split("(")[0].replace(/[.,]+$/, "").trim();
  const rawLabel = roadAddress && /^(?:jl\.?|jalan|simpang|flyover|jpo|tol)\b/i.test(roadAddress) ? roadAddress : site.name;
  const label = rawLabel.replace(GROUP_PREFIXES, "").replace(CAMERA_SUFFIX, "").replace(/\s+/g, " ").trim() || site.name;
  return { key: normalizeText(label), label };
}

export function locationLabel(site: Pick<CameraSite, "district">) {
  const value = site.district?.trim() || "DKI Jakarta";
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function cameraStatus(site: CameraSite, health: Record<string, StreamHealth>): CameraStatus {
  const direct = site.channels.filter((channel) => channel.embedUrl);
  if (!direct.length) return "inactive";
  const statuses = direct.map((channel) => health[channel.id] ?? "unknown");
  if (statuses.includes("available")) return "active";
  return statuses.every((status) => status === "unavailable") ? "inactive" : "checking";
}
