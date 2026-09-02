import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { findReferenceCamera, normalizeReferenceCoordinates, normalizeText, type ReferenceCameraLocation } from "../src/lib/camera";
import type { CameraDataset, CameraSite } from "../src/lib/types";

const API_URL = "https://streetside.mugnimaestra.dev/api/cameras";
const outputPath = resolve("data/cameras.json");
const snapshotArg = process.argv.find((argument) => argument.startsWith("--file="))?.slice(7);
type RawCamera = { id?: number; content_type: string; cctv_name?: string; address?: string | null; city_name?: string; district_name?: string; subdistrict_name?: string; latitude?: number; longitude?: number; is_enabled?: boolean };

async function main() {
const dataset = JSON.parse(await readFile(outputPath, "utf8")) as CameraDataset;
const raw = snapshotArg
  ? JSON.parse(await readFile(resolve(snapshotArg), "utf8")) as { cameras?: RawCamera[] }
  : await fetch(API_URL, { cache: "no-store", headers: { "User-Agent": "cctv-jakarta-map-reference-sync/0.1" } }).then(async (response) => {
      if (!response.ok) throw new Error(`Reference API returned ${response.status}`);
      return response.json() as Promise<{ cameras?: RawCamera[] }>;
    });

const valid = (raw.cameras ?? []).flatMap((camera) => {
  const coordinates = normalizeReferenceCoordinates(camera.latitude ?? NaN, camera.longitude ?? NaN);
  return camera.content_type === "cctv" && camera.is_enabled && camera.id && camera.cctv_name && coordinates ? [{ camera, coordinates }] : [];
});
const referenceLocations: ReferenceCameraLocation[] = valid.map(({ camera, coordinates }) => ({ id: camera.id!, name: camera.cctv_name!, address: camera.address?.trim() || null, ...coordinates }));
const directSites = dataset.sites.filter((site) => site.catalogSource === "balitower").map((site) => {
  const reference = findReferenceCamera(site.name, site.coordinates, referenceLocations);
  return reference ? { ...site, coordinates: { lat: reference.lat, lng: reference.lng, source: "streetside" as const } } : site;
});
const referenceSites: CameraSite[] = valid.map(({ camera, coordinates }) => {
  const id = `streetside-${camera.id}`;
  const district = camera.subdistrict_name ?? camera.district_name ?? camera.city_name ?? null;
  const address = camera.address?.trim() || null;
  return {
    id, name: camera.cctv_name!, normalizedName: normalizeText(camera.cctv_name!), district, areaCode: null,
    agency: "DKI Jakarta", provider: "Molecool / Streetside", address, catalogSource: "streetside",
    coordinates: { ...coordinates, source: "streetside" },
    searchText: normalizeText([id, camera.cctv_name, address, camera.city_name, camera.district_name, camera.subdistrict_name, "DKI Jakarta Molecool Streetside"].filter(Boolean).join(" ")),
    channels: [{ id: `${id}-catalog`, label: "CCTV", embedUrl: null, sourceUrl: `https://streetside.mugnimaestra.dev/camera/${camera.id}` }],
  };
});
const next: CameraDataset = { ...dataset, generatedAt: new Date().toISOString(), sites: [...directSites, ...referenceSites].sort((a, b) => a.name.localeCompare(b.name, "id")) };
await writeFile(outputPath, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Synced ${referenceSites.length} enabled reference cameras; aligned ${directSites.filter((site) => site.coordinates.source === "streetside").length}/${directSites.length} direct-stream sites.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
