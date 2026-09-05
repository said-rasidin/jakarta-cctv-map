"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DetectionCanvas } from "@/features/detection/components/detection-canvas";
import { DetectionControls, type DetectionState } from "@/features/detection/components/detection-controls";
import { isModelCatalog, type ModelCatalog, type ModelPrecision, type ModelVariant } from "@/features/detection/model-catalog";
import { COCO_LABELS, type Detection } from "@/features/detection/postprocess";
import { remainingFrameLifetime } from "@/features/detection/frame-timing";

export function DetectionOverlay({ video, eligible, generationKey, controlsTarget }: { video: HTMLVideoElement | null; eligible: boolean; generationKey: string; controlsTarget: HTMLElement | null }) {
  const workerRef = useRef<Worker | null>(null);
  const busyRef = useRef(false);
  const readyRef = useRef(false);
  const generationRef = useRef(0);
  const lastSampleRef = useRef(0);
  const intervalRef = useRef(200);
  const callbackRef = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<DetectionState>("off");
  const [status, setStatus] = useState("AI tidak aktif");
  const [provider, setProvider] = useState("");
  const [progress, setProgress] = useState(0);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [sourceSize, setSourceSize] = useState({ width: 1, height: 1 });
  const [latency, setLatency] = useState(0);
  const [fps, setFps] = useState(0);
  const [appliedModel, setAppliedModel] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ModelVariant>("nano");
  const [selectedPrecision, setSelectedPrecision] = useState<ModelPrecision>("fp16");

  const selectedManifest = catalog?.models.find(({ manifest }) => manifest.variant === selectedVariant && manifest.precision === selectedPrecision)?.manifest;
  const activeManifest = catalog?.models.find(({ id }) => id === appliedModel)?.manifest;

  const clear = useCallback(() => { setDetections([]); }, []);

  useEffect(() => {
    generationRef.current += 1;
    setEnabled(false);
    setState("off");
    setStatus("AI tidak aktif");
    lastSampleRef.current = Number.NEGATIVE_INFINITY;
    intervalRef.current = 200;
    clear();
  }, [generationKey, clear]);

  useEffect(() => {
    let cancelled = false;
    fetch("/models/yolo26n/catalog.json", { cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Model YOLO belum dipasang. Lihat public/models/README.md.");
        const value: unknown = await response.json();
        if (!isModelCatalog(value)) throw new Error("Katalog model AI tidak valid");
        if (cancelled) return;
        setCatalog(value);
        const selected = value.models.find((model) => model.id === value.defaultModel) ?? value.models[0];
        setSelectedVariant(selected.manifest.variant);
        setSelectedPrecision(selected.manifest.precision);
      })
      .catch((error) => {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "Katalog model gagal dimuat");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!enabled || !eligible || !video || !activeManifest) return;
    let cancelled = false;
    let expiryTimer: number | undefined;
    let previousResult = 0;
    let capturedAt = 0;
    let capturedMediaTime = 0;
    const manifest = activeManifest;
    const generation = ++generationRef.current;
    lastSampleRef.current = Number.NEGATIVE_INFINITY;
    intervalRef.current = 200;
    setLatency(0); setFps(0); setProgress(0); setProvider("");
    setState("checking");
    setStatus("Memeriksa model AI…");
    const worker = new Worker(new URL("../workers/inference.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const fail = (message: string) => {
      readyRef.current = false;
      busyRef.current = false;
      setEnabled(false);
      setState("error");
      setStatus(message);
      clear();
    };
    worker.onerror = () => fail("AI berhenti karena kesalahan pemrosesan. Coba model Nano lalu mulai lagi.");
    worker.onmessageerror = () => fail("Hasil AI tidak dapat dibaca. Mulai AI lagi.");

    worker.onmessage = (event: MessageEvent<Record<string, unknown>>) => {
      if (cancelled) return;
      if (event.data.type === "progress") {
        setState("downloading");
        const total = Number(event.data.total);
        setProgress(total ? Math.min(100, Math.round(Number(event.data.received) / total * 100)) : 0);
        setStatus("Mengunduh model AI…");
      } else if (event.data.type === "ready") {
        readyRef.current = true;
        setProvider(String(event.data.provider));
        setState("running");
        setStatus("AI berjalan di perangkat ini");
      } else if (event.data.type === "result" && Number(event.data.generation) === generation) {
        busyRef.current = false;
        const now = performance.now();
        const resultLatency = now - capturedAt;
        setLatency(resultLatency);
        setFps(previousResult ? 1000 / (now - previousResult) : 0);
        previousResult = now;
        // busyRef prevents overlapping work; a short interval means the next inference uses
        // the newest decoded frame immediately instead of waiting behind stale frames.
        intervalRef.current = Math.max(100, Math.min(500, resultLatency * 0.25));
        window.clearTimeout(expiryTimer);
        if (document.hidden || video.paused) { clear(); return; }
        const lifetime = remainingFrameLifetime(resultLatency, capturedMediaTime, video.currentTime * 1000);
        if (!lifetime) {
          clear();
          setStatus("AI terlalu lambat; coba Nano atau precision lain. Box terlambat disembunyikan.");
          return;
        }
        setState("running");
        setStatus("AI berjalan di perangkat ini");
        setSourceSize({ width: Number(event.data.sourceWidth), height: Number(event.data.sourceHeight) });
        setDetections(event.data.detections as Detection[]);
        expiryTimer = window.setTimeout(clear, lifetime);
      } else if (event.data.type === "error") {
        fail(String(event.data.message));
      }
    };

    setState("warming");
    setStatus(`Menyiapkan ${manifest.modelName} (${(manifest.byteSize / 1024 / 1024).toFixed(1)} MB)…`);
    worker.postMessage({ type: "init", manifest });

    const probe = document.createElement("canvas");
    probe.width = 2; probe.height = 2;
    try { const context = probe.getContext("2d"); context?.drawImage(video, 0, 0, 2, 2); context?.getImageData(0, 0, 1, 1); }
    catch { setState("error"); setStatus("Sumber video tidak mengizinkan analisis frame"); setEnabled(false); }

    const capture = (mediaTimeMs: number) => {
      if (cancelled || !readyRef.current || document.hidden || video.paused || busyRef.current || mediaTimeMs - lastSampleRef.current < intervalRef.current) return;
      lastSampleRef.current = mediaTimeMs;
      busyRef.current = true;
      capturedAt = performance.now();
      capturedMediaTime = mediaTimeMs;
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      createImageBitmap(video).then((bitmap) => {
        if (cancelled) { bitmap.close(); return; }
        worker.postMessage({ type: "infer", bitmap, sourceWidth, sourceHeight, generation, confidence: 0.35 }, [bitmap]);
      }).catch(() => { if (!cancelled) fail("Frame video tidak dapat dianalisis. Coba mulai AI lagi."); });
    };
    const sample = (_now: number, metadata: VideoFrameCallbackMetadata) => {
      if (cancelled) return;
      callbackRef.current = video.requestVideoFrameCallback(sample);
      capture(metadata.mediaTime * 1000);
    };
    let fallbackTimer: number | null = null;
    if (typeof video.requestVideoFrameCallback === "function") callbackRef.current = video.requestVideoFrameCallback(sample);
    else fallbackTimer = window.setInterval(() => capture(video.currentTime * 1000), 250);
    const visibility = () => {
      if (!readyRef.current) return;
      clear();
      previousResult = 0; setFps(0);
      lastSampleRef.current = Number.NEGATIVE_INFINITY;
      const paused = document.hidden || video.paused;
      setState(paused ? "paused" : "running");
      setStatus(paused ? "AI dijeda saat video atau tab tidak aktif" : "AI berjalan di perangkat ini");
    };
    document.addEventListener("visibilitychange", visibility);
    video.addEventListener("pause", visibility);
    video.addEventListener("playing", visibility);
    video.addEventListener("seeking", visibility);
    return () => {
      cancelled = true;
      if (callbackRef.current !== null) video.cancelVideoFrameCallback(callbackRef.current);
      if (fallbackTimer !== null) window.clearInterval(fallbackTimer);
      document.removeEventListener("visibilitychange", visibility);
      video.removeEventListener("pause", visibility);
      video.removeEventListener("playing", visibility);
      video.removeEventListener("seeking", visibility);
      window.clearTimeout(expiryTimer);
      worker.postMessage({ type: "dispose" });
      worker.terminate();
      workerRef.current = null;
      busyRef.current = false;
      readyRef.current = false;
      clear();
    };
  }, [enabled, eligible, video, generationKey, clear, activeManifest]);

  const counts = detections.reduce<Record<string, number>>((result, detection) => { const label = COCO_LABELS[detection.classId] ?? String(detection.classId); result[label] = (result[label] ?? 0) + 1; return result; }, {});
  const apply = () => {
    setAppliedModel(catalog?.models.find(({ manifest }) => manifest === selectedManifest)?.id ?? null);
    setEnabled(true);
  };
  const toggle = () => { if (enabled) { setEnabled(false); setState("off"); setStatus("AI tidak aktif"); } else { apply(); } };
  const selectVariant = (variant: ModelVariant) => {
    setSelectedVariant(variant);
    if (!catalog?.models.some(({ manifest }) => manifest.variant === variant && manifest.precision === selectedPrecision)) {
      const fallback = catalog?.models.find(({ manifest }) => manifest.variant === variant);
      if (fallback) setSelectedPrecision(fallback.manifest.precision);
    }
  };

  return <>
    <DetectionCanvas detections={detections} sourceSize={sourceSize} />
    {controlsTarget && createPortal(<>
      <DetectionControls
        generationKey={generationKey} state={state} status={status} progress={progress}
        provider={provider} latency={latency} fps={fps} counts={counts} catalog={catalog}
        pendingChange={enabled && selectedManifest !== activeManifest} onApply={apply}
        selectedVariant={selectedVariant} selectedPrecision={selectedPrecision}
        enabled={enabled} canEnable={Boolean(eligible && video && selectedManifest)}
        onVariantChange={selectVariant} onPrecisionChange={setSelectedPrecision} onToggle={toggle}
      />
      {enabled && <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-emerald-300"><ShieldCheck size={11} /> Frame diproses lokal, tidak diunggah · Eksperimental</p>}
    </>, controlsTarget)}
  </>;
}
