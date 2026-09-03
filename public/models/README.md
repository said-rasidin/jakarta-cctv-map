# Local YOLO26 model

The CCTV viewer loads no AI code or model until the user presses **Coba AI**. The ONNX model is intentionally not committed because its redistribution and use must follow the Ultralytics license.

From the repository root, create a Python environment, install the pinned exporter dependencies, and run:

```powershell
py -m pip install -r tools/ai-models/requirements.txt
py tools/ai-models/export-yolo26n.py --variant all --precision all --imgsz 320
```

Use `--variant all|nano|small|medium` and `--precision all|fp32|fp16|int8` to experiment. The defaults package all three sizes in FP16 and INT8 at 320×320, with Nano FP16 selected in the UI. INT8 uses the small built-in COCO8 calibration set. INT4 is not supported by the YOLO26 ONNX exporter and is shown disabled in the UI. The viewer prefers WebGPU and falls back to WASM/CPU when needed. The exporter validates every static end-to-end `[1, 300, 6]` graph and creates a catalog plus compatibility manifest. The browser downloads only the selected model. Restart the Next.js dev server afterward.

The generated `.onnx` and manifest are local artifacts and are ignored by Git. Review the [Ultralytics licensing terms](https://www.ultralytics.com/license) before distributing or deploying them.
