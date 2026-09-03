"use client";

import { useEffect, useRef, useState } from "react";
import type { CameraPlayback } from "@/lib/types";

export function DirectVideoPlayer({ playback, title, reloadKey, onVideoChange, onFallback }: {
  playback: CameraPlayback;
  title: string;
  reloadKey: number;
  onVideoChange: (video: HTMLVideoElement | null) => void;
  onFallback: (message: string) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Menghubungkan ke siaran…");

  useEffect(() => {
    const video = ref.current;
    if (!video || playback.kind !== "hls" || !playback.url) return;
    let cancelled = false;
    let destroy = () => undefined;
    const ready = () => { setMessage(""); onVideoChange(video); };
    const failed = (reason = "HLS gagal diputar") => { if (!cancelled) { onVideoChange(null); onFallback(`${reason}; memakai pemutar sumber.`); } };
    video.addEventListener("playing", ready);
    const mediaError = () => failed("Video HLS gagal diputar");
    video.addEventListener("error", mediaError);
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playback.url;
      void video.play().catch(() => setMessage("Tekan putar untuk memulai siaran"));
    } else {
      void import("hls.js").then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) { failed(); return; }
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 0,
          maxBufferLength: 8,
          maxMaxBufferLength: 12,
          maxBufferSize: 12 * 1024 * 1024,
          liveSyncDurationCount: 2,
        });
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(playback.url!));
        hls.on(Hls.Events.MANIFEST_PARSED, () => void video.play().catch(() => setMessage("Tekan putar untuk memulai siaran")));
        hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) failed(`HLS gagal: ${data.details}`); });
        destroy = () => { hls.stopLoad(); hls.detachMedia(); hls.destroy(); };
      }).catch(failed);
    }
    return () => {
      cancelled = true;
      video.removeEventListener("playing", ready);
      video.removeEventListener("error", mediaError);
      onVideoChange(null);
      destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [playback, reloadKey, onFallback, onVideoChange]);

  return <>
    <video ref={ref} title={title} className="h-full w-full object-contain" muted playsInline controls crossOrigin="anonymous" />
    {message && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/35 text-sm text-slate-200">{message}</div>}
  </>;
}
