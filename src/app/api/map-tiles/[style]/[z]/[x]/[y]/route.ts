const styles: Record<string, string> = { light: "light_all", dark: "dark_all" };

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ style: string; z: string; x: string; y: string }>;
  },
) {
  const { style, z, x, y } = await context.params;
  const tileStyle = Object.hasOwn(styles, style) ? styles[style] : null;
  const row = /^(\d+)(@2x)?\.png$/.exec(y);
  if (!tileStyle || !/^\d+$/.test(z) || !/^\d+$/.test(x) || !row) {
    return new Response("Invalid tile", { status: 400 });
  }
  const zoom = Number(z);
  if (zoom > 20 || Number(x) >= 2 ** zoom || Number(row[1]) >= 2 ** zoom) {
    return new Response("Invalid tile coordinates", { status: 400 });
  }
  // Compatibility with the originally documented variable; use a basemap key,
  // not a CARTO account token. Never serialize either value to the browser.
  const key = (
    process.env.CARTO_BASEMAP_API_KEY || process.env.CARTO_API_ACCESS_TOKEN
  )?.trim();
  if (!key || key === "your_token_here" || key === "your_basemap_key_here") {
    return new Response(
      "Configure CARTO_BASEMAP_API_KEY with a CARTO basemap key",
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  const url = new URL(
    `https://basemaps.cartocdn.com/${tileStyle}/${zoom}/${Number(x)}/${Number(row[1])}${row[2] ?? ""}.png`,
  );
  url.searchParams.set("key", key);
  try {
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
      redirect: "error",
    });
    if (
      !upstream.ok ||
      !upstream.headers.get("content-type")?.startsWith("image/png")
    ) {
      return new Response("Map tile unavailable", {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return new Response(await upstream.arrayBuffer(), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch {
    return new Response("Map tile unavailable", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
