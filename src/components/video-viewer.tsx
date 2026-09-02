"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { ExternalLink, Maximize2, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { CameraSite, StreamHealth } from "@/lib/types";

export function VideoViewer({ site, open, onOpenChange }: { site: CameraSite | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [activeChannelId, setActiveChannelId] = useState("");
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "unavailable">("loading");
  const [health, setHealth] = useState<StreamHealth>("unknown");
  const [iframeReady, setIframeReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const active = site?.channels.find((channel) => channel.id === activeChannelId) ?? site?.channels[0];
  const hasDirectStream = Boolean(active?.embedUrl);

  useEffect(() => {
    if (!open || !active || !active.embedUrl) { setHealth("unknown"); setLoadState("unavailable"); return; }
    setLoadState("loading"); setHealth("unknown"); setIframeReady(false);
    const controller = new AbortController();
    const timer = window.setTimeout(() => setLoadState((value) => value === "loading" ? "unavailable" : value), 12000);
    fetch(`/api/stream-health?channelId=${encodeURIComponent(active.id)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((body: { status: StreamHealth }) => { setHealth(body.status); if (body.status === "unavailable") setLoadState("unavailable"); })
      .catch(() => undefined);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [open, active, reloadKey]);

  useEffect(() => {
    if (health === "available" && iframeReady) setLoadState("loaded");
  }, [health, iframeReady]);

  if (!site || !active) return null;
  const retry = () => { if (!hasDirectStream) return; setReloadKey((value) => value + 1); };
  const fullscreen = () => document.getElementById("camera-frame")?.requestFullscreen().catch(() => undefined);

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
      <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-auto rounded-t-3xl border border-slate-700 bg-[#101622] p-4 shadow-2xl outline-none md:inset-y-0 md:right-0 md:left-auto md:w-[min(680px,56vw)] md:rounded-none md:border-y-0 md:border-r-0">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><Dialog.Title className="text-base font-semibold text-white">{site.name}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-slate-400">{site.agency} · {site.district ?? "DKI Jakarta"}</Dialog.Description></div>
          <Dialog.Close className="rounded-lg p-2 text-slate-300 hover:bg-slate-800" aria-label="Tutup"><X size={20} /></Dialog.Close>
        </div>
        <Tabs.Root value={active.id} onValueChange={setActiveChannelId}>
          <Tabs.List className="mb-3 flex flex-wrap gap-2" aria-label="Pilih kamera">
            {site.channels.map((channel) => <Tabs.Trigger key={channel.id} value={channel.id} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 data-[state=active]:border-sky-400 data-[state=active]:bg-sky-400/15 data-[state=active]:text-sky-200">{channel.label}</Tabs.Trigger>)}
          </Tabs.List>
          <div id="camera-frame" className="relative aspect-video overflow-hidden rounded-xl bg-black">
            {hasDirectStream && loadState !== "unavailable" && <iframe key={`${active.id}-${reloadKey}`} src={active.embedUrl ?? undefined} title={`${site.name} ${active.label}`} className="h-full w-full border-0" allowFullScreen referrerPolicy="no-referrer" onLoad={() => setIframeReady(true)} />}
            {loadState === "loading" && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/35 text-sm text-slate-200">Menghubungkan ke siaran…</div>}
            {loadState === "unavailable" && <div className="absolute inset-0 grid place-items-center bg-slate-950 p-6 text-center"><div><p className="font-medium text-white">{hasDirectStream ? "Siaran sedang tidak tersedia" : "Stream direct belum tersedia"}</p><p className="mt-2 text-sm text-slate-400">{hasDirectStream ? "Coba lagi atau buka halaman sumber secara langsung." : "Lokasi tersedia di peta; buka katalog sumber untuk informasi kamera."}</p></div></div>}
          </div>
        </Tabs.Root>
        <p className="mt-3 text-xs text-slate-500">{hasDirectStream ? `Status koneksi: ${health === "available" ? "tersedia" : health === "unavailable" ? "tidak tersedia" : "belum dapat dipastikan"}` : "Status koneksi: tidak ada URL Bali Tower yang terverifikasi."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {hasDirectStream && <><button onClick={retry} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"><RefreshCw size={16} /> Coba lagi</button><button onClick={fullscreen} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"><Maximize2 size={16} /> Layar penuh</button></>}
          <a href={active.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"><ExternalLink size={16} /> {hasDirectStream ? "Buka tautan sumber" : "Buka katalog sumber"}</a>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
