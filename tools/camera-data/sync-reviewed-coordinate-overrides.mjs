import { readFile, writeFile } from "node:fs/promises";

const datasetPath = new URL(
  "../../data/generated/cameras.json",
  import.meta.url,
);
const overridesPath = new URL(
  "../../data/manual/overrides.json",
  import.meta.url,
);
const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
const previous = JSON.parse(await readFile(overridesPath, "utf8"));
const overrides = {};

for (const site of dataset.sites) {
  overrides[site.id] = {
    ...previous[site.id],
    lat: site.coordinates.lat,
    lng: site.coordinates.lng,
    ...(site.district ? { district: site.district } : {}),
    channels: Object.fromEntries(
      site.channels.map((channel) => [
        channel.label,
        { lat: channel.coordinates.lat, lng: channel.coordinates.lng },
      ]),
    ),
  };
}

await writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`);
