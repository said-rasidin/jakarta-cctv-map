import { readFile, writeFile } from "node:fs/promises";
import { normalizeCameraSite } from "../../src/domain/cameras/names";
import type { CameraDataset } from "../../src/domain/cameras/types";

async function main() {
  const path = "data/generated/cameras.json";
  const data = JSON.parse(await readFile(path, "utf8")) as CameraDataset;
  const protectedValues = (dataset: CameraDataset) =>
    JSON.stringify(
      dataset.sites.map((site) => [
        site.id,
        site.coordinates,
        site.channels.map((channel) => [
          channel.id,
          channel.coordinates,
          channel.sourceUrl,
          channel.embedUrl,
          channel.playback,
        ]),
      ]),
    );
  const before = protectedValues(data);
  const normalized = { ...data, sites: data.sites.map(normalizeCameraSite) };
  if (before !== protectedValues(normalized))
    throw new Error("Normalization changed protected data");
  await writeFile(path, JSON.stringify(normalized, null, 2) + "\n");
  for (let i = 0; i < data.sites.length; i++)
    console.log(
      `${data.sites[i].id}: ${data.sites[i].name} -> ${normalized.sites[i].name}`,
    );
}
void main();
