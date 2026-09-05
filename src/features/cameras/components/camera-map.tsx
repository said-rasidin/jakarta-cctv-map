"use client";

import L from "leaflet";
import { Layers, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import Supercluster from "supercluster";
import { cameraGroup, JAKARTA_CENTER } from "@/domain/cameras/camera";
import { cameraPlots } from "@/domain/cameras/plots";
import type {
  CameraChannel,
  CameraSite,
  StreamHealth,
} from "@/domain/cameras/types";

type PointProperties = { site: CameraSite; channelIds: string[] };
type Point = GeoJSON.Feature<GeoJSON.Point, PointProperties>;
type ClusterProperties = {
  cluster: true;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: string;
};
type SelectCamera = (site: CameraSite, channelId: string | null) => void;

const cctvSvg =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="8" x="2" y="5" rx="2"/><path d="m14 13 1.5 6M4 13l1.17-1.17M16 13h.01M11 21h-1M18 21h-1"/></svg>';
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ]!,
  );
const siteMarkerIcon = (
  label: string | undefined,
  status: StreamHealth | "reference",
) =>
  L.divIcon({
    className: "",
    html: `<span class="site-marker" title="Status: ${status}"><span class="map-marker map-marker--${status}">${cctvSvg}</span>${label ? `<span class="site-marker-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>` : ""}</span>`,
    iconSize: label ? [216, 38] : [32, 32],
    iconAnchor: [16, 16],
  });
const clusterIcon = (count: number) =>
  L.divIcon({
    className: "",
    html: `<span class="cluster-marker">${count}</span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });
const coordinateKey = (channel: CameraChannel) =>
  `${channel.coordinates.lat},${channel.coordinates.lng}`;
const mapLayouts = {
  light: {
    label: "Terang",
    url: "/api/map-tiles/light/{z}/{x}/{y}{r}.png",
  },
  dark: {
    label: "Gelap",
    url: "/api/map-tiles/dark/{z}/{x}/{y}{r}.png",
  },
} as const;
type MapLayout = keyof typeof mapLayouts;

function Viewport({
  onChange,
}: {
  onChange: (bounds: [number, number, number, number], zoom: number) => void;
}) {
  const map = useMapEvents({ moveend: update, zoomend: update });
  function update() {
    const bounds = map.getBounds();
    onChange(
      [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ],
      map.getZoom(),
    );
  }
  useEffect(() => {
    update();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Focus({
  selected,
  selectedChannelId,
  userLocation,
}: {
  selected: CameraSite | null;
  selectedChannelId: string | null;
  userLocation: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!selected) return;
    const coordinates =
      selected.channels.find((channel) => channel.id === selectedChannelId)
        ?.coordinates ?? selected.coordinates;
    map.flyTo([coordinates.lat, coordinates.lng], Math.max(map.getZoom(), 15), {
      duration: 0.5,
    });
  }, [map, selected, selectedChannelId]);
  useEffect(() => {
    if (userLocation)
      map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 0.5 });
  }, [map, userLocation]);
  return null;
}

function CameraPin({
  onAddToMonitor,
  monitorIds,
  site,
  channels,
  position,
  label,
  status,
  onSelect,
  onPreview,
}: {
  onAddToMonitor: (id: string) => void;
  monitorIds: string[];
  site: CameraSite;
  channels: CameraChannel[];
  position: [number, number];
  label?: string;
  status: StreamHealth | "reference";
  onSelect: SelectCamera;
  onPreview: SelectCamera;
}) {
  const hasDirectStream = channels.some((channel) => channel.embedUrl);
  return (
    <Marker
      position={position}
      icon={siteMarkerIcon(label, status)}
      eventHandlers={{ click: () => onSelect(site, channels[0]?.id ?? null) }}
    >
      <Popup>
        <div className="min-w-52">
          <p className="font-semibold text-white">{site.name}</p>
          <p className="mt-1 text-xs text-slate-400">
            {site.address ?? site.district ?? "DKI Jakarta"}
          </p>
          <div className="mt-2 flex gap-1">
            <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
              {hasDirectStream ? site.agency : "Lokasi referensi"}
            </span>
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
              {hasDirectStream
                ? `${channels.length} kamera di titik ini`
                : "Tanpa stream direct"}
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {channels.map((channel) => (
              <div key={channel.id}>
                <button
                  key={channel.id}
                  onClick={() => onPreview(site, channel.id)}
                  className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md bg-sky-400 px-2 py-1.5 text-xs font-semibold text-slate-950"
                >
                  <Video size={13} /> Buka {channel.label}
                </button>
                <button
                  disabled={
                    !channel.embedUrl ||
                    monitorIds.includes(channel.id) ||
                    monitorIds.length >= 12
                  }
                  onClick={() => onAddToMonitor(channel.id)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-sky-400 px-2 text-xs text-sky-200 disabled:opacity-50"
                >
                  {monitorIds.includes(channel.id)
                    ? `Monitor #${monitorIds.indexOf(channel.id) + 1}`
                    : `Tambah ${channel.label} ke monitor`}
                </button>
              </div>
            ))}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export function CameraMap({
  onAddToMonitor,
  monitorIds,
  sites,
  selected,
  selectedChannelId,
  onSelect,
  onPreview,
  userLocation,
  streamHealth,
}: {
  onAddToMonitor: (id: string) => void;
  monitorIds: string[];
  sites: CameraSite[];
  selected: CameraSite | null;
  selectedChannelId: string | null;
  onSelect: SelectCamera;
  onPreview: SelectCamera;
  userLocation: { lat: number; lng: number } | null;
  streamHealth: Record<string, StreamHealth>;
}) {
  const [viewport, setViewport] = useState<[number, number, number, number]>([
    106.65, -6.4, 107.05, -6.05,
  ]);
  const [zoom, setZoom] = useState(12);
  const [layout, setLayout] = useState<MapLayout>(() =>
    typeof window !== "undefined" &&
    window.localStorage.getItem("map-layout") === "dark"
      ? "dark"
      : "light",
  );
  const points = useMemo<Point[]>(
    () =>
      cameraPlots(sites).map(({ site, channels, coordinates }) => ({
        type: "Feature",
        properties: { site, channelIds: channels.map((channel) => channel.id) },
        geometry: {
          type: "Point",
          coordinates: [coordinates.lng, coordinates.lat],
        },
      })),
    [sites],
  );
  const index = useMemo(() => {
    const next = new Supercluster<PointProperties, ClusterProperties>({
      radius: 62,
      maxZoom: 18,
    });
    next.load(points);
    return next;
  }, [points]);
  const clusters = useMemo(
    () => index.getClusters(viewport, Math.round(zoom)),
    [index, viewport, zoom],
  );
  const showSiteLabels = zoom >= 15;
  const chooseLayout = (value: MapLayout) => {
    setLayout(value);
    window.localStorage.setItem("map-layout", value);
  };
  const statusFor = (channels: CameraChannel[]): StreamHealth | "reference" => {
    const direct = channels.filter((channel) => channel.embedUrl);
    if (!direct.length) return "reference";
    const statuses = direct.map(
      (channel) => streamHealth[channel.id] ?? "unknown",
    );
    return statuses.includes("available")
      ? "available"
      : statuses.every((status) => status === "unavailable")
        ? "unavailable"
        : "unknown";
  };

  return (
    <MapContainer
      center={JAKARTA_CENTER}
      zoom={12}
      minZoom={10}
      maxZoom={21}
      className="absolute inset-0 z-0 h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        key={layout}
        maxNativeZoom={20}
        maxZoom={21}
        keepBuffer={4}
        updateWhenZooming={false}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={mapLayouts[layout].url}
      />
      <Viewport
        onChange={(bounds, value) => {
          setViewport(bounds);
          setZoom(value);
        }}
      />
      <Focus
        selected={selected}
        selectedChannelId={selectedChannelId}
        userLocation={userLocation}
      />
      <div className="leaflet-top leaflet-right mt-3 mr-3">
        <div className="leaflet-control rounded-xl border border-slate-300 bg-white/95 p-2 shadow-lg backdrop-blur">
          <div className="flex items-center gap-1.5 px-1 pb-2 text-xs font-semibold text-slate-700">
            <Layers size={14} /> Tampilan peta
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(mapLayouts) as MapLayout[]).map((value) => (
              <button
                key={value}
                onClick={() => chooseLayout(value)}
                className={`rounded-lg px-2 py-1.5 text-xs font-medium ${layout === value ? "bg-sky-500 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {mapLayouts[value].label}
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-600">
            <p className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
              Stream aktif
            </p>
            <p className="mt-1 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
              Stream tidak aktif
            </p>
            <p className="mt-1 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              Belum diperiksa
            </p>
            <p className="mt-1 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
              Lokasi referensi
            </p>
          </div>
        </div>
      </div>
      {userLocation && (
        <Marker
          position={[userLocation.lat, userLocation.lng]}
          icon={L.divIcon({
            className: "",
            html: '<span class="map-marker" style="background:#f59e0b">●</span>',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })}
        >
          <Popup>Lokasi Anda</Popup>
        </Marker>
      )}
      {clusters.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const properties = feature.properties as ClusterProperties &
          Partial<PointProperties>;
        if (properties.cluster) {
          const expansion = index.getClusterExpansionZoom(
            properties.cluster_id,
          );
          if (zoom >= 18 || expansion > 18) {
            const members = index.getLeaves(
              properties.cluster_id,
              Infinity,
            ) as Point[];
            return (
              <Marker
                key={`cluster-camera-${properties.cluster_id}`}
                position={[lat, lng]}
                icon={clusterIcon(properties.point_count)}
              >
                <Popup>
                  <p className="font-semibold text-white">
                    {members.length} titik kamera berdekatan
                  </p>
                  <div className="max-h-64 overflow-y-auto">
                    {members.map(({ properties: member }) => {
                      const channels = member.site.channels.filter((channel) =>
                        member.channelIds.includes(channel.id),
                      );
                      return (
                        <button
                          key={`${member.site.id}-${member.channelIds.join("-")}`}
                          onClick={() =>
                            onPreview(member.site, channels[0]?.id ?? null)
                          }
                          className="block min-h-11 w-full border-b border-slate-700 py-2 text-left text-sm text-sky-200 hover:text-white"
                        >
                          {member.site.name}
                          <span className="block text-xs text-slate-400">
                            {channels
                              .map((channel) => channel.label)
                              .join(", ")}{" "}
                            · Buka siaran
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Popup>
              </Marker>
            );
          }
          return (
            <Marker
              key={`cluster-${properties.cluster_id}`}
              position={[lat, lng]}
              icon={clusterIcon(properties.point_count)}
              eventHandlers={{
                click: (event) =>
                  event.target._map.flyTo([lat, lng], expansion),
              }}
            />
          );
        }
        const site = properties.site!;
        const channelIds = properties.channelIds!;
        const channels = site.channels.filter((channel) =>
          channelIds.includes(channel.id),
        );
        const hasMultiplePlots =
          new Set(site.channels.map(coordinateKey)).size > 1;
        const label = showSiteLabels
          ? `${cameraGroup(site).label}${hasMultiplePlots ? ` · ${channels.map((channel) => channel.label).join("/")}` : ""}`
          : undefined;
        return (
          <CameraPin
            onAddToMonitor={onAddToMonitor}
            monitorIds={monitorIds}
            key={`${site.id}-${channelIds.join("-")}`}
            site={site}
            channels={channels}
            position={[lat, lng]}
            label={
              channels.some((channel) => monitorIds.includes(channel.id))
                ? `${channels
                    .filter((channel) => monitorIds.includes(channel.id))
                    .map((channel) => `#${monitorIds.indexOf(channel.id) + 1}`)
                    .join(", ")} ${label ?? site.roadName ?? site.name}`
                : label
            }
            status={statusFor(channels)}
            onSelect={onSelect}
            onPreview={onPreview}
          />
        );
      })}
    </MapContainer>
  );
}
