"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DetectionCanvas } from "@/features/detection/components/detection-canvas";
import { DetectionControls, type DetectionState } from "@/features/detection/components/detection-controls";
import { isModelCatalog, type ModelCatalog, type ModelPrecision, type ModelVariant } from "@/features/detection/model-catalog";
import { COCO_LABELS, type Detection } from "@/features/detection/postprocess";

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
  const [lastResultAt, setLastResultAt] = useState(0);
  const [latency, setLatency] = useState(0);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ModelVariant>("nano");
  const [selectedPrecision, setSelectedPrecision] = useState<ModelPrecision>("fp16");

  const selectedManifest = catalog?.models.find(({ manifest }) => manifest.variant === selectedVariant && manifest.precision === selectedPrecision)?.manifest;

  const clear = useCallback(() => { setDetections([]); setLastResultAt(0); }, []);

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
    if (!enabled || !eligible || !video || !selectedManifest) return;
    let cancelled = false;
    const manifest = selectedManifest;
    const generation = ++generationRef.current;
    lastSampleRef.current = Number.NEGATIVE_INFINITY;
    intervalRef.current = 200;
    setState("checking");
    setStatus("Memeriksa model AI…");
    const worker = new Worker(new URL("../workers/inference.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

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
        const resultLatency = Number(event.data.latencyMs);
        setLatency(resultLatency);
        // busyRef prevents overlapping work; a short interval means the next inference uses
        // the newest decoded frame immediately instead of waiting behind stale frames.
        intervalRef.current = Math.max(100, Math.min(500, resultLatency * 0.25));
        setSourceSize({ width: Number(event.data.sourceWidth), height: Number(event.data.sourceHeight) });
        setDetections(event.data.detections as Detection[]);
        setLastResultAt(Date.now());
      } else if (event.data.type === "error") {
        busyRef.current = false;
        setState("error");
        setStatus(String(event.data.message));
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
      createImageBitmap(video).then((bitmap) => worker.postMessage({ type: "infer", bitmap, sourceWidth: video.videoWidth, sourceHeight: video.videoHeight, generation, confidence: 0.35 }, [bitmap])).catch(() => { busyRef.current = false; });
    };
    const sample = (_now: number, metadata: VideoFrameCallbackMetadata) => {
      if (cancelled) return;
      callbackRef.current = video.requestVideoFrameCallback(sample);
      capture(metadata.mediaTime * 1000);
    };
    let fallbackTimer: number | null = null;
    if (typeof video.requestVideoFrameCallback === "function") callbackRef.current = video.requestVideoFrameCallback(sample);
    else fallbackTimer = window.setInterval(() => capture(video.currentTime * 1000), 250);
    const visibility = () => { if (document.hidden) { clear(); setStatus("AI dijeda saat tab tersembunyi"); } };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelled = true;
      if (callbackRef.current !== null) video.cancelVideoFrameCallback(callbackRef.current);
      if (fallbackTimer !== null) window.clearInterval(fallbackTimer);
      document.removeEventListener("visibilitychange", visibility);
      worker.postMessage({ type: "dispose" });
      worker.terminate();
      workerRef.current = null;
      busyRef.current = false;
      readyRef.current = false;
      clear();
    };
  }, [enabled, eligible, video, generationKey, clear, selectedManifest]);

  const counts = detections.reduce<Record<string, number>>((result, detection) => { const label = COCO_LABELS[detection.classId] ?? String(detection.classId); result[label] = (result[label] ?? 0) + 1; return result; }, {});
  const toggle = () => { if (enabled) { setEnabled(false); setState("off"); setStatus("AI tidak aktif"); } else { setEnabled(true); } };
  const selectVariant = (variant: ModelVariant) => {
    setSelectedVariant(variant);
    if (!catalog?.models.some(({ manifest }) => manifest.variant === variant && manifest.precision === selectedPrecision)) {
      const fallback = catalog?.models.find(({ manifest }) => manifest.variant === variant);
      if (fallback) setSelectedPrecision(fallback.manifest.precision);
    }
  };

  return <>
    <DetectionCanvas detections={detections} sourceSize={sourceSize} lastResultAt={lastResultAt} />
    {controlsTarget && createPortal(<>
      <DetectionControls
        generationKey={generationKey} state={state} status={status} progress={progress}
        provider={provider} latency={latency} counts={counts} catalog={catalog}
        selectedVariant={selectedVariant} selectedPrecision={selectedPrecision}
        enabled={enabled} canEnable={Boolean(eligible && video && selectedManifest)}
        onVariantChange={selectVariant} onPrecisionChange={setSelectedPrecision} onToggle={toggle}
      />
      {enabled && <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-emerald-300"><ShieldCheck size={11} /> Frame diproses lokal, tidak diunggah · Eksperimental</p>}
    </>, controlsTarget)}
  </>;
}
