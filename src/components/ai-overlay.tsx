"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { Bot, Pause, Play, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { COCO_LABELS, isModelCatalog, type Detection, type ModelCatalog } from "@/lib/ai";

type AiState = "off" | "checking" | "downloading" | "warming" | "running" | "paused" | "error";
const COLORS: Record<number, string> = { 0: "#38bdf8", 1: "#a78bfa", 2: "#34d399", 3: "#fbbf24", 5: "#fb7185", 7: "#f97316" };

export function AiOverlay({ video, eligible, generationKey }: { video: HTMLVideoElement | null; eligible: boolean; generationKey: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const busyRef = useRef(false);
  const readyRef = useRef(false);
  const generationRef = useRef(0);
  const lastSampleRef = useRef(0);
  const intervalRef = useRef(1000);
  const callbackRef = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<AiState>("off");
  const [status, setStatus] = useState("AI tidak aktif");
  const [provider, setProvider] = useState("");
  const [progress, setProgress] = useState(0);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [sourceSize, setSourceSize] = useState({ width: 1, height: 1 });
  const [lastResultAt, setLastResultAt] = useState(0);
  const [latency, setLatency] = useState(0);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [selectedModel, setSelectedModel] = useState("");

  const selectedManifest = catalog?.models.find((model) => model.id === selectedModel)?.manifest;

  const clear = useCallback(() => { setDetections([]); setLastResultAt(0); }, []);

  useEffect(() => {
    generationRef.current += 1;
    setEnabled(false);
    setState("off");
    setStatus("AI tidak aktif");
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
        const preferred = value.models.find((model) => model.manifest.variant === "nano" && model.manifest.precision === "fp16");
        setSelectedModel(preferred?.id ?? value.defaultModel);
      })
      .catch((error) => {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "Katalog model gagal dimuat");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(ratio, ratio);
      context.clearRect(0, 0, rect.width, rect.height);
      const scale = Math.min(rect.width / sourceSize.width, rect.height / sourceSize.height);
      const offsetX = (rect.width - sourceSize.width * scale) / 2;
      const offsetY = (rect.height - sourceSize.height * scale) / 2;
      const staleAlpha = lastResultAt && Date.now() - lastResultAt > 2500 ? 0.3 : 1;
      context.globalAlpha = staleAlpha;
      context.font = "600 12px Arial";
      context.lineWidth = 2;
      for (const box of detections) {
        const color = COLORS[box.classId] ?? "#e2e8f0";
        const x = offsetX + box.x1 * scale;
        const y = offsetY + box.y1 * scale;
        const width = (box.x2 - box.x1) * scale;
        const height = (box.y2 - box.y1) * scale;
        const label = `${COCO_LABELS[box.classId] ?? box.classId} ${Math.round(box.confidence * 100)}%`;
        const labelWidth = context.measureText(label).width + 10;
        context.strokeStyle = color;
        context.strokeRect(x, y, width, height);
        context.fillStyle = color;
        context.fillRect(x, Math.max(0, y - 20), labelWidth, 20);
        context.fillStyle = "#07111f";
        context.fillText(label, x + 5, Math.max(14, y - 6));
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    const timer = window.setInterval(draw, 1000);
    return () => { observer.disconnect(); window.clearInterval(timer); };
  }, [detections, lastResultAt, sourceSize]);

  useEffect(() => {
    if (!enabled || !eligible || !video || !selectedManifest) return;
    let cancelled = false;
    const manifest = selectedManifest;
    const generation = ++generationRef.current;
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
        intervalRef.current = Math.max(334, Math.min(2000, resultLatency * 2));
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

  return <>
    <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
    <div className="absolute top-2 left-2 right-2 flex flex-wrap items-start justify-between gap-2">
      <div className="rounded-lg bg-slate-950/85 px-2.5 py-2 text-[11px] text-slate-200 backdrop-blur">
        <p className="flex items-center gap-1.5 font-semibold"><Bot size={13} /> {status}</p>
        {state === "downloading" && <div className="mt-1 h-1.5 w-36 overflow-hidden rounded-full bg-slate-700"><div className="h-full bg-sky-400" style={{ width: `${progress}%` }} /></div>}
        {state === "running" && <p className="mt-1 text-slate-400">{provider} · {latency ? `${Math.round(latency)} ms` : "pemanasan"} · {Object.entries(counts).map(([label, count]) => `${label} ${count}`).join(" · ") || "belum ada objek"}</p>}
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-slate-950/90 p-1.5 backdrop-blur">
        <label className="sr-only" htmlFor={`ai-model-${generationKey}`}>Pilih model AI</label>
        <select id={`ai-model-${generationKey}`} value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} disabled={enabled || !catalog} className="max-w-40 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 disabled:cursor-not-allowed disabled:opacity-60" title={enabled ? "Matikan AI untuk mengganti model" : "Pilih model AI"}>
          {!catalog && <option value="">Memuat model…</option>}
          {catalog?.models.map(({ id, manifest }) => <option key={id} value={id}>{manifest.variant[0].toUpperCase() + manifest.variant.slice(1)} · {manifest.precision.toUpperCase()}</option>)}
        </select>
        <button type="button" onClick={toggle} disabled={!eligible || !video || !selectedManifest} className="inline-flex items-center gap-1.5 rounded-md border border-sky-400/50 px-2.5 py-1.5 text-xs font-semibold text-sky-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500">
          {enabled ? <Pause size={13} /> : <Play size={13} />} {enabled ? "Matikan AI" : "Coba AI"}
        </button>
      </div>
    </div>
    {enabled && <p className="absolute bottom-12 left-2 inline-flex items-center gap-1 rounded bg-slate-950/80 px-2 py-1 text-[10px] text-emerald-200"><ShieldCheck size={11} /> Frame diproses lokal, tidak diunggah · Eksperimental</p>}
  </>;
}
