import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve("node_modules/onnxruntime-web/dist");
const target = resolve("public/ort");
const files = [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
];

await mkdir(target, { recursive: true });
await Promise.all(files.map((file) => copyFile(resolve(source, file), resolve(target, file))));
console.log(`Copied ${files.length} ONNX Runtime browser assets.`);
