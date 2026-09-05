import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../../data/generated/cameras.json", import.meta.url);
const dataset = JSON.parse(await readFile(path, "utf8"));

for (const site of dataset.sites) {
  for (const channel of site.channels) {
    channel.coordinates ??= { ...site.coordinates };
  }
}

await writeFile(path, `${JSON.stringify(dataset, null, 2)}\n`);
