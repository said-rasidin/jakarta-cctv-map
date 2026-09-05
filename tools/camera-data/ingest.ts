import * as cheerio from "cheerio";
import { normalizeCameraSite } from "../../src/domain/cameras/names";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeText, withinJakarta } from "../../src/domain/cameras/camera";
import type { CameraDataset, CameraSite } from "../../src/domain/cameras/types";

const SOURCE_URL = "https://jakcctv.jakarta.go.id/publik";
const OUTPUT = resolve("data/generated/cameras.json");
const OVERRIDES = resolve("data/manual/overrides.json");
const REVIEW = resolve("data/review/unresolved-locations.json");
const MIN_EXPECTED_CHANNELS = 20;
type Override = {
  lat: number;
  lng: number;
  district?: string;
  address?: string;
  channels?: Record<string, { lat: number; lng: number }>;
};
type RawChannel = {
  siteId: string;
  siteName: string;
  agency: string;
  areaCode: string | null;
  label: string;
  embedUrl: string;
};

function directHlsUrl(embedUrl: string) {
  const url = new URL(embedUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.at(-1) !== "embed.html" || parts.length < 2) return null;
  url.pathname = `/${parts.slice(0, -1).join("/")}/index.m3u8`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

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
    if (
      url.protocol !== "https:" ||
      !["dki-jkt.balitower.co.id", "cctv-jsc.balitower.co.id"].includes(
        url.hostname,
      )
    )
      return;
    const pathToken = url.pathname.split("/").filter(Boolean)[0] ?? "";
    const idMatch = pathToken.match(/^(\d{5,})_|-(\d{5,})_/);
    const id = idMatch?.[1] ?? idMatch?.[2] ?? normalizeText(siteName);
    const areaCode = pathToken.match(/_(JK[PBST])_/)?.[1] ?? null;
    channels.push({
      siteId: id,
      siteName,
      agency: agencyFromPath(url.pathname),
      areaCode,
      label,
      embedUrl,
    });
  });
  return channels;
}

async function main() {
  const [sourceResponse, priorText, overridesText] = await Promise.all([
    fetch(SOURCE_URL, {
      headers: { "User-Agent": "cctv-jakarta-map-ingestor/0.1" },
      cache: "no-store",
    }),
    readFile(OUTPUT, "utf8").catch(() => ""),
    readFile(OVERRIDES, "utf8").catch(() => "{}"),
  ]);
  if (!sourceResponse.ok)
    throw new Error(`Source returned ${sourceResponse.status}`);
  const channels = parseRawChannels(await sourceResponse.text());
  if (channels.length < MIN_EXPECTED_CHANNELS)
    throw new Error(
      `Only ${channels.length} valid channels found; preserving last good data.`,
    );
  const previous = priorText ? (JSON.parse(priorText) as CameraDataset) : null;
  const previousById = new Map(
    previous?.sites.map((site) => [site.id, site]) ?? [],
  );
  const overrides = JSON.parse(overridesText) as Record<string, Override>;
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
    if (override && withinJakarta(override.lat, override.lng))
      coordinates = { lat: override.lat, lng: override.lng, source: "manual" };
    else if (
      prior?.coordinates &&
      withinJakarta(prior.coordinates.lat, prior.coordinates.lng)
    )
      coordinates = {
        lat: prior.coordinates.lat,
        lng: prior.coordinates.lng,
        source: "manual",
      };
    if (!coordinates) {
      unresolved.push({ id, name: first.siteName });
      continue;
    }
    const site: CameraSite = {
      id,
      name: first.siteName,
      normalizedName: normalizeText(first.siteName),
      district,
      areaCode: first.areaCode,
      agency: first.agency,
      provider: "Bali Tower",
      address: override?.address ?? prior?.address ?? null,
      catalogSource: "jakarta-public",
      coordinates,
      searchText: normalizeText(
        [
          id,
          first.siteName,
          district,
          first.areaCode,
          first.agency,
          "Bali Tower",
          ...grouped.map((channel) => channel.label),
        ]
          .filter(Boolean)
          .join(" "),
      ),
      channels: grouped.map((channel) => {
        const url = directHlsUrl(channel.embedUrl);
        const channelOverride = override?.channels?.[channel.label];
        const channelCoordinates =
          channelOverride && withinJakarta(channelOverride.lat, channelOverride.lng)
            ? { ...channelOverride, source: "manual" as const }
            : coordinates;
        return {
          id: `${id}-${normalizeText(channel.label).replaceAll(" ", "-")}`,
          label: channel.label,
          coordinates: channelCoordinates,
          embedUrl: channel.embedUrl,
          sourceUrl: channel.embedUrl,
          playback: {
            kind: url ? "hls" : "iframe",
            url,
            embedUrl: channel.embedUrl,
            corsCapture: "unknown",
            checkedAt: null,
            aiEligible: Boolean(url),
          },
        };
      }),
    };
    sites.push(normalizeCameraSite(site));
  }
  const duplicateChannel = sites
    .flatMap((site) => site.channels)
    .some(
      (channel, index, all) =>
        all.findIndex((candidate) => candidate.id === channel.id) !== index,
    );
  if (duplicateChannel) throw new Error("Duplicate channel identifiers found.");
  const dataset: CameraDataset = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    unresolvedCount: unresolved.length,
    sites: sites.sort((a, b) => a.name.localeCompare(b.name, "id")),
  };
  if (!dataset.sites.length)
    throw new Error("No geocoded sites available; preserving last good data.");
  await Promise.all([
    writeFile(OUTPUT, `${JSON.stringify(dataset, null, 2)}\n`),
    writeFile(REVIEW, `${JSON.stringify(unresolved, null, 2)}\n`),
  ]);
  console.log(
    `Published ${dataset.sites.length} sites / ${channels.length} channels; ${unresolved.length} require review.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export { agencyFromPath, directHlsUrl, parseRawChannels };
