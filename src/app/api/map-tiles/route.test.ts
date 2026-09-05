import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./[style]/[z]/[x]/[y]/route";

const request = (style = "light", z = "12", x = "3262", y = "2118.png") =>
  GET(new Request("http://localhost/api/map-tiles"), {
    params: Promise.resolve({ style, z, x, y }),
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CARTO tile proxy", () => {
  it("adds the encoded server key without exposing it in the response", async () => {
    vi.stubEnv("CARTO_BASEMAP_API_KEY", "test+key&value");
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: { "Content-Type": "image/png" },
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const response = await request("dark", "12", "3262", "2118@2x.png");
    const url = fetcher.mock.calls[0][0] as URL;
    expect(url.hostname).toBe("basemaps.cartocdn.com");
    expect(url.pathname).toBe("/dark_all/12/3262/2118@2x.png");
    expect(url.searchParams.get("key")).toBe("test+key&value");
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("s-maxage");
  });

  it("supports the existing environment variable", async () => {
    vi.stubEnv("CARTO_BASEMAP_API_KEY", "");
    vi.stubEnv("CARTO_API_ACCESS_TOKEN", "legacy-basemap-key");
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response("png", { headers: { "Content-Type": "image/png" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect((await request()).status).toBe(200);
    expect((fetcher.mock.calls[0][0] as URL).searchParams.get("key")).toBe(
      "legacy-basemap-key",
    );
  });

  it("rejects placeholders and invalid coordinates without upstream requests", async () => {
    vi.stubEnv("CARTO_BASEMAP_API_KEY", "your_basemap_key_here");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect((await request()).status).toBe(503);
    expect((await request("__proto__")).status).toBe(400);
    expect((await request("light", "21")).status).toBe(400);
    expect((await request("light", "1", "2", "0.png")).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not forward or cache upstream errors", async () => {
    vi.stubEnv("CARTO_BASEMAP_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("private upstream details", { status: 403 }),
        ),
    );
    const response = await request();
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("Map tile unavailable");
  });
});
