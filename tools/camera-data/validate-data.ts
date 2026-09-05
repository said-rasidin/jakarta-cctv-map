import dataset from "../../data/generated/cameras.json";
import { withinJakarta } from "../../src/domain/cameras/camera";
import type { CameraDataset } from "../../src/domain/cameras/types";

const value = dataset as CameraDataset;
if (value.schemaVersion !== 2 || !value.sites.length)
  throw new Error("Camera dataset is empty or uses an unsupported schema.");
if (value.sourceUrl !== "https://jakcctv.jakarta.go.id/publik")
  throw new Error(
    "Camera dataset does not use the official Jakarta public directory.",
  );
for (const site of value.sites) {
  if (site.catalogSource !== "jakarta-public")
    throw new Error(
      `${site.id} does not come from the Jakarta public directory.`,
    );
  if (!withinJakarta(site.coordinates.lat, site.coordinates.lng))
    throw new Error(`${site.id} has coordinates outside Jakarta.`);
  if (!site.channels.length) throw new Error(`${site.id} has no channels.`);
  for (const channel of site.channels) {
    if (!withinJakarta(channel.coordinates.lat, channel.coordinates.lng))
      throw new Error(`${channel.id} has coordinates outside Jakarta.`);
    if (channel.embedUrl !== null && !channel.embedUrl.startsWith("https://"))
      throw new Error(`${channel.id} does not use HTTPS.`);
    if (channel.embedUrl === null)
      throw new Error(`${channel.id} is missing a direct public stream URL.`);
    const host = new URL(channel.embedUrl).hostname;
    if (!["dki-jkt.balitower.co.id", "cctv-jsc.balitower.co.id"].includes(host))
      throw new Error(`${channel.id} uses an unapproved stream host.`);
    if (
      channel.playback.kind !== "hls" ||
      !channel.playback.url ||
      !channel.playback.aiEligible
    )
      throw new Error(
        `${channel.id} has no AI-eligible HLS playback metadata.`,
      );
    const playbackUrl = new URL(channel.playback.url);
    if (
      playbackUrl.protocol !== "https:" ||
      playbackUrl.pathname.split("/").at(-1) !== "index.m3u8"
    )
      throw new Error(`${channel.id} has an invalid HLS URL.`);
    if (
      !["dki-jkt.balitower.co.id", "cctv-jsc.balitower.co.id"].includes(
        playbackUrl.hostname,
      )
    )
      throw new Error(`${channel.id} uses an unapproved HLS host.`);
  }
}
console.log(
  `Validated ${value.sites.length} sites and ${value.sites.flatMap((site) => site.channels).length} channels.`,
);
