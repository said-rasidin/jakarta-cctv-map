"use client";

import { Bot, Pause, Play } from "lucide-react";
import type { ModelCatalog, ModelPrecision, ModelVariant } from "@/features/detection/model-catalog";

export type DetectionState = "off" | "checking" | "downloading" | "warming" | "running" | "paused" | "error";

export function DetectionControls({ generationKey, state, status, progress, provider, latency, fps, pendingChange, onApply, counts, catalog, selectedVariant, selectedPrecision, enabled, canEnable, onVariantChange, onPrecisionChange, onToggle }: {
  generationKey: string;
  state: DetectionState;
  status: string;
  progress: number;
  provider: string;
  latency: number;
  fps: number;
  pendingChange: boolean;
  onApply: () => void;
  counts: Record<string, number>;
  catalog: ModelCatalog | null;
  selectedVariant: ModelVariant;
  selectedPrecision: ModelPrecision;
  enabled: boolean;
  canEnable: boolean;
  onVariantChange: (variant: ModelVariant) => void;
  onPrecisionChange: (precision: ModelPrecision) => void;
  onToggle: () => void;
}) {
  const variants = [...new Set(catalog?.models.map(({ manifest }) => manifest.variant) ?? [])];
  const precisions = [...new Set(catalog?.models.filter(({ manifest }) => manifest.variant === selectedVariant).map(({ manifest }) => manifest.precision) ?? [])];
  const selected = catalog?.models.find(({ manifest }) => manifest.variant === selectedVariant && manifest.precision === selectedPrecision)?.manifest;

  return <div className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
    <div className="text-[11px] text-slate-200">
      <p role="status" className="flex items-center gap-1.5 text-sm font-semibold"><Bot size={16} /> {status}</p>
      {state === "downloading" && <div className="mt-1 h-1.5 w-36 overflow-hidden rounded-full bg-slate-700"><div className="h-full bg-sky-400" style={{ width: `${progress}%` }} /></div>}
      {state === "running" && <p className="mt-1 text-xs text-slate-400">{provider} · {latency ? `${Math.round(latency)} ms · ${fps.toFixed(1)} hasil/detik` : "pemanasan"} · {Object.entries(counts).map(([label, count]) => `${label} ${count}`).join(" · ") || "belum ada objek"}</p>}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs text-slate-300" htmlFor={`ai-model-${generationKey}`}>Model</label>
      <select id={`ai-model-${generationKey}`} value={selectedVariant} onChange={(event) => onVariantChange(event.target.value as ModelVariant)} disabled={!catalog} className="min-h-11 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100 disabled:opacity-60">
        {variants.map((variant) => <option key={variant} value={variant}>{variant[0].toUpperCase() + variant.slice(1)}</option>)}
      </select>
      <label className="text-xs text-slate-300" htmlFor={`ai-precision-${generationKey}`}>Precision</label>
      <select id={`ai-precision-${generationKey}`} value={selectedPrecision} onChange={(event) => onPrecisionChange(event.target.value as ModelPrecision)} disabled={!catalog} className="min-h-11 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100 disabled:opacity-60">
        {precisions.map((precision) => <option key={precision} value={precision}>{precision.toUpperCase()}</option>)}
        <option value="int4" disabled>INT4 (N/A)</option>
      </select>
      {pendingChange && <button type="button" onClick={onApply} disabled={!canEnable} className="min-h-11 rounded-md bg-sky-400 px-3 text-sm font-semibold text-slate-950 disabled:opacity-50">Terapkan & mulai ulang</button>}
      <button type="button" onClick={onToggle} disabled={!enabled && !canEnable} className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-sky-400/50 px-3 text-sm font-semibold text-sky-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500">
        {enabled ? <Pause size={13} /> : <Play size={13} />} {enabled ? "Matikan AI" : "Coba AI"}
      </button>
    </div>
    <p className="text-xs text-slate-400">{selected ? `Unduhan ${(selected.byteSize / 1024 / 1024).toFixed(1)} MB. ` : ""}Nano paling ringan. Kecepatan precision bergantung perangkat; INT4 belum tersedia.</p>
  </div>;
}
