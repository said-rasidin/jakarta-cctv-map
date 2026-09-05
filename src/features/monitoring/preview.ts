/** Only derive snapshots for the known public Bali Tower stream origin. */
export function cameraPreviewUrl(
  value: string | null | undefined,
): string | null {
  try {
    const url = new URL(value ?? "");
    if (
      ![
        "https://dki-jkt.balitower.co.id:7028",
        "https://cctv-jsc.balitower.co.id:8011",
      ].includes(url.origin) ||
      url.username ||
      url.password
    )
      return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 1 || !/^[\w.-]+$/.test(parts[0])) return null;
    return `${url.origin}/${parts[0]}/preview.jpg`;
  } catch {
    return null;
  }
}

export function geographicOrder(latitudes: (number | undefined)[]): string {
  if (latitudes.length < 2) return "Belum cukup kamera";
  if (latitudes.some((lat) => lat == null || !Number.isFinite(lat)))
    return "Manual · koordinat tidak lengkap";
  const values = latitudes as number[];
  if (values.every((lat) => lat === values[0])) return "Manual · lintang sama";
  if (values.every((lat, i) => i === 0 || values[i - 1] >= lat))
    return "Utara → selatan";
  if (values.every((lat, i) => i === 0 || values[i - 1] <= lat))
    return "Selatan → utara";
  return "Manual / campuran";
}
