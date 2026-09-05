export type TimeRange = {
  start: number;
  end: number;
  mediaStart: number;
  cc: number;
};
export type PlaybackSnapshot = {
  time: number | null;
  sampledAt: number;
  playing: boolean;
  ranges: TimeRange[];
};
export type PlayerController = {
  snapshot: () => PlaybackSnapshot;
  seekTime: (time: number) => boolean;
  setRate: (rate: number) => void;
  setAligned: (aligned: boolean) => void;
  goLive: () => void;
};
export function commonWindow(
  groups: TimeRange[][],
  preferredTime?: number,
): { start: number; end: number } | null {
  if (!groups.length) return null;
  let intersections = groups[0].map(({ start, end }) => ({ start, end }));
  for (const ranges of groups.slice(1))
    intersections = intersections.flatMap((a) =>
      ranges
        .map((b) => ({
          start: Math.max(a.start, b.start),
          end: Math.min(a.end, b.end),
        }))
        .filter((r) => r.end > r.start),
    );
  // Adjacent HLS fragments form one playable interval; preserve real gaps.
  const merged: { start: number; end: number }[] = [];
  for (const interval of intersections.sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  if (preferredTime != null && Number.isFinite(preferredTime)) {
    const distance = (r: { start: number; end: number }) =>
      Math.max(r.start - preferredTime, preferredTime - r.end, 0);
    return merged.sort((a, b) => distance(a) - distance(b) || b.end - a.end)[0] ?? null;
  }
  return merged.at(-1) ?? null;
}
export function mediaTimeFor(ranges: TimeRange[], time: number): number | null {
  const range = ranges.find((r) => time >= r.start && time < r.end);
  return range ? range.mediaStart + (time - range.start) / 1000 : null;
}
