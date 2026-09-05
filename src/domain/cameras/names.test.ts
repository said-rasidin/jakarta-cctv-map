import { describe, expect, it } from "vitest";
import data from "../../../data/generated/cameras.json";
import { nameFromCameraUrl, normalizeCameraSite, standardRoad } from "./names";
import { parseCameraDataset } from "./schema";

describe("URL-derived road names", () => {
  it("groups punctuation and street prefixes consistently", () => {
    for (const name of [
      "SIMPANG-JL.-LETJEN.-S.-PARMAN",
      "Jl. Letjen S. Parman",
      "S Parman",
    ])
      expect(standardRoad(name)).toBe("Jl. Letjen S. Parman");
    for (const name of ["JL.-MH.-THAMRIN", "Jl M H Thamrin"])
      expect(standardRoad(name)).toBe("Jl. M.H. Thamrin");
    expect(standardRoad("JPO-JL.-GATOT-SUBROTO")).toBe(
      "Jl. Jend. Gatot Subroto",
    );
  });
  it("retains area camera numbers but removes provider IDs", () => {
    expect(
      nameFromCameraUrl(
        "https://cctv-jsc.balitower.co.id:8011/Senayan-018-705979_2/embed.html",
      ),
    ).toEqual({ name: "Senayan 018", roadName: "Senayan" });
    expect(nameFromCameraUrl("https://example.com/foo")).toBeNull();
  });
  it("keeps current coordinates, URLs and identity untouched and is idempotent", () => {
    for (const site of parseCameraDataset(data).sites) {
      const next = normalizeCameraSite(site);
      expect(normalizeCameraSite(next)).toEqual(next);
      expect(next.id).toBe(site.id);
      expect(next.coordinates).toEqual(site.coordinates);
      expect(
        next.channels.map(({ roadName: _road, ...channel }) => channel),
      ).toEqual(
        site.channels.map(({ roadName: _road, ...channel }) => channel),
      );
      expect(next.roadName).toBe(
        nameFromCameraUrl(site.channels[0].sourceUrl)?.roadName,
      );
    }
  });
  it("uses URL location for renamed sites and keeps original search aliases", () => {
    const site = parseCameraDataset(data).sites.find(
      (site) => site.id === "503343",
    )!;
    expect(site.roadName).toBe("Jl. Cideng Timur");
    expect(site.searchText).toContain("mas mansyur");
  });
});
