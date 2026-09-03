# Local YOLO26 model

The CCTV viewer loads no AI code or model until the user presses **Coba AI**. The ONNX model is intentionally not committed because its redistribution and use must follow the Ultralytics license.

From the repository root, create a Python environment, install the pinned exporter dependencies, and run:

```powershell
py -m pip install -r requirements-ai.txt
py scripts/export-yolo26n.py --variant nano --precision fp32 --imgsz 416
```

Use `--variant nano|small|medium` and `--precision fp32|fp16` to experiment. FP16 is WebGPU-only in the viewer. The exporter downloads the selected official checkpoint, exports a static end-to-end ONNX graph, checks the expected `[1, 300, 6]` output, and creates both the model and `manifest.json` here. Restart the Next.js dev server afterward.

The generated `.onnx` and manifest are local artifacts and are ignored by Git. Review the [Ultralytics licensing terms](https://www.ultralytics.com/license) before distributing or deploying them.
