import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CameraDataset } from "../src/lib/types";

const DATASET_PATH = resolve("data/cameras.json");
const ALLOWED_HOSTS = new Set(["dki-jkt.balitower.co.id", "cctv-jsc.balitower.co.id"]);
const CONCURRENCY = 6;
const TIMEOUT_MS = 12_000;

type CheckResult = { url: string; status: number; error?: string };

async function check(url: string): Promise<CheckResult> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return { url, status: 0, error: "URL is not an allowlisted Bali Tower HTTPS host" };
  }
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "cctv-jakarta-map-validator/0.1" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { url, status: response.status, error: response.ok ? undefined : `HTTP ${response.status}` };
  } catch (error) {
    return { url, status: 0, error: error instanceof Error ? error.message : "Request failed" };
  }
}

async function main() {
  const dataset = JSON.parse(await readFile(DATASET_PATH, "utf8")) as CameraDataset;
  const urls = [...new Set(dataset.sites.flatMap((site) => site.channels.map((channel) => channel.embedUrl).filter((url): url is string => url !== null)))];
  const results: CheckResult[] = [];
  for (let offset = 0; offset < urls.length; offset += CONCURRENCY) {
    results.push(...await Promise.all(urls.slice(offset, offset + CONCURRENCY).map(check)));
  }
  const failures = results.filter((result) => result.error);
  console.log(`Checked ${results.length} direct Bali Tower embed URLs; ${results.length - failures.length} reachable.`);
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
