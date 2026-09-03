"use client";

import L from "leaflet";
import Supercluster from "supercluster";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Layers, Maximize2, Video } from "lucide-react";
import { cameraGroup, JAKARTA_CENTER } from "@/domain/cameras/camera";
import type { CameraSite, StreamHealth } from "@/domain/cameras/types";

type Point = GeoJSON.Feature<GeoJSON.Point, { site: CameraSite }>;
type ClusterProperties = { cluster: true; cluster_id: number; point_count: number; point_count_abbreviated: string };
const cctvSvg = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="8" x="2" y="5" rx="2"/><path d="m14 13 1.5 6M4 13l1.17-1.17M16 13h.01M11 21h-1M18 21h-1"/></svg>';
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
const siteMarkerIcon = (label: string | undefined, status: StreamHealth | "reference") => L.divIcon({
  className: "",
  html: `<span class="site-marker" title="Status: ${status}"><span class="map-marker map-marker--${status}">${cctvSvg}</span>${label ? `<span class="site-marker-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>` : ""}</span>`,
  iconSize: label ? [216, 38] : [32, 32],
  iconAnchor: [16, 16],
});
const clusterIcon = (count: number) => L.divIcon({ className: "", html: `<span class="cluster-marker">${count}</span>`, iconSize: [42, 42], iconAnchor: [21, 21] });
const mapLayouts = {
  light: { label: "Terang", url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" },
  dark: { label: "Gelap", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" },
} as const;
type MapLayout = keyof typeof mapLayouts;

function Viewport({ onChange }: { onChange: (bounds: [number, number, number, number], zoom: number) => void }) {
  const map = useMapEvents({ moveend: update, zoomend: update });
  function update() { const bounds = map.getBounds(); onChange([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()], map.getZoom()); }
  useEffect(() => { update(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Focus({ selected, userLocation }: { selected: CameraSite | null; userLocation: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => { if (selected) map.flyTo([selected.coordinates.lat, selected.coordinates.lng], Math.max(map.getZoom(), 15), { duration: 0.5 }); }, [map, selected]);
  useEffect(() => { if (userLocation) map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 0.5 }); }, [map, userLocation]);
  return null;
}

function CameraPin({ site, position, label, status, onSelect, onPreview }: { site: CameraSite; position: [number, number]; label?: string; status: StreamHealth | "reference"; onSelect: (site: CameraSite) => void; onPreview: (site: CameraSite) => void }) {
  const hasDirectStream = site.channels.some((channel) => channel.embedUrl);
  return <Marker position={position} icon={siteMarkerIcon(label, status)} eventHandlers={{ click: () => onSelect(site) }}>
    <Popup>
      <div className="min-w-52"><p className="font-semibold text-white">{site.name}</p><p className="mt-1 text-xs text-slate-400">{site.address ?? site.district ?? "DKI Jakarta"}</p><div className="mt-2 flex gap-1"><span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-semibold text-sky-200">{hasDirectStream ? site.agency : "Lokasi referensi"}</span><span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300">{hasDirectStream ? `${site.channels.length} kamera` : "Tanpa stream direct"}</span></div><div className="mt-3 flex gap-2"><button onClick={() => onPreview(site)} className="inline-flex items-center gap-1 rounded-md bg-sky-400 px-2 py-1.5 text-xs font-semibold text-slate-950"><Video size={13} /> {hasDirectStream ? "Pratinjau" : "Info kamera"}</button>{hasDirectStream && <button onClick={() => onPreview(site)} className="inline-flex items-center gap-1 rounded-md border border-slate-600 px-2 py-1.5 text-xs text-slate-200"><Maximize2 size={13} /> Layar penuh</button>}</div></div>
    </Popup>
  </Marker>;
}

export function CameraMap({ sites, selected, onSelect, onPreview, userLocation, streamHealth }: { sites: CameraSite[]; selected: CameraSite | null; onSelect: (site: CameraSite) => void; onPreview: (site: CameraSite) => void; userLocation: { lat: number; lng: number } | null; streamHealth: Record<string, StreamHealth> }) {
  const [viewport, setViewport] = useState<[number, number, number, number]>([106.65, -6.4, 107.05, -6.05]);
  const [zoom, setZoom] = useState(12);
  const [layout, setLayout] = useState<MapLayout>(() => (typeof window !== "undefined" && window.localStorage.getItem("map-layout") === "dark" ? "dark" : "light"));
  const points = useMemo<Point[]>(() => sites.map((site) => ({ type: "Feature", properties: { site }, geometry: { type: "Point", coordinates: [site.coordinates.lng, site.coordinates.lat] } })), [sites]);
  const index = useMemo(() => { const next = new Supercluster<{ site: CameraSite }, ClusterProperties>({ radius: 62, maxZoom: 18 }); next.load(points); return next; }, [points]);
  const clusters = useMemo(() => index.getClusters(viewport, Math.round(zoom)), [index, viewport, zoom]);
  const showSiteLabels = zoom >= 15;
  const chooseLayout = (value: MapLayout) => { setLayout(value); window.localStorage.setItem("map-layout", value); };
  const statusFor = (site: CameraSite): StreamHealth | "reference" => {
    const direct = site.channels.filter((channel) => channel.embedUrl);
    if (!direct.length) return "reference";
    const statuses = direct.map((channel) => streamHealth[channel.id] ?? "unknown");
    return statuses.includes("available") ? "available" : statuses.every((status) => status === "unavailable") ? "unavailable" : "unknown";
  };
  return <MapContainer center={JAKARTA_CENTER} zoom={12} minZoom={10} maxZoom={21} className="absolute inset-0 z-0 h-full w-full" zoomControl={false}>
    <TileLayer key={layout} maxNativeZoom={20} maxZoom={21} keepBuffer={4} updateWhenZooming={false} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' url={mapLayouts[layout].url} />
    <Viewport onChange={(bounds, value) => { setViewport(bounds); setZoom(value); }} />
    <Focus selected={selected} userLocation={userLocation} />
    <div className="leaflet-top leaflet-right mt-3 mr-3">
      <div className="leaflet-control rounded-xl border border-slate-300 bg-white/95 p-2 shadow-lg backdrop-blur">
        <div className="flex items-center gap-1.5 px-1 pb-2 text-xs font-semibold text-slate-700"><Layers size={14} /> Tampilan peta</div>
        <div className="grid grid-cols-2 gap-1">{(Object.keys(mapLayouts) as MapLayout[]).map((value) => <button key={value} onClick={() => chooseLayout(value)} className={`rounded-lg px-2 py-1.5 text-xs font-medium ${layout === value ? "bg-sky-500 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{mapLayouts[value].label}</button>)}</div>
        <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-600"><p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />Stream aktif</p><p className="mt-1 flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" />Stream tidak aktif</p><p className="mt-1 flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Belum diperiksa</p><p className="mt-1 flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-500" />Lokasi referensi</p></div>
      </div>
    </div>
    {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={L.divIcon({ className: "", html: '<span class="map-marker" style="background:#f59e0b">●</span>', iconSize: [32, 32], iconAnchor: [16, 16] })}><Popup>Lokasi Anda</Popup></Marker>}
    {clusters.map((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const properties = feature.properties as ClusterProperties & { site?: CameraSite };
      if (properties.cluster) {
        const expansion = index.getClusterExpansionZoom(properties.cluster_id);
        if (zoom >= 18 || expansion > 18) {
          const site = (index.getLeaves(properties.cluster_id, 1)[0] as Point).properties.site;
          return <CameraPin key={`cluster-camera-${properties.cluster_id}`} site={site} position={[site.coordinates.lat, site.coordinates.lng]} label={showSiteLabels ? cameraGroup(site).label : undefined} status={statusFor(site)} onSelect={onSelect} onPreview={onPreview} />;
        }
        return <Marker key={`cluster-${properties.cluster_id}`} position={[lat, lng]} icon={clusterIcon(properties.point_count)} eventHandlers={{ click: (event) => event.target._map.flyTo([lat, lng], expansion) }} />;
      }
      const site = properties.site!;
      return <CameraPin key={site.id} site={site} position={[lat, lng]} label={showSiteLabels ? cameraGroup(site).label : undefined} status={statusFor(site)} onSelect={onSelect} onPreview={onPreview} />;
    })}
  </MapContainer>;
}
