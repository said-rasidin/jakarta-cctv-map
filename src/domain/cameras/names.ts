import type { CameraSite } from "./types";

const words = (value: string) =>
  value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export function standardRoad(value: string): string {
  const clean = words(value)
    .replace(/^(?:(?:simpang|jpo)\s+)+/i, "")
    .replace(/^(?:jalan|jl)\s+/i, "");
  if (/^(?:letjen\s+)?s\s*parman$/i.test(clean)) return "Jl. Letjen S. Parman";
  if (/^(?:m\s*h|mh)\s+thamrin$/i.test(clean)) return "Jl. M.H. Thamrin";
  if (/^(?:jend\s+)?gatot subroto$/i.test(clean))
    return "Jl. Jend. Gatot Subroto";
  if (/^(?:k\s*h|kh)\s+mas mansyur$/i.test(clean))
    return "Jl. K.H. Mas Mansyur";
  const title = clean
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bUob\b/g, "UOB");
  return /\b(?:jl|jalan)\b/i.test(words(value)) ? `Jl. ${title}` : title;
}

export function nameFromCameraUrl(
  url: string,
): { name: string; roadName: string } | null {
  try {
    const parsed = new URL(url);
    if (
      !["dki-jkt.balitower.co.id", "cctv-jsc.balitower.co.id"].includes(
        parsed.hostname,
      )
    )
      return null;
    const token = decodeURIComponent(
      parsed.pathname.split("/").filter(Boolean)[0] ?? "",
    );
    let location: string;
    if (/^\d+_JK[UBPST]_/.test(token)) {
      location = token.split("_").slice(3, -1).join(" ");
    } else if (/-\d{5,}_\d+$/.test(token)) {
      location = token.replace(/-\d{5,}_\d+$/, "");
    } else return null;
    const suffix = location.match(/[-\s](C\d+|\d{3}|\d+)$/i)?.[1] ?? "";
    const base = suffix ? location.slice(0, -(suffix.length + 1)) : location;
    const roadName = standardRoad(base);
    const prefix = /^SIMPANG[-\s]/i.test(base)
      ? "Simpang "
      : /^JPO[-\s]/i.test(base)
        ? "JPO "
        : "";
    return {
      roadName,
      name: `${prefix}${roadName}${suffix ? ` ${suffix.toUpperCase()}` : ""}`,
    };
  } catch {
    return null;
  }
}

export function normalizeCameraSite(site: CameraSite): CameraSite {
  const names = site.channels.map((channel) =>
    nameFromCameraUrl(channel.sourceUrl),
  );
  const primary = names.find(Boolean);
  if (!primary) return site;
  const sourceName = site.sourceName ?? site.name;
  const normalize = (value: string) => words(value).toLowerCase();
  let searchText = normalize(site.searchText);
  for (const alias of [
    sourceName,
    primary.name,
    ...names.map((name) => name?.roadName ?? ""),
  ]) {
    const value = normalize(alias);
    if (value && !searchText.includes(value)) searchText += ` ${value}`;
  }
  return {
    ...site,
    sourceName,
    name: primary.name,
    roadName: primary.roadName,
    normalizedName: normalize(primary.name),
    searchText,
    channels: site.channels.map((channel, i) => ({
      ...channel,
      roadName: names[i]?.roadName ?? primary.roadName,
    })),
  };
}
