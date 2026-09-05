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
  return intersections.sort((a, b) => b.end - a.end)[0] ?? null;
}
export function mediaTimeFor(ranges: TimeRange[], time: number): number | null {
  const range = ranges.find((r) => time >= r.start && time < r.end);
  return range ? range.mediaStart + (time - range.start) / 1000 : null;
}
