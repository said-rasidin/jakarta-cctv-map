import { describe, expect, it } from "vitest";
import { cameraPreviewUrl, geographicOrder } from "./preview";

describe("monitor previews and ordering", () => {
  it("derives a snapshot without changing the stream URL", () => {
    const origin = "https://dki-jkt.balitower.co.id:7028";
    expect(
      cameraPreviewUrl(`${origin}/502491_JKP_CCTV-01/index.m3u8?token=x`),
    ).toBe(`${origin}/502491_JKP_CCTV-01/preview.jpg`);
    expect(
      cameraPreviewUrl(
        "https://cctv-jsc.balitower.co.id:8011/Senayan-018-705979_2/embed.html",
      ),
    ).toBe(
      "https://cctv-jsc.balitower.co.id:8011/Senayan-018-705979_2/preview.jpg",
    );
  });
  it("rejects unrelated origins and malformed inputs", () => {
    for (const input of [
      null,
      "invalid",
      "https://evil.test/cctv/index.m3u8",
      "https://dki-jkt.balitower.co.id:7028.evil.test/a",
      "https://dki-jkt.balitower.co.id:7028/",
    ])
      expect(cameraPreviewUrl(input)).toBeNull();
  });
  it("describes the actual order including reverse, ties and manual arrangements", () => {
    expect(geographicOrder([-6.1, -6.2, -6.3])).toBe("Utara → selatan");
    expect(geographicOrder([-6.3, -6.2, -6.1])).toBe("Selatan → utara");
    expect(geographicOrder([-6.1, -6.3, -6.2])).toBe("Manual / campuran");
    expect(geographicOrder([-6.1, -6.1])).toBe("Manual · lintang sama");
    expect(geographicOrder([undefined, -6.1])).toContain("tidak lengkap");
  });
});
