export const DISPLAYED_CLASS_IDS = new Set([0, 1, 2, 3, 5, 7]);

export const COCO_LABELS: Record<number, string> = {
  0: "orang",
  1: "sepeda",
  2: "mobil",
  3: "motor",
  5: "bus",
  7: "truk",
};

export type Detection = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  classId: number;
};

export type ModelManifest = {
  version: 1;
  modelUrl: string;
  byteSize: number;
  sha256: string;
  input: { name: string; width: number; height: number };
  output: { name: string; schema: "xyxy-confidence-class" };
  modelName: string;
  variant: "nano" | "small" | "medium";
  precision: "fp32" | "fp16";
  license: string;
};

export type ModelCatalog = {
  version: 1;
  defaultModel: string;
  models: Array<{ id: string; manifest: ModelManifest }>;
};

export function isModelManifest(value: unknown): value is ModelManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<ModelManifest>;
  return manifest.version === 1 && typeof manifest.modelUrl === "string" && manifest.modelUrl.startsWith("/models/")
    && typeof manifest.byteSize === "number" && manifest.byteSize > 0
    && typeof manifest.sha256 === "string" && /^[a-f0-9]{64}$/i.test(manifest.sha256)
    && typeof manifest.input?.name === "string" && manifest.input.name.length > 0
    && Number.isInteger(manifest.input.width) && manifest.input.width > 0 && Number.isInteger(manifest.input.height) && manifest.input.height > 0
    && typeof manifest.output?.name === "string" && manifest.output.name.length > 0 && manifest.output.schema === "xyxy-confidence-class"
    && typeof manifest.modelName === "string" && ["nano", "small", "medium"].includes(manifest.variant ?? "")
    && ["fp32", "fp16"].includes(manifest.precision ?? "") && typeof manifest.license === "string";
}

export function isModelCatalog(value: unknown): value is ModelCatalog {
  if (!value || typeof value !== "object") return false;
  const catalog = value as Partial<ModelCatalog>;
  return catalog.version === 1
    && typeof catalog.defaultModel === "string"
    && Array.isArray(catalog.models)
    && catalog.models.length > 0
    && catalog.models.every((entry) => Boolean(entry) && typeof entry.id === "string" && isModelManifest(entry.manifest))
    && catalog.models.some((entry) => entry.id === catalog.defaultModel);
}

export function mapModelBoxToSource(detection: Detection, sourceWidth: number, sourceHeight: number, inputWidth: number, inputHeight: number): Detection {
  const scale = Math.min(inputWidth / sourceWidth, inputHeight / sourceHeight);
  const padX = (inputWidth - sourceWidth * scale) / 2;
  const padY = (inputHeight - sourceHeight * scale) / 2;
  const x = (value: number) => Math.max(0, Math.min(sourceWidth, (value - padX) / scale));
  const y = (value: number) => Math.max(0, Math.min(sourceHeight, (value - padY) / scale));
  return { ...detection, x1: x(detection.x1), y1: y(detection.y1), x2: x(detection.x2), y2: y(detection.y2) };
}

export function parseYoloOutput(values: Float32Array, confidence: number) {
  const detections: Detection[] = [];
  for (let index = 0; index + 5 < values.length; index += 6) {
    const classId = Math.round(values[index + 5]);
    if (values[index + 4] >= confidence && DISPLAYED_CLASS_IDS.has(classId)) {
      detections.push({ x1: values[index], y1: values[index + 1], x2: values[index + 2], y2: values[index + 3], confidence: values[index + 4], classId });
    }
  }
  return detections;
}
