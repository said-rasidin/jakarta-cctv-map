export const DISPLAYED_CLASS_IDS = new Set([0, 1, 2, 3, 5, 7]);

export const COCO_LABELS: Record<number, string> = {
  0: "orang",
  1: "sepeda",
  2: "mobil",
  3: "motor",
  5: "bus",
  7: "truk",
};

export type Detection = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  classId: number;
};

export function mapModelBoxToSource(detection: Detection, sourceWidth: number, sourceHeight: number, inputWidth: number, inputHeight: number): Detection {
  const scale = Math.min(inputWidth / sourceWidth, inputHeight / sourceHeight);
  const padX = (inputWidth - sourceWidth * scale) / 2;
  const padY = (inputHeight - sourceHeight * scale) / 2;
  const x = (value: number) => Math.max(0, Math.min(sourceWidth, (value - padX) / scale));
  const y = (value: number) => Math.max(0, Math.min(sourceHeight, (value - padY) / scale));
  return { ...detection, x1: x(detection.x1), y1: y(detection.y1), x2: x(detection.x2), y2: y(detection.y2) };
}

export function parseYoloOutput(values: Float32Array, confidence: number) {
  const detections: Detection[] = [];
  for (let index = 0; index + 5 < values.length; index += 6) {
    const classId = Math.round(values[index + 5]);
    if (values[index + 4] >= confidence && DISPLAYED_CLASS_IDS.has(classId)) {
      detections.push({ x1: values[index], y1: values[index + 1], x2: values[index + 2], y2: values[index + 3], confidence: values[index + 4], classId });
    }
  }
  return detections;
}
