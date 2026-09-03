import { describe, expect, it } from "vitest";
import { isModelCatalog, isModelManifest, mapModelBoxToSource, parseYoloOutput } from "./ai";

describe("AI model helpers", () => {
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

  it("rejects untrusted model locations", () => {
    expect(isModelManifest({ version: 1, modelUrl: "https://other.test/model.onnx", byteSize: 1, sha256: "a".repeat(64), input: { name: "images", width: 416, height: 416 }, output: { name: "output0", schema: "xyxy-confidence-class" }, modelName: "YOLO26n", variant: "nano", precision: "fp32", license: "test" })).toBe(false);
  });

  it("validates a model catalog and its default", () => {
    const manifest = { version: 1 as const, modelUrl: "/models/yolo26n/model.onnx", byteSize: 1, sha256: "a".repeat(64), input: { name: "images", width: 416, height: 416 }, output: { name: "output0", schema: "xyxy-confidence-class" as const }, modelName: "YOLO26n", variant: "nano" as const, precision: "fp16" as const, license: "test" };
    expect(isModelCatalog({ version: 1, defaultModel: "nano-fp16", models: [{ id: "nano-fp16", manifest }] })).toBe(true);
    expect(isModelCatalog({ version: 1, defaultModel: "missing", models: [{ id: "nano-fp16", manifest }] })).toBe(false);
  });
});
