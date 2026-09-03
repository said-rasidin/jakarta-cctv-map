"use client";

import { useEffect, useRef } from "react";
import { COCO_LABELS, type Detection } from "@/features/detection/postprocess";

const COLORS: Record<number, string> = { 0: "#38bdf8", 1: "#a78bfa", 2: "#34d399", 3: "#fbbf24", 5: "#fb7185", 7: "#f97316" };

export function DetectionCanvas({ detections, sourceSize, lastResultAt }: {
  detections: Detection[];
  sourceSize: { width: number; height: number };
  lastResultAt: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      context.globalAlpha = lastResultAt && Date.now() - lastResultAt > 2500 ? 0.3 : 1;
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

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}
