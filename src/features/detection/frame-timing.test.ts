import { describe, expect, it } from "vitest";
import { remainingFrameLifetime } from "./frame-timing";

describe("frame freshness", () => {
  it("expires slow inference even when the video has stalled", () => {
    expect(remainingFrameLifetime(800, 1000, 1000)).toBe(0);
  });
  it("rejects results after forward or backward seeks", () => {
    expect(remainingFrameLifetime(100, 1000, 3000)).toBe(0);
    expect(remainingFrameLifetime(100, 3000, 1000)).toBe(0);
  });
  it("only displays a fresh result for its remaining lifetime", () => {
    expect(remainingFrameLifetime(120, 1000, 1250)).toBe(250);
    expect(remainingFrameLifetime(Number.NaN, 1000, 1100)).toBe(0);
  });
});
