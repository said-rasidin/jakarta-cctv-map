// Bound the age of overlays against both wall time and the video timeline.
export const MAX_FRAME_AGE_MS = 500;

export function remainingFrameLifetime(latencyMs: number, capturedMediaMs: number, currentMediaMs: number) {
  const age = Math.max(latencyMs, Math.abs(currentMediaMs - capturedMediaMs));
  return Number.isFinite(age) ? Math.max(0, MAX_FRAME_AGE_MS - age) : 0;
}
