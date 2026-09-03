import { describe, expect, it } from "vitest";
import { mapModelBoxToSource, parseYoloOutput } from "./postprocess";

describe("detection post-processing", () => {
  it("filters low confidence and non-traffic classes", () => {
    const values = new Float32Array([10, 20, 30, 40, 0.8, 2, 1, 2, 3, 4, 0.2, 0, 1, 2, 3, 4, 0.9, 14]);
    expect(parseYoloOutput(values, 0.35)).toEqual([{ x1: 10, y1: 20, x2: 30, y2: 40, confidence: expect.closeTo(0.8), classId: 2 }]);
  });

  it("undoes square letterboxing", () => {
    const mapped = mapModelBoxToSource({ x1: 0, y1: 91, x2: 416, y2: 325, confidence: 1, classId: 0 }, 1920, 1080, 416, 416);
    expect(mapped.x1).toBeCloseTo(0);
    expect(mapped.y1).toBeCloseTo(0, 0);
    expect(mapped.x2).toBeCloseTo(1920);
    expect(mapped.y2).toBeCloseTo(1080, 0);
  });
});
