export type CoordinateSource = "manual";

export type CameraPlayback = {
  kind: "hls" | "iframe" | "none";
  url: string | null;
  embedUrl: string | null;
  corsCapture: "verified" | "failed" | "unknown";
  checkedAt: string | null;
  aiEligible: boolean;
};

export type CameraChannel = {
  id: string;
  label: string;
  embedUrl: string | null;
  sourceUrl: string;
  playback: CameraPlayback;
};

export type CameraSite = {
  id: string;
  name: string;
  normalizedName: string;
  district: string | null;
  areaCode: string | null;
  agency: string;
  provider: string;
  address: string | null;
  catalogSource: "jakarta-public";
  coordinates: { lat: number; lng: number; source: CoordinateSource };
  searchText: string;
  channels: CameraChannel[];
};

export type CameraDataset = {
  schemaVersion: 2;
  generatedAt: string;
  sourceUrl: string;
  unresolvedCount: number;
  sites: CameraSite[];
};

export type StreamHealth = "available" | "unavailable" | "unknown";
