# Local YOLO26 model

The CCTV viewer loads no AI code or model until the user presses **Coba AI**. The ONNX model is intentionally not committed because its redistribution and use must follow the Ultralytics license.

From the repository root, create a Python environment, install the pinned exporter dependencies, and run:

```powershell
py -m pip install -r requirements-ai.txt
py scripts/export-yolo26n.py --variant all --precision fp16 --imgsz 416
```

Use `--variant all|nano|small|medium` and `--precision fp32|fp16` to experiment. The defaults are all three sizes and FP16, with Nano FP16 selected in the UI. The viewer prefers WebGPU and falls back to slower WASM/CPU when it is unavailable. The exporter downloads the selected official checkpoints, exports static end-to-end ONNX graphs, checks the expected `[1, 300, 6]` output, and creates `catalog.json` plus a compatibility manifest here. The browser downloads only the selected model. Restart the Next.js dev server afterward.

The generated `.onnx` and manifest are local artifacts and are ignored by Git. Review the [Ultralytics licensing terms](https://www.ultralytics.com/license) before distributing or deploying them.
