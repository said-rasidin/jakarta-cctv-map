import { describe, expect, it } from "vitest";
import { parseCameraDataset } from "./schema";

const validDataset = {
  schemaVersion: 2,
  generatedAt: "2026-09-03T00:00:00.000Z",
  sourceUrl: "https://jakcctv.jakarta.go.id/publik",
  unresolvedCount: 0,
  sites: [
    {
      id: "camera-1",
      name: "Camera 1",
      normalizedName: "camera 1",
      district: null,
      areaCode: null,
      agency: "Dishub",
      provider: "Bali Tower",
      address: null,
      catalogSource: "jakarta-public",
      coordinates: { lat: -6.2, lng: 106.8, source: "manual" },
      searchText: "camera 1",
      channels: [
        {
          id: "channel-1",
          label: "CCTV-01",
          coordinates: { lat: -6.2, lng: 106.8, source: "manual" },
          embedUrl: null,
          sourceUrl: "https://example.test",
          playback: {
            kind: "none",
            url: null,
            embedUrl: null,
            corsCapture: "unknown",
            checkedAt: null,
            aiEligible: false,
          },
        },
      ],
    },
  ],
} as const;

describe("camera dataset schema", () => {
  it("accepts the supported generated schema", () =>
    expect(parseCameraDataset(validDataset).sites).toHaveLength(1));
  it("rejects malformed sites", () =>
    expect(() =>
      parseCameraDataset({ ...validDataset, sites: [{ id: "broken" }] }),
    ).toThrow("invalid site or channel"));
});
