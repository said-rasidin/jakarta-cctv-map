/// <reference lib="webworker" />

import type { InferenceSession, Tensor } from "onnxruntime-web";
import { mapModelBoxToSource, parseYoloOutput, type ModelManifest } from "../lib/ai";

type OrtModule = typeof import("onnxruntime-web");
type InitMessage = { type: "init"; manifest: ModelManifest };
type InferMessage = { type: "infer"; bitmap: ImageBitmap; sourceWidth: number; sourceHeight: number; generation: number; confidence: number };

let ort: OrtModule | null = null;
let session: InferenceSession | null = null;
let manifest: ModelManifest | null = null;
let provider = "CPU";
let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;
let inputBuffer: Float32Array | null = null;

const send = (message: object) => self.postMessage(message);

async function downloadModel(modelManifest: ModelManifest) {
  const response = await fetch(modelManifest.modelUrl, { cache: "force-cache", credentials: "same-origin" });
  if (!response.ok) throw new Error(response.status === 404 ? "Model YOLO belum dipasang" : `Unduhan model gagal (${response.status})`);
  const contentLength = Number(response.headers.get("content-length")) || modelManifest.byteSize;
  const reader = response.body?.getReader();
  if (!reader) return response.arrayBuffer();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    send({ type: "progress", received, total: contentLength });
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (modelManifest.byteSize && bytes.byteLength !== modelManifest.byteSize) throw new Error("Ukuran model tidak sesuai manifest");
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) => value.toString(16).padStart(2, "0")).join("");
  if (hash !== modelManifest.sha256.toLowerCase()) throw new Error("Checksum model tidak sesuai manifest");
  return bytes.buffer;
}

async function createSession(modelManifest: ModelManifest) {
  const model = await downloadModel(modelManifest);
  const hasWebGpu = Boolean((self.navigator as WorkerNavigator & { gpu?: unknown }).gpu);
  if (hasWebGpu) {
    try {
      ort = await import("onnxruntime-web/webgpu");
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = "/ort/";
      session = await ort.InferenceSession.create(model, { executionProviders: ["webgpu"] });
      provider = "WebGPU";
      return;
    } catch {
      session?.release();
      session = null;
      ort = null;
    }
  }
  if (modelManifest.precision === "fp16") throw new Error("Model FP16 memerlukan browser dengan WebGPU");
  ort = await import("onnxruntime-web");
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = "/ort/";
  session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
  provider = "CPU";
}

function float16ToFloat32(value: number) {
  const sign = (value & 0x8000) ? -1 : 1;
  const exponent = (value >> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 31) return fraction ? Number.NaN : sign * Number.POSITIVE_INFINITY;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

async function initialize(modelManifest: ModelManifest) {
  manifest = modelManifest;
  await createSession(modelManifest);
  canvas = new OffscreenCanvas(modelManifest.input.width, modelManifest.input.height);
  context = canvas.getContext("2d", { willReadFrequently: true });
  inputBuffer = new Float32Array(3 * modelManifest.input.width * modelManifest.input.height);
  if (!context) throw new Error("Canvas pemrosesan tidak tersedia");
  send({ type: "ready", provider });
}

async function infer(message: InferMessage) {
  const startedAt = performance.now();
  let tensor: Tensor | null = null;
  try {
    if (!session || !ort || !manifest || !canvas || !context || !inputBuffer) throw new Error("Model belum siap");
    const width = manifest.input.width;
    const height = manifest.input.height;
    const scale = Math.min(width / message.sourceWidth, height / message.sourceHeight);
    const drawWidth = message.sourceWidth * scale;
    const drawHeight = message.sourceHeight * scale;
    const padX = (width - drawWidth) / 2;
    const padY = (height - drawHeight) / 2;
    context.fillStyle = "#727272";
    context.fillRect(0, 0, width, height);
    context.drawImage(message.bitmap, padX, padY, drawWidth, drawHeight);
    const pixels = context.getImageData(0, 0, width, height).data;
    const plane = width * height;
    for (let pixel = 0; pixel < plane; pixel++) {
      const rgba = pixel * 4;
      inputBuffer[pixel] = pixels[rgba] / 255;
      inputBuffer[plane + pixel] = pixels[rgba + 1] / 255;
      inputBuffer[plane * 2 + pixel] = pixels[rgba + 2] / 255;
    }
    tensor = new ort.Tensor("float32", inputBuffer, [1, 3, height, width]);
    const outputs = await session.run({ [manifest.input.name]: tensor });
    const output = outputs[manifest.output.name] ?? Object.values(outputs)[0];
    if (!output || !(output.data instanceof Float32Array || output.data instanceof Uint16Array)) throw new Error("Output model tidak didukung");
    const outputValues = output.data instanceof Uint16Array ? Float32Array.from(output.data, float16ToFloat32) : output.data;
    const detections = parseYoloOutput(outputValues, message.confidence).map((box) => mapModelBoxToSource(box, message.sourceWidth, message.sourceHeight, width, height));
    for (const value of Object.values(outputs)) value.dispose?.();
    send({ type: "result", detections, generation: message.generation, sourceWidth: message.sourceWidth, sourceHeight: message.sourceHeight, latencyMs: performance.now() - startedAt });
  } catch (error) {
    send({ type: "error", message: error instanceof Error ? error.message : "Inferensi gagal", recoverable: true });
  } finally {
    tensor?.dispose?.();
    message.bitmap.close();
  }
}

self.onmessage = (event: MessageEvent<InitMessage | InferMessage | { type: "dispose" }>) => {
  if (event.data.type === "init") initialize(event.data.manifest).catch((error) => send({ type: "error", message: error instanceof Error ? error.message : "Model gagal dimuat", recoverable: false }));
  if (event.data.type === "infer") void infer(event.data);
  if (event.data.type === "dispose") { session?.release(); session = null; self.close(); }
};

export {};
