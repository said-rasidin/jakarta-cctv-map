import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CameraDataset } from "../src/lib/types";

const DATASET_PATH = resolve("data/cameras.json");
const ALLOWED_HOSTS = new Set(["dki-jkt.balitower.co.id", "cctv-jsc.balitower.co.id"]);
const CONCURRENCY = 4;
const TIMEOUT_MS = 15_000;
const TEST_ORIGIN = "http://localhost:3000";

type CheckResult = { url: string; error?: string };

function validateUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) throw new Error("URL is not an allowlisted Bali Tower HTTPS host");
  return parsed;
}

function assertCors(response: Response) {
  const cors = response.headers.get("access-control-allow-origin");
  if (cors !== "*" && cors !== TEST_ORIGIN) throw new Error(`Missing capture-compatible CORS header (received ${cors ?? "none"})`);
  validateUrl(response.url);
}

async function fetchResource(url: string, readBody: boolean) {
  validateUrl(url);
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Origin: TEST_ORIGIN, "User-Agent": "cctv-jakarta-map-validator/0.2" },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  assertCors(response);
  if (readBody) return response.text();
  await response.body?.cancel();
  return "";
}

function uriAttributes(playlist: string) {
  return [...playlist.matchAll(/#EXT-X-(?:KEY|MAP):[^\n]*URI="([^"]+)"/g)].map((match) => match[1]);
}

function mediaReferences(playlist: string) {
  const lines = playlist.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const resources = uriAttributes(playlist);
  const segment = lines.find((line) => !line.startsWith("#"));
  if (segment) resources.push(segment);
  return resources;
}

async function check(url: string): Promise<CheckResult> {
  try {
    const master = await fetchResource(url, true);
    if (!master.startsWith("#EXTM3U")) throw new Error("Response is not an HLS playlist");
    const lines = master.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const variantIndex = lines.findIndex((line) => line.startsWith("#EXT-X-STREAM-INF"));
    let mediaUrl = url;
    let media = master;
    if (variantIndex >= 0 && lines[variantIndex + 1]) {
      mediaUrl = new URL(lines[variantIndex + 1], url).toString();
      media = await fetchResource(mediaUrl, true);
      if (!media.startsWith("#EXTM3U")) throw new Error("Variant response is not an HLS playlist");
    }
    const resources = mediaReferences(media);
    if (!resources.length) throw new Error("Media playlist has no segment");
    await Promise.all(resources.slice(0, 3).map((resource) => fetchResource(new URL(resource, mediaUrl).toString(), false)));
    return { url };
  } catch (error) {
    return { url, error: error instanceof Error ? error.message : "Request failed" };
  }
}

async function main() {
  const dataset = JSON.parse(await readFile(DATASET_PATH, "utf8")) as CameraDataset;
  const urls = [...new Set(dataset.sites.flatMap((site) => site.channels.map((channel) => channel.playback.url).filter((url): url is string => url !== null)))];
  const results: CheckResult[] = [];
  for (let offset = 0; offset < urls.length; offset += CONCURRENCY) results.push(...await Promise.all(urls.slice(offset, offset + CONCURRENCY).map(check)));
  const failures = results.filter((result) => result.error);
  console.log(`Checked ${results.length} HLS chains (playlist, variant, segment/key/map); ${results.length - failures.length} capture-compatible.`);
  if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exitCode = 1; }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
