"use client";

import { Crosshair, MapPin, Search, SlidersHorizontal, Video, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { distanceInKm } from "@/domain/cameras/camera";
import type { CameraDataset, CameraSite } from "@/domain/cameras/types";
import { CameraViewer } from "@/features/cameras/components/camera-viewer";
import { useCameraFilters, type StatusFilter } from "@/features/cameras/hooks/use-camera-filters";
import { useGeolocation } from "@/features/cameras/hooks/use-geolocation";
import { useStreamHealth } from "@/features/cameras/hooks/use-stream-health";

const CameraMap = dynamic(() => import("@/features/cameras/components/camera-map").then((module) => module.CameraMap), { ssr: false });

export default function CameraExplorer({ dataset }: { dataset: CameraDataset }) {
  const [selected, setSelected] = useState<CameraSite | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const streamHealth = useStreamHealth(dataset.sites);
  const { userLocation, locationError, locate } = useGeolocation();
  const {
    query, setQuery, agencies, availableAgencies, availableLocations, statusCounts,
    statusFilter, setStatusFilter, locationFilter, setLocationFilter,
    ordered, groups, toggleAgency, resetFilters,
  } = useCameraFilters(dataset.sites, streamHealth, userLocation);
  const choose = (site: CameraSite) => setSelected(site);
  return <main className="relative min-h-screen overflow-hidden bg-[#080b12]">
    <CameraMap sites={ordered} selected={selected} onSelect={choose} onPreview={(site) => { setSelected(site); setViewerOpen(true); }} userLocation={userLocation} streamHealth={streamHealth} />
    <aside className="absolute inset-x-3 top-3 z-20 rounded-2xl border border-slate-700/80 bg-[#101622]/95 p-3 shadow-2xl backdrop-blur md:inset-y-3 md:left-3 md:right-auto md:w-[360px] md:overflow-y-auto">
      <div className="mb-4 flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-400 text-slate-950"><Video size={19} /></div><div><h1 className="font-semibold text-white">Peta CCTV Jakarta</h1><p className="text-xs text-slate-400">{dataset.sites.length} lokasi · diperbarui {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(dataset.generatedAt))}</p></div></div>
      <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari jalan, wilayah, atau ID CCTV…" className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 pr-9 pl-9 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" />{query && <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" aria-label="Hapus pencarian"><X size={15} /></button>}</label>
      <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-400"><SlidersHorizontal size={14} /> Filter instansi</div>
      <div className="mt-2 flex flex-wrap gap-2">{availableAgencies.map((agency) => <button key={agency} onClick={() => toggleAgency(agency)} className={`rounded-full border px-2.5 py-1 text-xs transition ${agencies.has(agency) ? "border-sky-400 bg-sky-400/15 text-sky-200" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>{agency}</button>)}</div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-400">Status kamera</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-sky-400"><option value="all">Semua kamera</option><option value="active">Aktif ({statusCounts.active})</option><option value="inactive">Tidak aktif ({statusCounts.inactive})</option></select></label>
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-400">Lokasi</span><select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-sky-400"><option value="all">Semua lokasi</option>{availableLocations.map((location) => <option key={location} value={location}>{location}</option>)}</select></label>
      </div>
      {statusCounts.checking > 0 && <p className="mt-2 text-[11px] text-amber-300">Memeriksa {statusCounts.checking} kamera live…</p>}
      <button onClick={locate} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-3 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-300"><Crosshair size={16} /> Cari di sekitar saya</button>
      {locationError && <p className="mt-2 text-xs text-amber-300">{locationError}</p>}
      <div className="mt-4 flex items-center justify-between"><p className="text-xs text-slate-400">{ordered.length} CCTV · {groups.length} ruas/lokasi</p>{(query || agencies.size || statusFilter !== "all" || locationFilter !== "all") && <button onClick={resetFilters} className="text-xs text-sky-300 hover:text-sky-200">Reset filter</button>}</div>
      <div className="mt-2 max-h-44 divide-y divide-slate-800 overflow-y-auto md:max-h-none">{groups.slice(0, 16).map((group) => <div key={group.key} className="py-1"><button onClick={() => { setExpandedGroup((value) => value === group.key ? null : group.key); choose(group.sites[0]); }} className="flex w-full items-start gap-2 rounded-lg px-1 py-2 text-left hover:bg-white/5"><MapPin size={15} className="mt-0.5 shrink-0 text-sky-300" /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-slate-200">{group.label}</span><span className="text-xs text-slate-500">{group.sites.length} CCTV{userLocation ? ` · ${distanceInKm(userLocation, group.sites[0].coordinates).toFixed(1)} km` : ""}</span></span></button>{expandedGroup === group.key && <div className="ml-6 border-l border-slate-700 pl-2">{group.sites.map((site) => <button key={site.id} onClick={() => choose(site)} className="block w-full truncate rounded px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-white/5 hover:text-white">{site.name}</button>)}</div>}</div>)}{!ordered.length && <p className="px-1 py-5 text-center text-sm text-slate-500">Tidak ada CCTV yang cocok.</p>}</div>
    </aside>
    <CameraViewer site={selected} open={viewerOpen} onOpenChange={setViewerOpen} />
  </main>;
}
