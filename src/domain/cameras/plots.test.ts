import { describe, expect, it } from "vitest";
import dataset from "../../../data/generated/cameras.json";
import { cameraPlots } from "./plots";
import type { CameraDataset } from "./types";

describe("cameraPlots", () => {
  it("creates separate plots for Tentara Pelajar channels with different coordinates", () => {
    const site = (dataset as CameraDataset).sites.find(
      (candidate) => candidate.id === "503301",
    )!;
    const plots = cameraPlots([site]);

    expect(plots).toHaveLength(2);
    expect(
      plots.map((plot) => plot.channels.map((channel) => channel.id)),
    ).toEqual([["503301-cctv-01"], ["503301-cctv-02"]]);
    expect(plots.map((plot) => plot.coordinates)).toEqual(
      site.channels.map((channel) => channel.coordinates),
    );
  });

  it("keeps channels with identical coordinates on one plot", () => {
    const source = (dataset as CameraDataset).sites.find(
      (site) =>
        site.channels.length > 1 &&
        new Set(
          site.channels.map(
            (channel) =>
              `${channel.coordinates.lat},${channel.coordinates.lng}`,
          ),
        ).size === 1,
    )!;
    expect(cameraPlots([source])).toHaveLength(1);
  });
});
