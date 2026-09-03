"use client";

import { Bot, Pause, Play } from "lucide-react";
import type { ModelCatalog, ModelPrecision, ModelVariant } from "@/features/detection/model-catalog";

export type DetectionState = "off" | "checking" | "downloading" | "warming" | "running" | "paused" | "error";

export function DetectionControls({ generationKey, state, status, progress, provider, latency, counts, catalog, selectedVariant, selectedPrecision, enabled, canEnable, onVariantChange, onPrecisionChange, onToggle }: {
  generationKey: string;
  state: DetectionState;
  status: string;
  progress: number;
  provider: string;
  latency: number;
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

  return <div className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-900/70 p-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="text-[11px] text-slate-200">
      <p className="flex items-center gap-1.5 font-semibold"><Bot size={13} /> {status}</p>
      {state === "downloading" && <div className="mt-1 h-1.5 w-36 overflow-hidden rounded-full bg-slate-700"><div className="h-full bg-sky-400" style={{ width: `${progress}%` }} /></div>}
      {state === "running" && <p className="mt-1 text-slate-400">{provider} · {latency ? `${Math.round(latency)} ms · ~${Math.max(0.1, Math.min(10, 1000 / latency)).toFixed(1)} FPS` : "pemanasan"} · {Object.entries(counts).map(([label, count]) => `${label} ${count}`).join(" · ") || "belum ada objek"}</p>}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`ai-model-${generationKey}`}>Ukuran model AI</label>
      <select id={`ai-model-${generationKey}`} value={selectedVariant} onChange={(event) => onVariantChange(event.target.value as ModelVariant)} disabled={enabled || !catalog} className="max-w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 disabled:cursor-not-allowed disabled:opacity-60" title={enabled ? "Matikan AI untuk mengganti model" : "Ukuran model AI"}>
        {variants.map((variant) => <option key={variant} value={variant}>{variant[0].toUpperCase() + variant.slice(1)}</option>)}
      </select>
      <label className="sr-only" htmlFor={`ai-precision-${generationKey}`}>Precision model AI</label>
      <select id={`ai-precision-${generationKey}`} value={selectedPrecision} onChange={(event) => onPrecisionChange(event.target.value as ModelPrecision)} disabled={enabled || !catalog} className="max-w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 disabled:cursor-not-allowed disabled:opacity-60" title={enabled ? "Matikan AI untuk mengganti precision" : "Precision model AI"}>
        {precisions.map((precision) => <option key={precision} value={precision}>{precision.toUpperCase()}</option>)}
        <option value="int4" disabled>INT4 (N/A)</option>
      </select>
      <button type="button" onClick={onToggle} disabled={!canEnable} className="inline-flex items-center gap-1.5 rounded-md border border-sky-400/50 px-2.5 py-1.5 text-xs font-semibold text-sky-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500">
        {enabled ? <Pause size={13} /> : <Play size={13} />} {enabled ? "Matikan AI" : "Coba AI"}
      </button>
    </div>
  </div>;
}
