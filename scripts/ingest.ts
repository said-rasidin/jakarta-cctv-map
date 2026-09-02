import * as cheerio from "cheerio";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { findReferenceCamera, normalizeReferenceCoordinates, normalizeText, withinJakarta, type ReferenceCameraLocation } from "../src/lib/camera";
import type { CameraDataset, CameraSite, CoordinateSource } from "../src/lib/types";

const SOURCE_URL = "https://jakcctv.jakarta.go.id/publik";
const STREETSIDE_SOURCE_URL = "https://streetside.mugnimaestra.dev/api/cameras";
const OUTPUT = resolve("data/cameras.json");
const OVERRIDES = resolve("data/overrides.json");
const REVIEW = resolve("data/unresolved-locations.json");
const MIN_EXPECTED_CHANNELS = 20;
type Override = { lat: number; lng: number; district?: string };
type RawChannel = { siteId: string; siteName: string; agency: string; areaCode: string | null; label: string; embedUrl: string };
type StreetsideCamera = { id: number; content_type: string; cctv_name?: string; address?: string; city_name?: string; district_name?: string; subdistrict_name?: string; latitude?: number; longitude?: number; is_enabled?: boolean };

function agencyFromPath(pathname: string) {
  const token = pathname.split("/").filter(Boolean)[0] ?? "";
  const parts = decodeURIComponent(token).split("_");
  const candidate = parts.slice(2, -1).join(" ").toUpperCase();
  if (/SATPOL[ -]?PP/.test(candidate)) return "Satpol PP";
  if (/DISHUB/.test(candidate)) return "Dishub";
  if (/POLDA/.test(candidate)) return "Polda";
  if (/POLRI/.test(candidate)) return "Polri";
  if (/DISGULKARMAT/.test(candidate)) return "Disgulkarmat";
  if (/BAKESBANGPOL/.test(candidate)) return "Bakesbangpol";
  if (/\bDBM\b/.test(candidate)) return "DBM";
  return "Bali Tower";
}

function parseRawChannels(html: string): RawChannel[] {
  const $ = cheerio.load(html);
  const channels: RawChannel[] = [];
  $(".card").each((_, element) => {
    const card = $(element);
    const embedUrl = card.find("iframe").attr("src");
    const siteName = card.find(".title").text().trim();
    const label = card.find(".badge").text().trim();
    if (!embedUrl || !siteName || !label) return;
    const url = new URL(embedUrl);
    if (url.protocol !== "https:" || !["dki-jkt.balitower.co.id", "cctv-jsc.balitower.co.id"].includes(url.hostname)) return;
    const pathToken = url.pathname.split("/").filter(Boolean)[0] ?? "";
    const idMatch = pathToken.match(/^(\d{5,})_|-(\d{5,})_/);
    const id = idMatch?.[1] ?? idMatch?.[2] ?? normalizeText(siteName);
    const areaCode = pathToken.match(/_(JK[PBST])_/)?.[1] ?? null;
    channels.push({ siteId: id, siteName, agency: agencyFromPath(url.pathname), areaCode, label, embedUrl });
  });
  return channels;
}

async function geocode(query: string) {
  const userAgent = process.env.NOMINATIM_USER_AGENT;
  if (!userAgent) throw new Error("NOMINATIM_USER_AGENT is required for geocoding. See .env.example.");
  const params = new URLSearchParams({ q: `${query}, Jakarta, Indonesia`, format: "jsonv2", limit: "1", bounded: "1", viewbox: "106.65,-6.05,107.05,-6.40", addressdetails: "1" });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { "User-Agent": userAgent, Accept: "application/json" } });
  if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
  const results = await response.json() as Array<{ lat: string; lon: string; address?: Record<string, string> }>;
  const result = results[0];
  if (!result) return null;
  const lat = Number(result.lat), lng = Number(result.lon);
  if (!withinJakarta(lat, lng)) return null;
  return { lat, lng, district: result.address?.city_district ?? result.address?.suburb ?? null };
}

async function main() {
  const [sourceResponse, streetsideResponse, priorText, overridesText] = await Promise.all([
    fetch(SOURCE_URL, { headers: { "User-Agent": "cctv-jakarta-map-ingestor/0.1" }, cache: "no-store" }),
    fetch(STREETSIDE_SOURCE_URL, { headers: { "User-Agent": "cctv-jakarta-map-ingestor/0.1" }, cache: "no-store" }),
    readFile(OUTPUT, "utf8").catch(() => ""),
    readFile(OVERRIDES, "utf8").catch(() => "{}"),
  ]);
  if (!sourceResponse.ok) throw new Error(`Source returned ${sourceResponse.status}`);
  if (!streetsideResponse.ok) throw new Error(`Streetside catalog returned ${streetsideResponse.status}`);
  const channels = parseRawChannels(await sourceResponse.text());
  if (channels.length < MIN_EXPECTED_CHANNELS) throw new Error(`Only ${channels.length} valid channels found; preserving last good data.`);
  const previous = priorText ? JSON.parse(priorText) as CameraDataset : null;
  const previousById = new Map(previous?.sites.map((site) => [site.id, site]) ?? []);
  const overrides = JSON.parse(overridesText) as Record<string, Override>;
  const streetside = await streetsideResponse.json() as { cameras?: StreetsideCamera[] };
  const referenceLocations: ReferenceCameraLocation[] = (streetside.cameras ?? []).flatMap((camera) => {
    const coordinates = normalizeReferenceCoordinates(camera.latitude ?? NaN, camera.longitude ?? NaN);
    return camera.content_type === "cctv" && camera.is_enabled && camera.id && camera.cctv_name && coordinates
      ? [{ id: camera.id, name: camera.cctv_name, address: camera.address?.trim() || null, ...coordinates }]
      : [];
  });
  const groups = Map.groupBy(channels, (channel) => channel.siteId);
  const sites: CameraSite[] = [];
  const unresolved: Array<{ id: string; name: string }> = [];

  for (const [id, grouped] of groups) {
    if (!id || !grouped) continue;
    const first = grouped[0];
    const prior = previousById.get(id);
    const override = overrides[id];
    let coordinates: CameraSite["coordinates"] | null = null;
    let district: string | null = override?.district ?? prior?.district ?? null;
    if (override && withinJakarta(override.lat, override.lng)) coordinates = { lat: override.lat, lng: override.lng, source: "override" };
    else if (prior?.coordinates && withinJakarta(prior.coordinates.lat, prior.coordinates.lng)) coordinates = { ...prior.coordinates, source: "cached" as CoordinateSource };
    else {
      const found = await geocode(first.siteName);
      if (found) { coordinates = { lat: found.lat, lng: found.lng, source: "nominatim" }; district = found.district; }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1100));
    }
    if (!coordinates) { unresolved.push({ id, name: first.siteName }); continue; }
    const reference = findReferenceCamera(first.siteName, coordinates, referenceLocations);
    if (reference) { coordinates = { lat: reference.lat, lng: reference.lng, source: "streetside" }; }
    const site: CameraSite = {
      id, name: first.siteName, normalizedName: normalizeText(first.siteName), district, areaCode: first.areaCode,
      agency: first.agency, provider: "Bali Tower", address: null, catalogSource: "balitower", coordinates,
      searchText: normalizeText([id, first.siteName, district, first.areaCode, first.agency, "Bali Tower", ...grouped.map((channel) => channel.label)].filter(Boolean).join(" ")),
      channels: grouped.map((channel) => ({ id: `${id}-${normalizeText(channel.label).replaceAll(" ", "-")}`, label: channel.label, embedUrl: channel.embedUrl, sourceUrl: channel.embedUrl })),
    };
    sites.push(site);
  }
  for (const camera of streetside.cameras ?? []) {
    const coordinates = normalizeReferenceCoordinates(camera.latitude ?? NaN, camera.longitude ?? NaN);
    if (camera.content_type !== "cctv" || !camera.is_enabled || !camera.cctv_name || !coordinates) continue;
    const normalizedName = normalizeText(camera.cctv_name);
    const id = `streetside-${camera.id}`;
    const district = camera.subdistrict_name ?? camera.district_name ?? null;
    const address = camera.address?.trim() || null;
    const sourceUrl = `https://streetside.mugnimaestra.dev/camera/${camera.id}`;
    sites.push({
      id, name: camera.cctv_name, normalizedName, district, areaCode: null, agency: "DKI Jakarta", provider: "Molecool / Streetside",
      address, catalogSource: "streetside", coordinates: { ...coordinates, source: "streetside" },
      searchText: normalizeText([id, camera.cctv_name, address, camera.city_name, camera.district_name, camera.subdistrict_name, "DKI Jakarta Molecool Streetside"].filter(Boolean).join(" ")),
      channels: [{ id: `${id}-catalog`, label: "CCTV", embedUrl: null, sourceUrl }],
    });
  }
  const duplicateChannel = sites.flatMap((site) => site.channels).some((channel, index, all) => all.findIndex((candidate) => candidate.id === channel.id) !== index);
  if (duplicateChannel) throw new Error("Duplicate channel identifiers found.");
  const dataset: CameraDataset = { schemaVersion: 1, generatedAt: new Date().toISOString(), sourceUrl: SOURCE_URL, unresolvedCount: unresolved.length, sites: sites.sort((a, b) => a.name.localeCompare(b.name, "id")) };
  if (!dataset.sites.length) throw new Error("No geocoded sites available; preserving last good data.");
  await Promise.all([writeFile(OUTPUT, `${JSON.stringify(dataset, null, 2)}\n`), writeFile(REVIEW, `${JSON.stringify(unresolved, null, 2)}\n`)]);
  console.log(`Published ${dataset.sites.length} sites / ${channels.length} channels; ${unresolved.length} require review.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

export { agencyFromPath, parseRawChannels };
