import { describe, expect, it, vi } from "vitest";
import {
  commonWindow,
  mediaTimeFor,
  type PlayerController,
  type PlaybackSnapshot,
  type TimeRange,
} from "@/features/video/controller";
import { Synchronizer } from "./synchronizer";
const range = (start: number, end: number, mediaStart = 0): TimeRange => ({
  start,
  end,
  mediaStart,
  cc: 0,
});
function player(time: number | null, ranges = [range(0, 30000)]) {
  const sample: PlaybackSnapshot = {
    time,
    ranges,
    playing: true,
    sampledAt: 0,
  };
  const controller: PlayerController = {
    snapshot: () => ({ ...sample }),
    setRate: vi.fn(),
    setAligned: vi.fn(),
    goLive: vi.fn(),
    seekTime: vi.fn(() => true),
  };
  return { sample, controller };
}
describe("program-time synchronization", () => {
  it("maps independent timelines and never seeks into missing intervals", () => {
    expect(mediaTimeFor([range(10000, 20000, 50)], 12000)).toBe(52);
    expect(mediaTimeFor([range(0, 1000), range(5000, 6000)], 3000)).toBeNull();
    expect(commonWindow([[range(0, 10000)], [range(5000, 12000)]])).toEqual({
      start: 5000,
      end: 10000,
    });
    expect(commonWindow([[range(0, 1000)], [range(5000, 6000)]])).toBeNull();
  });
  it("requires advancing dates and bounds repeated seeks", () => {
    const a = player(1000),
      b = player(8000);
    const pool = new Map([
      ["a", a.controller],
      ["b", b.controller],
    ]);
    const sync = new Synchronizer();
    expect(sync.tick(pool, 0).members).toEqual([]);
    a.sample.time = 2000;
    b.sample.time = 9000;
    a.sample.sampledAt = b.sample.sampledAt = 1000;
    expect(sync.tick(pool, 1000).members).toEqual(["a", "b"]);
    expect(a.controller.seekTime).toHaveBeenCalledTimes(1);
    a.sample.time = 3000;
    b.sample.time = 10000;
    a.sample.sampledAt = b.sample.sampledAt = 2000;
    sync.tick(pool, 2000);
    expect(a.controller.seekTime).toHaveBeenCalledTimes(1);
    sync.reset(pool);
    expect(a.controller.setAligned).toHaveBeenLastCalledWith(false);
    expect(a.controller.setRate).toHaveBeenLastCalledWith(1);
  });
  it("excludes missing metadata, stalls and timestamp discontinuities", () => {
    const a = player(1000),
      b = player(null);
    const pool = new Map([
      ["a", a.controller],
      ["b", b.controller],
    ]);
    const sync = new Synchronizer();
    sync.tick(pool, 0);
    a.sample.time = 2000;
    a.sample.sampledAt = 1000;
    expect(sync.tick(pool, 1000).members).toEqual([]);
    b.sample.time = 1000;
    b.sample.sampledAt = 1000;
    sync.tick(pool, 1000);
    a.sample.time = 1000000;
    b.sample.time = 2000;
    a.sample.sampledAt = b.sample.sampledAt = 2000;
    expect(sync.tick(pool, 2000).members).toEqual([]);
    a.sample.playing = false;
    expect(sync.tick(pool, 3000).members).toEqual([]);
  });
});
