import { describe, expect, it } from "vitest";
import { cameraGroup, distanceInKm, filterSites, normalizeText, withinJakarta } from "./camera";
import type { CameraSite } from "@/domain/cameras/types";

const site: CameraSite = {
  id: "501844", name: "Jl. MH. Thamrin C01", normalizedName: "jl mh thamrin c01", district: "Menteng", areaCode: "JKP", agency: "Dishub", provider: "Bali Tower", address: null, catalogSource: "jakarta-public",
  coordinates: { lat: -6.1912, lng: 106.8234, source: "manual" }, searchText: "501844 jl mh thamrin c01 menteng jkp dishub bali tower cctv 01", channels: [{ id: "501844-cctv-01", label: "CCTV-01", embedUrl: "https://dki-jkt.balitower.co.id:7028/a/embed.html", sourceUrl: "https://dki-jkt.balitower.co.id:7028/a/embed.html", playback: { kind: "hls", url: "https://dki-jkt.balitower.co.id:7028/a/index.m3u8", embedUrl: "https://dki-jkt.balitower.co.id:7028/a/embed.html", corsCapture: "unknown", checkedAt: null, aiEligible: true } }],
};

describe("camera utilities", () => {
  it("normalizes accented and punctuation-heavy queries", () => expect(normalizeText("Ménténg / Jl. MH.")).toBe("menteng jl mh"));
  it("filters by query and selected agency", () => {
    expect(filterSites([site], "menteng", new Set()).length).toBe(1);
    expect(filterSites([site], "thamrin", new Set(["Dishub"])).length).toBe(1);
    expect(filterSites([site], "thamrin", new Set(["Polda"])).length).toBe(0);
  });
  it("calculates nearby distances and rejects out-of-bound coordinates", () => {
    expect(distanceInKm(site.coordinates, { lat: -6.192, lng: 106.824 })).toBeLessThan(1);
    expect(withinJakarta(site.coordinates.lat, site.coordinates.lng)).toBe(true);
    expect(withinJakarta(-7, 106.8)).toBe(false);
  });
  it("groups numbered cameras by a useful street or location label", () => {
    expect(cameraGroup({ name: "Bendungan Hilir 003", address: null })).toEqual({ key: "bendungan hilir", label: "Bendungan Hilir" });
    expect(cameraGroup({ name: "Gelora 015", address: "Jl. Gerbang Pemuda (seberang TVRI)" })).toEqual({ key: "jl gerbang pemuda", label: "Jl. Gerbang Pemuda" });
    expect(cameraGroup({ name: "JKP DISHUB JL. MH. THAMRIN C01", address: null }).key).toBe("jl mh thamrin");
  });
});
