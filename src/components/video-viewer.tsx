"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { ExternalLink, Maximize2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AiOverlay } from "@/components/ai-overlay";
import { DirectVideoPlayer } from "@/components/direct-video-player";
import type { CameraSite, StreamHealth } from "@/lib/types";

const AI_FEATURE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_CCTV_AI === "true";

export function VideoViewer({ site, open, onOpenChange }: { site: CameraSite | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [activeChannelId, setActiveChannelId] = useState("");
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "unavailable">("loading");
  const [health, setHealth] = useState<StreamHealth>("unknown");
  const [reloadKey, setReloadKey] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState("");
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const active = site?.channels.find((channel) => channel.id === activeChannelId) ?? site?.channels[0];
  const hasStream = Boolean(active?.embedUrl);
  const playback = active?.playback;

  useEffect(() => {
    if (!open || !active || !active.embedUrl) { setHealth("unknown"); setLoadState("unavailable"); return; }
    setLoadState("loading"); setHealth("unknown"); setFallback(false); setFallbackReason(""); setVideo(null);
    const controller = new AbortController();
    const timer = window.setTimeout(() => setLoadState((value) => value === "loading" ? "unavailable" : value), 12000);
    fetch(`/api/stream-health?channelId=${encodeURIComponent(active.id)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((body: { status: StreamHealth }) => { setHealth(body.status); if (body.status === "unavailable") setLoadState("unavailable"); })
      .catch(() => undefined);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [open, active, reloadKey]);

  const handleVideo = useCallback((element: HTMLVideoElement | null) => { setVideo(element); if (element) setLoadState("loaded"); }, []);
  const handleFallback = useCallback((message: string) => { setFallbackReason(message); setFallback(true); setLoadState("loaded"); }, []);
  if (!site || !active) return null;
  const retry = () => { if (!hasStream) return; setReloadKey((value) => value + 1); };
  const fullscreen = () => document.getElementById("camera-frame")?.requestFullscreen().catch(() => undefined);
  const showDirect = hasStream && playback?.kind === "hls" && !fallback && loadState !== "unavailable";
  const showIframe = hasStream && (!showDirect || fallback) && loadState !== "unavailable";

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
      <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-auto rounded-t-3xl border border-slate-700 bg-[#101622] p-4 shadow-2xl outline-none md:inset-y-0 md:right-0 md:left-auto md:w-[min(680px,56vw)] md:rounded-none md:border-y-0 md:border-r-0">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><Dialog.Title className="text-base font-semibold text-white">{site.name}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-slate-400">{site.agency} · {site.district ?? "DKI Jakarta"}</Dialog.Description></div>
          <Dialog.Close className="rounded-lg p-2 text-slate-300 hover:bg-slate-800" aria-label="Tutup"><X size={20} /></Dialog.Close>
        </div>
        <Tabs.Root value={active.id} onValueChange={(value) => { setActiveChannelId(value); setFallback(false); setVideo(null); }}>
          <Tabs.List className="mb-3 flex flex-wrap gap-2" aria-label="Pilih kamera">
            {site.channels.map((channel) => <Tabs.Trigger key={channel.id} value={channel.id} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 data-[state=active]:border-sky-400 data-[state=active]:bg-sky-400/15 data-[state=active]:text-sky-200">{channel.label}</Tabs.Trigger>)}
          </Tabs.List>
          <div id="camera-frame" className="relative aspect-video overflow-hidden rounded-xl bg-black">
            {showDirect && playback && <DirectVideoPlayer key={`${active.id}-${reloadKey}`} playback={playback} title={`${site.name} ${active.label}`} reloadKey={reloadKey} onVideoChange={handleVideo} onFallback={handleFallback} />}
            {showIframe && <iframe key={`${active.id}-${reloadKey}-fallback`} src={active.embedUrl ?? undefined} title={`${site.name} ${active.label}`} className="h-full w-full border-0" allowFullScreen referrerPolicy="no-referrer" onLoad={() => setLoadState("loaded")} />}
            {showDirect && AI_FEATURE_ENABLED && <AiOverlay video={video} eligible={Boolean(playback?.aiEligible)} generationKey={`${active.id}-${reloadKey}`} />}
            {loadState === "loading" && !showDirect && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/35 text-sm text-slate-200">Menghubungkan ke siaran…</div>}
            {loadState === "unavailable" && <div className="absolute inset-0 grid place-items-center bg-slate-950 p-6 text-center"><div><p className="font-medium text-white">{hasStream ? "Siaran sedang tidak tersedia" : "Stream direct belum tersedia"}</p><p className="mt-2 text-sm text-slate-400">{hasStream ? "Coba lagi atau buka halaman sumber secara langsung." : "Lokasi tersedia di peta; buka katalog sumber untuk informasi kamera."}</p></div></div>}
          </div>
        </Tabs.Root>
        <p className="mt-3 text-xs text-slate-500">{fallbackReason || (hasStream ? `Status koneksi: ${health === "available" ? "tersedia" : health === "unavailable" ? "tidak tersedia" : "belum dapat dipastikan"}` : "Status koneksi: tidak ada URL Bali Tower yang terverifikasi.")}</p>
        {showDirect && AI_FEATURE_ENABLED && <p className="mt-1 text-xs text-slate-500">AI hanya menganalisis kamera yang sedang dibuka dan berhenti saat pemutar ditutup.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {hasStream && <><button onClick={retry} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"><RefreshCw size={16} /> Coba lagi</button><button onClick={fullscreen} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"><Maximize2 size={16} /> Layar penuh</button></>}
          <a href={active.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"><ExternalLink size={16} /> {hasStream ? "Buka tautan sumber" : "Buka katalog sumber"}</a>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
