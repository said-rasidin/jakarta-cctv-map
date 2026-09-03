export type ModelVariant = "nano" | "small" | "medium";
export type ModelPrecision = "fp32" | "fp16" | "int8";

export type ModelManifest = {
  version: 1;
  modelUrl: string;
  byteSize: number;
  sha256: string;
  input: { name: string; width: number; height: number };
  output: { name: string; schema: "xyxy-confidence-class" };
  modelName: string;
  variant: ModelVariant;
  precision: ModelPrecision;
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
    && ["fp32", "fp16", "int8"].includes(manifest.precision ?? "") && typeof manifest.license === "string";
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
