import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
let streams = 0;
let previews = 0;
const errors = [];
await context.route("**/api/stream-health?**", (route) =>
  route.fulfill({ json: { status: "available" } }),
);
await context.route("**/api/map-tiles/**", (route) =>
  route.fulfill({ status: 204 }),
);
await context.route(
  /https:\/\/(?:dki-jkt|cctv-jsc)\.balitower\.co\.id/,
  (route) => {
    if (route.request().url().endsWith("preview.jpg")) {
      previews++;
      return route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#1856ba"/><text x="80" y="180" fill="white" font-size="28">Synthetic camera preview</text></svg>',
      });
    }
    streams++;
    return route.abort();
  },
);
try {
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:3107");
  await page
    .getByRole("button", { name: "Buka monitor (0)", exact: true })
    .click();
  await page
    .getByLabel("Filter ruas monitor")
    .selectOption("Jl. Letjen S. Parman");
  const add = page.getByRole("button").filter({ hasText: "Tambah ke monitor" });
  for (let i = 0; i < 4; i++) await add.first().click();
  const tiles = page.getByTestId("monitor-tile");
  await expect(tiles.locator("img")).toHaveCount(4);
  await expect
    .poll(() =>
      tiles
        .locator("img")
        .evaluateAll((images) =>
          images.every((img) => img.complete && img.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await expect(page.locator("video, iframe")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Atur utara → selatan", exact: true })
    .click();
  await expect(
    page.getByText("Utara → selatan", { exact: true }),
  ).toBeVisible();
  const before = await tiles.evaluateAll((items) =>
    items.map((item) => item.dataset.cameraId),
  );
  await page.getByRole("button", { name: "Balik urutan", exact: true }).click();
  await expect(
    page.getByText("Selatan → utara", { exact: true }),
  ).toBeVisible();
  expect(
    await tiles.evaluateAll((items) =>
      items.map((item) => item.dataset.cameraId),
    ),
  ).toEqual([...before].reverse());
  const sourceId = await tiles.first().getAttribute("data-camera-id");
  const handle = tiles
    .first()
    .getByRole("button", { name: "Geser urutan kamera 1" });
  await handle.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox();
  const to = await tiles.nth(1).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 30, to.y + 30, { steps: 12 });
  await page.mouse.up();
  await expect(tiles.nth(1)).toHaveAttribute("data-camera-id", sourceId);
  await expect(page.getByText(/Kamera 1 dipindah ke posisi 2/)).toBeVisible();
  await tiles
    .nth(1)
    .getByRole("button", { name: "Geser urutan kamera 2" })
    .focus();
  await page.keyboard.press("ArrowLeft");
  await expect(tiles.first()).toHaveAttribute("data-camera-id", sourceId);
  await page.screenshot({ path: "out/monitor-ux-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(tiles.locator("img")).toHaveCount(2);
  await page.getByRole("button", { name: "Selesai mengatur" }).click();
  await tiles.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "out/monitor-ux-mobile.png", fullPage: true });
  // Touch pointer path uses the same handle without relying on unsupported native HTML drag on mobile.
  await page.getByRole("button", { name: "Atur", exact: true }).click();
  const touchHandle = tiles
    .first()
    .getByRole("button", { name: "Geser urutan kamera 1" });
  await touchHandle.evaluate((element) => {
    element.setPointerCapture = () => {};
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 7,
        pointerType: "touch",
        button: 0,
        clientX: 0,
        clientY: 0,
      }),
    );
  });
  await tiles.nth(1).scrollIntoViewIfNeeded();
  const touchTo = await tiles.nth(1).boundingBox();
  await touchHandle.dispatchEvent("pointerup", {
    pointerId: 7,
    pointerType: "touch",
    clientX: touchTo.x + 20,
    clientY: Math.max(1, touchTo.y + 20),
  });
  await expect(tiles.nth(1)).toHaveAttribute("data-camera-id", sourceId);
  // Failed snapshots remain understandable and never start video.
  await tiles.nth(1).locator("img").dispatchEvent("error");
  await expect(
    tiles.nth(1).getByText("Pratinjau tidak tersedia"),
  ).toBeVisible();
  if (streams !== 0)
    throw new Error(`Unexpected media requests before Start: ${streams}`);
  expect(errors).toEqual([]);
  console.log(
    `PASS: ${previews} snapshot requests, no streams; preview/error UI, actual reverse direction, mouse drag, keyboard reorder, simulated touch, mobile preview limit.`,
  );
} finally {
  await browser.close();
}
