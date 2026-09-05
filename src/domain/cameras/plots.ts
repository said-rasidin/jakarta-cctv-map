import type { CameraChannel, CameraSite } from "./types";

export type CameraPlot = {
  site: CameraSite;
  channels: CameraChannel[];
  coordinates: CameraChannel["coordinates"];
};

export function cameraPlots(sites: CameraSite[]): CameraPlot[] {
  return sites.flatMap((site) => {
    const groups = Map.groupBy(
      site.channels,
      (channel) => `${channel.coordinates.lat},${channel.coordinates.lng}`,
    );
    return [...groups.values()].map((channels) => ({
      site,
      channels,
      coordinates: channels[0].coordinates,
    }));
  });
}
