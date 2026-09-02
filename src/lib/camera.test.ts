import { describe, expect, it } from "vitest";
import { cameraGroup, distanceInKm, filterSites, findReferenceCamera, normalizeReferenceCoordinates, normalizeText, withinJakarta } from "./camera";
import type { CameraSite } from "./types";

const site: CameraSite = {
  id: "501844", name: "Jl. MH. Thamrin C01", normalizedName: "jl mh thamrin c01", district: "Menteng", areaCode: "JKP", agency: "Dishub", provider: "Bali Tower", address: null, catalogSource: "balitower",
  coordinates: { lat: -6.1912, lng: 106.8234, source: "override" }, searchText: "501844 jl mh thamrin c01 menteng jkp dishub bali tower cctv 01", channels: [{ id: "501844-cctv-01", label: "CCTV-01", embedUrl: "https://dki-jkt.balitower.co.id:7028/a/embed.html", sourceUrl: "https://dki-jkt.balitower.co.id:7028/a/embed.html" }],
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
  it("restores omitted decimal separators from reference coordinates", () => {
    expect(normalizeReferenceCoordinates(-6205554523, 1068076439)).toEqual({ lat: -6.205554523, lng: 106.8076439 });
    expect(normalizeReferenceCoordinates(-7, 106.8)).toBeNull();
  });
  it("groups numbered cameras by a useful street or location label", () => {
    expect(cameraGroup({ name: "Bendungan Hilir 003", address: null })).toEqual({ key: "bendungan hilir", label: "Bendungan Hilir" });
    expect(cameraGroup({ name: "Gelora 015", address: "Jl. Gerbang Pemuda (seberang TVRI)" })).toEqual({ key: "jl gerbang pemuda", label: "Jl. Gerbang Pemuda" });
    expect(cameraGroup({ name: "JKP DISHUB JL. MH. THAMRIN C01", address: null }).key).toBe("jl mh thamrin");
  });
  it("matches direct-stream names to the nearest reference street", () => {
    const references = [
      { id: 1, name: "Gelora 015", address: "Jl. Gerbang Pemuda", lat: -6.213496, lng: 106.802207 },
      { id: 2, name: "Gelora 018", address: "Jl. Gerbang Pemuda", lat: -6.218833, lng: 106.798 },
    ];
    expect(findReferenceCamera("JKP POLDA JL. GERBANG PEMUDA C03", { lat: -6.22, lng: 106.798 }, references)?.id).toBe(2);
  });
});
