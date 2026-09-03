import { NextRequest, NextResponse } from "next/server";
import dataset from "#data/generated/cameras.json";
import { parseCameraDataset } from "@/domain/cameras/schema";
import type { StreamHealth } from "@/domain/cameras/types";
import { checkStreamHealth } from "@/features/cameras/server/check-stream-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cameraDataset = parseCameraDataset(dataset);

export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channelId");
  const requestedIds = channelId ? [channelId] : (request.nextUrl.searchParams.get("channelIds") ?? "").split(",").filter(Boolean).slice(0, 60);
  if (!requestedIds.length) return NextResponse.json({ status: "unknown" satisfies StreamHealth }, { status: 400 });
  const channels = new Map(cameraDataset.sites.flatMap((site) => site.channels).map((channel) => [channel.id, channel]));
  const statuses: Record<string, StreamHealth> = {};
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(6, requestedIds.length) }, async () => {
    while (cursor < requestedIds.length) {
      const id = requestedIds[cursor++];
      const channel = channels.get(id);
      statuses[id] = channel ? await checkStreamHealth(channel) : "unknown";
    }
  }));
  if (channelId) {
    return NextResponse.json({ status: statuses[channelId] }, { headers: { "Cache-Control": "public, max-age=30" } });
  }
  return NextResponse.json({ statuses }, { headers: { "Cache-Control": "public, max-age=30" } });
}
