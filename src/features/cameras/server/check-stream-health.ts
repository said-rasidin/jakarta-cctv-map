import type { CameraChannel, StreamHealth } from "@/domain/cameras/types";

const ALLOWED_HOSTS = new Set(["dki-jkt.balitower.co.id", "cctv-jsc.balitower.co.id"]);
const ALLOWED_PORTS = new Set(["7028", "8011"]);
const REQUEST_ORIGIN = "http://localhost:3000";

export async function checkStreamHealth(channel: CameraChannel): Promise<StreamHealth> {
  if (!channel.playback.url) return "unknown";
  const target = new URL(channel.playback.url);
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname) || !ALLOWED_PORTS.has(target.port)) return "unavailable";

  try {
    const response = await fetch(target, {
      method: "GET",
      headers: { Origin: REQUEST_ORIGIN, "User-Agent": "cctv-jakarta-map-health/0.2" },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return "unavailable";
    }
    const playlist = await response.text();
    return playlist.startsWith("#EXTM3U") ? "available" : "unavailable";
  } catch {
    return "unknown";
  }
}
