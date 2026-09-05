"use client";
import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import type { CameraPlayback } from "@/domain/cameras/types";
import {
  mediaTimeFor,
  type PlayerController,
  type TimeRange,
} from "../controller";

export function DirectVideoPlayer({
  playback,
  title,
  reloadKey,
  onVideoChange,
  onFallback,
  onController,
  monitoring = false,
}: {
  playback: CameraPlayback;
  title: string;
  reloadKey: number;
  onVideoChange: (video: HTMLVideoElement | null) => void;
  onFallback: (message: string) => void;
  onController?: (controller: PlayerController | null) => void;
  monitoring?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Menghubungkan ke siaran…");
  useEffect(() => {
    const video = ref.current;
    if (!video || playback.kind !== "hls" || !playback.url) return;
    let cancelled = false;
    let hls: Hls | null = null;
    let aligned = false;
    let failedOnce = false;
    const ready = () => {
      window.clearTimeout(timeout);
      setMessage("");
      onVideoChange(video);
    };
    const failed = (reason = "HLS gagal diputar") => {
      if (cancelled || failedOnce) return;
      failedOnce = true;
      window.clearTimeout(timeout);
      onController?.(null);
      onVideoChange(null);
      onFallback(`${reason}; memakai pemutar sumber.`);
    };
    const ranges = (): TimeRange[] => {
      const details = hls?.levels[hls.currentLevel]?.details;
      if (!details || !video.seekable.length) return [];
      const safeEnd = hls?.liveSyncPosition;
      if (safeEnd == null) return [];
      return details.fragments.flatMap((fragment) => {
        const date = fragment.programDateTime;
        if (date == null || !Number.isFinite(date)) return [];
        const result: TimeRange[] = [];
        for (let i = 0; i < video.seekable.length; i++) {
          const start = Math.max(fragment.start, video.seekable.start(i));
          const end = Math.min(
            fragment.start + fragment.duration,
            video.seekable.end(i),
            safeEnd,
          );
          if (end > start)
            result.push({
              start: date + (start - fragment.start) * 1000,
              end: date + (end - fragment.start) * 1000,
              mediaStart: start,
              cc: fragment.cc,
            });
        }
        return result;
      });
    };
    const controller: PlayerController = {
      snapshot: () => ({
        time: hls?.playingDate?.getTime() ?? null,
        sampledAt: performance.now(),
        playing: !video.paused && !video.seeking && video.readyState >= 3,
        ranges: ranges(),
      }),
      seekTime: (time) => {
        const position = mediaTimeFor(ranges(), time);
        if (position == null) return false;
        video.currentTime = position;
        return true;
      },
      setRate: (rate) => {
        if (video.playbackRate !== rate) video.playbackRate = rate;
      },
      setAligned: (value) => {
        if (aligned === value) return;
        aligned = value;
        if (hls) {
          hls.config.maxLiveSyncPlaybackRate = 1;
          hls.config.liveMaxLatencyDurationCount = value ? Infinity : 6;
        }
        if (!value) video.playbackRate = 1;
      },
      goLive: () => {
        controller.setAligned(false);
        const end =
          hls?.liveSyncPosition ??
          (video.seekable.length
            ? video.seekable.end(video.seekable.length - 1) - 1
            : null);
        if (end != null) video.currentTime = Math.max(0, end);
      },
    };
    onController?.(controller);
    const timeout = window.setTimeout(
      () => failed("Koneksi terlalu lama"),
      15000,
    );
    const mediaError = () => failed("Video HLS gagal diputar");
    const play = () =>
      void video.play().catch(() => {
        if (!cancelled) setMessage("Tekan putar untuk memulai siaran");
      });
    video.addEventListener("playing", ready);
    video.addEventListener("error", mediaError);
    void import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (
          Hls.isSupported() &&
          (monitoring || !video.canPlayType("application/vnd.apple.mpegurl"))
        ) {
          hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            capLevelToPlayerSize: monitoring,
            backBufferLength: monitoring ? 12 : 0,
            maxBufferLength: 8,
            maxMaxBufferLength: 12,
            maxBufferSize: 12 * 1024 * 1024,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 6,
            maxLiveSyncPlaybackRate: 1,
          });
          hls.on(Hls.Events.MEDIA_ATTACHED, () =>
            hls?.loadSource(playback.url!),
          );
          hls.on(Hls.Events.MANIFEST_PARSED, play);
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) failed(`HLS gagal: ${data.details}`);
          });
          hls.attachMedia(video);
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = playback.url!;
          play();
        } else failed();
      })
      .catch(() => failed());
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      onController?.(null);
      video.removeEventListener("playing", ready);
      video.removeEventListener("error", mediaError);
      onVideoChange(null);
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [
    playback,
    reloadKey,
    onVideoChange,
    onFallback,
    monitoring,
    onController,
  ]);
  return (
    <>
      <video
        ref={ref}
        title={title}
        className="h-full w-full object-contain"
        muted
        playsInline
        controls
        crossOrigin="anonymous"
      />
      {message && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/35 p-3 text-center text-sm text-slate-200">
          {message}
        </div>
      )}
    </>
  );
}
