import dataset from "../data/cameras.json";
import { normalizeReferenceCoordinates, withinJakarta } from "../src/lib/camera";
import type { CameraDataset } from "../src/lib/types";

const value = dataset as CameraDataset;
if (value.schemaVersion !== 1 || !value.sites.length) throw new Error("Camera dataset is empty or uses an unsupported schema.");
for (const site of value.sites) {
  if (!withinJakarta(site.coordinates.lat, site.coordinates.lng)) throw new Error(`${site.id} has coordinates outside Jakarta.`);
  if (!site.channels.length) throw new Error(`${site.id} has no channels.`);
  for (const channel of site.channels) {
    if (channel.embedUrl !== null && !channel.embedUrl.startsWith("https://")) throw new Error(`${channel.id} does not use HTTPS.`);
    if (site.catalogSource === "balitower" && channel.embedUrl === null) throw new Error(`${channel.id} is missing a direct Bali Tower URL.`);
  }
}
async function validateReference(referenceUrl: string) {
  if (!referenceUrl) return;
  const reference = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(referenceUrl, "utf8"))) as { cameras: Array<{ id?: number; content_type: string; cctv_name?: string; latitude?: number; longitude?: number; is_enabled?: boolean }> };
  const expected = reference.cameras.filter((camera) => camera.content_type === "cctv" && camera.is_enabled && camera.id && camera.cctv_name).map((camera) => ({ camera, coordinates: normalizeReferenceCoordinates(camera.latitude ?? NaN, camera.longitude ?? NaN) })).filter((entry) => entry.coordinates !== null);
  const sitesById = new Map(value.sites.map((site) => [site.id, site]));
  for (const { camera, coordinates } of expected) {
    const site = sitesById.get(`streetside-${camera.id}`);
    if (!site) throw new Error(`Reference camera ${camera.id} is missing.`);
    if (Math.abs(site.coordinates.lat - coordinates!.lat) > 1e-9 || Math.abs(site.coordinates.lng - coordinates!.lng) > 1e-9) throw new Error(`${site.id} does not align with its reference coordinates.`);
  }
  console.log(`Aligned ${expected.length} enabled cameras with the reference dataset.`);
}
validateReference(process.env.CAMERA_REFERENCE_FILE ?? "").then(() => console.log(`Validated ${value.sites.length} sites and ${value.sites.flatMap((site) => site.channels).length} channels.`)).catch((error) => { console.error(error); process.exitCode = 1; });
