import { describe, expect, it } from "vitest";
import dataset from "../../../data/generated/cameras.json";
import overrides from "../../../data/manual/overrides.json";

describe("reviewed camera positions", () => {
  it("keeps the existing catalog and official playback sources", () => {
    expect(dataset.sites).toHaveLength(32);
    expect(new Set(dataset.sites.map((site) => site.id)).size).toBe(32);
    for (const site of dataset.sites) {
      for (const channel of site.channels) {
        expect([
          "dki-jkt.balitower.co.id",
          "cctv-jsc.balitower.co.id",
        ]).toContain(new URL(channel.sourceUrl).hostname);
        expect(Number.isFinite(channel.coordinates.lat)).toBe(true);
        expect(Number.isFinite(channel.coordinates.lng)).toBe(true);
      }
    }
  });

  it("preserves the two reviewed Tentara Pelajar C04 channel positions", () => {
    const site = dataset.sites.find((candidate) => candidate.id === "503301")!;
    expect(
      site.channels.map(({ id, coordinates }) => ({ id, coordinates })),
    ).toEqual([
      {
        id: "503301-cctv-01",
        coordinates: { lat: -6.218471, lng: 106.791992, source: "manual" },
      },
      {
        id: "503301-cctv-02",
        coordinates: {
          lat: -6.210261518417967,
          lng: 106.79639578465134,
          source: "manual",
        },
      },
    ]);
  });

  it("keeps Bendungan Hilir 003 metadata attached to its current point", () => {
    const site = dataset.sites.find((site) => site.id === "700014")!;
    expect(site.name).toBe("Bendungan Hilir 003");
    expect(site.coordinates).toEqual({
      lat: -6.207523,
      lng: 106.803651,
      source: "manual",
    });
    expect(site.address).toContain("Pejompongan");
  });

  it("does not undo published coordinates on the next ingest", () => {
    for (const site of dataset.sites) {
      const override = (overrides as Record<string, {
        lat: number;
        lng: number;
        channels?: Record<string, { lat: number; lng: number }>;
      }>)[site.id];
      expect(override.lat, site.id).toBe(site.coordinates.lat);
      expect(override.lng, site.id).toBe(site.coordinates.lng);
      for (const channel of site.channels) {
        const channelOverride = override.channels?.[channel.label];
        expect(channelOverride, channel.id).toBeDefined();
        if (!channelOverride) continue;
        expect(channelOverride.lat, channel.id).toBe(channel.coordinates.lat);
        expect(channelOverride.lng, channel.id).toBe(channel.coordinates.lng);
      }
    }
  });
});
