import { describe, expect, it } from "vitest";
import { isModelCatalog, isModelManifest } from "./model-catalog";

describe("AI model catalog", () => {
  it("rejects untrusted model locations", () => {
    expect(isModelManifest({ version: 1, modelUrl: "https://other.test/model.onnx", byteSize: 1, sha256: "a".repeat(64), input: { name: "images", width: 416, height: 416 }, output: { name: "output0", schema: "xyxy-confidence-class" }, modelName: "YOLO26n", variant: "nano", precision: "fp32", license: "test" })).toBe(false);
  });

  it("accepts INT8 manifests but rejects unsupported INT4", () => {
    const manifest = { version: 1, modelUrl: "/models/yolo26n/model.onnx", byteSize: 1, sha256: "a".repeat(64), input: { name: "images", width: 320, height: 320 }, output: { name: "output0", schema: "xyxy-confidence-class" }, modelName: "YOLO26n", variant: "nano", license: "test" };
    expect(isModelManifest({ ...manifest, precision: "int8" })).toBe(true);
    expect(isModelManifest({ ...manifest, precision: "int4" })).toBe(false);
  });

  it("validates a model catalog and its default", () => {
    const manifest = { version: 1 as const, modelUrl: "/models/yolo26n/model.onnx", byteSize: 1, sha256: "a".repeat(64), input: { name: "images", width: 416, height: 416 }, output: { name: "output0", schema: "xyxy-confidence-class" as const }, modelName: "YOLO26n", variant: "nano" as const, precision: "fp16" as const, license: "test" };
    expect(isModelCatalog({ version: 1, defaultModel: "nano-fp16", models: [{ id: "nano-fp16", manifest }] })).toBe(true);
    expect(isModelCatalog({ version: 1, defaultModel: "missing", models: [{ id: "nano-fp16", manifest }] })).toBe(false);
  });
});
