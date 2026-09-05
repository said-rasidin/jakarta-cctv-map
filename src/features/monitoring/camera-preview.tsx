"use client";
import { useEffect, useState } from "react";

export function CameraPreview({ url, title }: { url: string; title: string }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  useEffect(() => {
    const timer = window.setTimeout(
      () => setState((value) => (value === "loading" ? "failed" : value)),
      12000,
    );
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="relative h-full w-full bg-slate-800">
      {state !== "failed" && (
        // Public snapshots are fetched directly; do not proxy camera image traffic through Vercel.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Pratinjau ${title}`}
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          className={`h-full w-full object-contain ${state === "ready" ? "" : "invisible"}`}
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
        />
      )}
      {state !== "ready" && (
        <div className="absolute inset-0 grid place-content-center gap-2 p-4 text-center text-sm text-slate-300">
          <span>
            {state === "loading"
              ? "Memuat pratinjau…"
              : "Pratinjau tidak tersedia"}
          </span>
          <span className="text-xs">
            Mulai monitor untuk mencoba siaran video.
          </span>
        </div>
      )}
      <p className="absolute inset-x-0 bottom-0 bg-slate-950/90 px-3 py-2 text-xs text-slate-200">
        Pratinjau · bukan siaran langsung · waktu gambar tidak terverifikasi
      </p>
    </div>
  );
}
