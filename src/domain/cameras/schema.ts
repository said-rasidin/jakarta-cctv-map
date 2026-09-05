import type { CameraDataset } from "./types";

export function parseCameraDataset(value: unknown): CameraDataset {
  if (!value || typeof value !== "object")
    throw new Error("Camera dataset must be an object.");
  const dataset = value as Partial<CameraDataset>;
  if (
    dataset.schemaVersion !== 2 ||
    typeof dataset.generatedAt !== "string" ||
    !Array.isArray(dataset.sites)
  ) {
    throw new Error("Camera dataset has an unsupported schema.");
  }
  if (
    !dataset.sites.every(
      (site) =>
        typeof site?.id === "string" &&
        typeof site.name === "string" &&
        Number.isFinite(site.coordinates?.lat) &&
        Number.isFinite(site.coordinates?.lng) &&
        Array.isArray(site.channels) &&
        site.channels.every(
          (channel) =>
            typeof channel?.id === "string" &&
            typeof channel.sourceUrl === "string" &&
            Number.isFinite(channel.coordinates?.lat) &&
            Number.isFinite(channel.coordinates?.lng),
        ),
    )
  ) {
    throw new Error("Camera dataset contains an invalid site or channel.");
  }
  return dataset as CameraDataset;
}
