"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraChannel, CameraSite } from "@/domain/cameras/types";
import { DirectVideoPlayer } from "@/features/video/components/direct-video-player";
import type { PlayerController } from "@/features/video/controller";
import { DetectionOverlay } from "@/features/detection/components/detection-overlay";
import { CameraPreview } from "./camera-preview";
import { cameraPreviewUrl } from "./preview";

export const monitorButton =
  "min-h-11 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed";
export function MonitorTile({
  id,
  site,
  channel,
  index,
  active,
  arranging,
  compact,
  focused,
  aligned,
  register,
  onFocus,
  onMove,
  onRemove,
  onReplace,
  onDrop,
  onReorderTo,
  onDragTarget,
  dropTarget,
  previewEnabled,
  audioId,
  onAudio,
}: {
  id: string;
  site?: CameraSite;
  channel?: CameraChannel;
  index: number;
  active: boolean;
  arranging: boolean;
  compact: boolean;
  focused: boolean;
  aligned: boolean;
  register: (id: string, controller: PlayerController | null) => void;
  onFocus: () => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onReplace: () => void;
  onDrop: (id: string) => void;
  onReorderTo: (id: string) => void;
  onDragTarget: (id: string | null) => void;
  dropTarget: boolean;
  previewEnabled: boolean;
  audioId: string | null;
  onAudio: (id: string) => void;
}) {
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [controls, setControls] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("Menghubungkan…");
  const [time, setTime] = useState<string | null>(null);
  const controllerRef = useRef<PlayerController | null>(null);
  const tileRef = useRef<HTMLElement>(null);
  const delay = useRef(Math.min(index, 5) * 200);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const previewUrl = cameraPreviewUrl(
    channel?.playback.url ?? channel?.embedUrl,
  );
  useEffect(() => {
    setReady(false);
    setFallback(false);
    setStatus("Menghubungkan…");
    setTime(null);
    if (!active) return;
    const timer = window.setTimeout(() => setReady(true), delay.current);
    return () => window.clearTimeout(timer);
  }, [active, reload]);
  const handleController = useCallback(
    (controller: PlayerController | null) => {
      controllerRef.current = controller;
      register(id, controller);
    },
    [id, register],
  );
  const handleFallback = useCallback(() => {
    setFallback(true);
    setVideo(null);
    setTime(null);
    setStatus("Pemutar sumber · status tidak terverifikasi");
  }, []);
  const handleVideo = useCallback((element: HTMLVideoElement | null) => {
    setVideo(element);
    if (element) setStatus("Siaran aktif");
  }, []);
  useEffect(() => {
    if (!video) return;
    const changed = () => {
      if (!video.muted) onAudio(id);
    };
    video.addEventListener("volumechange", changed);
    return () => video.removeEventListener("volumechange", changed);
  }, [video, id, onAudio]);
  useEffect(() => {
    // HTMLVideoElement is an external media handle, not React-owned data.
    // eslint-disable-next-line react-hooks/immutability
    if (video && audioId !== id) video.muted = true;
  }, [audioId, id, video]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      const sample = controllerRef.current?.snapshot();
      if (!sample) return;
      setTime(
        sample.time != null && Number.isFinite(sample.time)
          ? new Intl.DateTimeFormat("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              timeZone: "Asia/Jakarta",
            }).format(sample.time)
          : null,
      );
      setStatus(sample.playing ? "Siaran aktif" : "Menunggu video / dijeda");
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  const canPlay = active && ready && channel?.embedUrl;
  return (
    <article
      ref={tileRef}
      data-testid="monitor-tile"
      data-camera-id={id}
      style={
        dropTarget
          ? { outline: "3px solid #ff9b52", outlineOffset: 3 }
          : undefined
      }
      className={`min-w-0 rounded-xl border ${focused ? "border-sky-400 md:col-span-full" : "border-slate-700"} bg-slate-900 p-3`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(e.dataTransfer.getData("text/plain"));
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-white">
            <span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-sky-400 text-slate-950">
              {index + 1}
            </span>
            {site?.name ?? "Kamera tidak ada di katalog"}
          </h3>
          <p className="mt-1 text-xs text-slate-400">{channel?.label ?? id}</p>
        </div>
        {arranging && (
          <button
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              pointerStart.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!pointerStart.current) return;
              const target = document
                .elementFromPoint(e.clientX, e.clientY)
                ?.closest<HTMLElement>("[data-camera-id]");
              onDragTarget(target?.dataset.cameraId ?? null);
            }}
            onPointerUp={(e) => {
              const start = pointerStart.current;
              pointerStart.current = null;
              onDragTarget(null);
              if (
                !start ||
                Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6
              )
                return;
              const target = document
                .elementFromPoint(e.clientX, e.clientY)
                ?.closest<HTMLElement>("[data-camera-id]");
              if (target?.dataset.cameraId)
                onReorderTo(target.dataset.cameraId);
            }}
            onPointerCancel={() => {
              pointerStart.current = null;
              onDragTarget(null);
            }}
            onLostPointerCapture={() => {
              pointerStart.current = null;
              onDragTarget(null);
            }}
            onKeyDown={(e) => {
              if (
                ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(
                  e.key,
                )
              ) {
                e.preventDefault();
                onMove(e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1);
              }
            }}
            aria-label={`Geser urutan kamera ${index + 1}`}
            title="Seret ke tile tujuan, atau gunakan tombol panah saat pegangan fokus"
            className={`${monitorButton} touch-none cursor-grab select-none active:cursor-grabbing`}
          >
            ↕
          </button>
        )}
      </div>
      <div className={`relative aspect-video overflow-hidden rounded-lg bg-black ${compact && !focused ? "lg:max-h-[max(160px,calc((100dvh-300px)/2))]" : ""}`}>
        {canPlay ? (
          fallback || channel.playback.kind !== "hls" ? (
            <iframe
              src={channel.embedUrl!}
              title={`${site?.name} ${channel.label}`}
              className="h-full w-full border-0"
              allowFullScreen
              referrerPolicy="no-referrer"
            />
          ) : (
            <DirectVideoPlayer
              key={reload}
              playback={channel.playback}
              title={`${site?.name} ${channel.label}`}
              reloadKey={reload}
              onVideoChange={handleVideo}
              onFallback={handleFallback}
              onController={handleController}
              monitoring
            />
          )
        ) : previewEnabled && !active && previewUrl ? (
          <CameraPreview
            key={previewUrl}
            url={previewUrl}
            title={`${site?.name} ${channel?.label}`}
          />
        ) : (
          <div className="grid h-full place-items-center p-4 text-center text-sm text-slate-400">
            {!channel
              ? "Kamera dihapus dari katalog. Pilih Ganti."
              : !channel.embedUrl
                ? "Tautan siaran tidak tersedia"
                : active
                  ? "Menyiapkan koneksi…"
                  : "Dijeda · tidak mengunduh video"}
          </div>
        )}
        {canPlay &&
          focused &&
          !fallback &&
          video &&
          process.env.NEXT_PUBLIC_ENABLE_CCTV_AI === "true" && (
            <DetectionOverlay
              video={video}
              eligible={Boolean(channel?.playback.aiEligible)}
              generationKey={`${id}-${reload}`}
              controlsTarget={controls}
            />
          )}
      </div>
      {active && status !== "Siaran aktif" && (
        <p className="mt-2 text-xs text-slate-300">{status}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className={monitorButton} onClick={onFocus}>
          {focused ? "Tutup fokus" : "Fokus"}
        </button>
        <details className="min-w-0 flex-1">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm text-sky-200">
            Opsi kamera
          </summary>
          <p className="mb-2 text-xs text-slate-300">
            {site?.agency} · {active ? status : "Dijeda"}
          </p>
          <p className="mb-2 text-xs tabular-nums text-slate-300">
            {active && time
              ? `${time} WIB · ${aligned ? "Dalam grup sinkron" : "Waktu sumber"}`
              : "Waktu tidak tersedia"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className={monitorButton}
              onClick={() => {
                const tile = tileRef.current;
                if (!tile?.requestFullscreen) {
                  setStatus("Layar penuh tidak didukung browser");
                  return;
                }
                void tile
                  .requestFullscreen()
                  .catch(() => setStatus("Layar penuh tidak didukung browser"));
              }}
            >
              Layar penuh
            </button>
            <button
              className={monitorButton}
              disabled={!active || !channel?.embedUrl}
              onClick={() => setReload((v) => v + 1)}
            >
              Coba lagi
            </button>
            <button
              className={monitorButton}
              disabled={index === 0}
              aria-label={`Pindah kamera ${index + 1} lebih awal`}
              onClick={() => onMove(-1)}
            >
              ←
            </button>
            <button
              className={monitorButton}
              aria-label={`Pindah kamera ${index + 1} lebih akhir`}
              onClick={() => onMove(1)}
            >
              →
            </button>
            <button className={monitorButton} onClick={onReplace}>
              Ganti
            </button>
            <button className={monitorButton} onClick={onRemove}>
              Hapus
            </button>
            {channel && (
              <a
                href={channel.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className={monitorButton}
              >
                Sumber ↗
              </a>
            )}
          </div>
        </details>
      </div>
      {focused && <div ref={setControls} className="mt-3" />}
    </article>
  );
}
