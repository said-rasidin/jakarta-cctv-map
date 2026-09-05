// Read-only diagnostic: playlists only, never video segments or credentials.
import { readFile } from "node:fs/promises";
const data = JSON.parse(await readFile("data/generated/cameras.json", "utf8"));
const channels = data.sites.filter((site) => site.roadName === "Jl. Letjen S. Parman").flatMap((site) => site.channels).slice(0, 4);
async function playlist(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Origin: "http://localhost:3000" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { text: await response.text(), cors: response.headers.get("access-control-allow-origin") };
}
for (let round = 0; round < 3; round++) {
  await Promise.all(channels.map(async (channel) => {
    try {
      let url = channel.playback.url; let result = await playlist(url);
      if (result.text.includes("#EXT-X-STREAM-INF")) {
        const variant = result.text.split(/\r?\n/).find((line) => line.trim() && !line.startsWith("#"));
        url = new URL(variant, url).href;
        if (new URL(url).hostname !== new URL(channel.playback.url).hostname) throw new Error("Unexpected variant host");
        result = await playlist(url);
      }
      const dates = [...result.text.matchAll(/#EXT-X-PROGRAM-DATE-TIME:(.+)/g)].map((m) => m[1]);
      const durations = [...result.text.matchAll(/#EXTINF:([\d.]+)/g)].map((m) => Number(m[1]));
      console.log(JSON.stringify({ round, id: channel.id, sampledAt: new Date().toISOString(), cors: result.cors, dates, windowSeconds: durations.reduce((a, b) => a + b, 0), discontinuities: (result.text.match(/#EXT-X-DISCONTINUITY\r?\n/g) ?? []).length }));
    } catch (error) { console.log(JSON.stringify({ round, id: channel.id, error: error.message })); }
  }));
  if (round < 2) await new Promise((resolve) => setTimeout(resolve, 3000));
}
