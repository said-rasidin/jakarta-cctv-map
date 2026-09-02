export type CoordinateSource = "override" | "nominatim" | "cached" | "streetside";

export type CameraChannel = {
  id: string;
  label: string;
  embedUrl: string | null;
  sourceUrl: string;
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
  catalogSource: "balitower" | "streetside";
  coordinates: { lat: number; lng: number; source: CoordinateSource };
  searchText: string;
  channels: CameraChannel[];
};

export type CameraDataset = {
  schemaVersion: 1;
  generatedAt: string;
  sourceUrl: string;
  unresolvedCount: number;
  sites: CameraSite[];
};

export type StreamHealth = "available" | "unavailable" | "unknown";
