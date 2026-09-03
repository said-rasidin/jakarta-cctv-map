import { NextRequest, NextResponse } from "next/server";
import dataset from "#data/cameras.json";
import type { CameraDataset, StreamHealth } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedHosts = new Set(["dki-jkt.balitower.co.id", "cctv-jsc.balitower.co.id"]);
const allowedPorts = new Set(["7028", "8011"]);

async function check(channel: CameraDataset["sites"][number]["channels"][number]): Promise<StreamHealth> {
  if (!channel.playback.url) return "unknown";
  const target = new URL(channel.playback.url);
  if (target.protocol !== "https:" || !allowedHosts.has(target.hostname) || !allowedPorts.has(target.port)) return "unavailable";
  try {
    const response = await fetch(target, { method: "GET", headers: { Origin: requestOrigin, "User-Agent": "cctv-jakarta-map-health/0.2" }, cache: "no-store", signal: AbortSignal.timeout(7000) });
    if (!response.ok) { await response.body?.cancel(); return "unavailable"; }
    const playlist = await response.text();
    return playlist.startsWith("#EXTM3U") ? "available" : "unavailable";
  } catch {
    return "unknown";
  }
}

const requestOrigin = "http://localhost:3000";

export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channelId");
  const requestedIds = channelId ? [channelId] : (request.nextUrl.searchParams.get("channelIds") ?? "").split(",").filter(Boolean).slice(0, 60);
  if (!requestedIds.length) return NextResponse.json({ status: "unknown" satisfies StreamHealth }, { status: 400 });
  const channels = new Map((dataset as CameraDataset).sites.flatMap((site) => site.channels).map((channel) => [channel.id, channel]));
  const statuses: Record<string, StreamHealth> = {};
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(6, requestedIds.length) }, async () => {
    while (cursor < requestedIds.length) {
      const id = requestedIds[cursor++];
      const channel = channels.get(id);
      statuses[id] = channel ? await check(channel) : "unknown";
    }
  }));
  if (channelId) {
    return NextResponse.json({ status: statuses[channelId] }, { headers: { "Cache-Control": "public, max-age=30" } });
  }
  return NextResponse.json({ statuses }, { headers: { "Cache-Control": "public, max-age=30" } });
}
