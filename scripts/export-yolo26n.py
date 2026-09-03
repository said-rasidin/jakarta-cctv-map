"""Export a selected official YOLO26 checkpoint into the app's static model contract."""

import argparse
import hashlib
import json
import os
import shutil
from pathlib import Path

import onnx
from ultralytics import YOLO

INPUT_SIZE = 416
OUTPUT_DIR = Path("public/models/yolo26n")
VARIANTS = {"nano": "n", "small": "s", "medium": "m"}

parser = argparse.ArgumentParser()
parser.add_argument("--variant", choices=VARIANTS, default=os.getenv("AI_MODEL_VARIANT", "nano"))
parser.add_argument("--precision", choices=("fp32", "fp16"), default=os.getenv("AI_MODEL_PRECISION", "fp32"))
parser.add_argument("--imgsz", type=int, default=int(os.getenv("AI_MODEL_IMAGE_SIZE", INPUT_SIZE)))
args = parser.parse_args()
checkpoint = f"yolo26{VARIANTS[args.variant]}.pt"

model = YOLO(checkpoint)
export_options = {"format": "onnx", "imgsz": args.imgsz, "batch": 1, "dynamic": False, "simplify": True}
if args.precision == "fp16": export_options["quantize"] = 16
exported = Path(model.export(**export_options))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
contents = exported.read_bytes()
digest = hashlib.sha256(contents).hexdigest()
output_file = OUTPUT_DIR / f"yolo26{VARIANTS[args.variant]}-e2e-{args.imgsz}-{args.precision}.{digest[:12]}.onnx"
shutil.copy2(exported, output_file)

graph = onnx.load(output_file)
onnx.checker.check_model(graph)
input_name = graph.graph.input[0].name
output_name = graph.graph.output[0].name
output_dims = [dimension.dim_value for dimension in graph.graph.output[0].type.tensor_type.shape.dim]
if output_dims != [1, 300, 6]:
    raise RuntimeError(f"Expected YOLO26 end-to-end output [1, 300, 6], received {output_dims}")

manifest = {
    "version": 1,
    "modelUrl": f"/models/yolo26n/{output_file.name}",
    "byteSize": len(contents),
    "sha256": digest,
    "input": {"name": input_name, "width": args.imgsz, "height": args.imgsz},
    "output": {"name": output_name, "schema": "xyxy-confidence-class"},
    "modelName": f"YOLO26{VARIANTS[args.variant]} COCO {args.imgsz} {args.precision.upper()}",
    "variant": args.variant,
    "precision": args.precision,
    "license": "Ultralytics AGPL-3.0 or Enterprise",
}
(OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(f"Installed {output_file} ({len(contents) / 1024 / 1024:.1f} MB)")
