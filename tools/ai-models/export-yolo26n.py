"""Export official YOLO26 checkpoints into the app's static model catalog."""

import argparse
import hashlib
import json
import os
import shutil
from pathlib import Path

import onnx
from ultralytics import YOLO

OUTPUT_DIR = Path("public/models/yolo26n")
VARIANTS = {"nano": "n", "small": "s", "medium": "m"}

parser = argparse.ArgumentParser()
parser.add_argument("--variant", choices=(*VARIANTS, "all"), default=os.getenv("AI_MODEL_VARIANT", "all"))
parser.add_argument("--precision", choices=("fp32", "fp16", "int8", "all"), default=os.getenv("AI_MODEL_PRECISION", "all"))
parser.add_argument("--imgsz", type=int, default=int(os.getenv("AI_MODEL_IMAGE_SIZE", 320)))
args = parser.parse_args()
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def topologically_sort_graph(graph, outer_scope=frozenset()) -> None:
    """Repair node ordering after the FP16 converter appends boundary Cast nodes."""
    available = set(outer_scope)
    available.update(value.name for value in graph.input)
    available.update(value.name for value in graph.initializer)
    available.update(value.values.name for value in graph.sparse_initializer)
    pending = list(graph.node)
    ordered = []

    while pending:
        ready = [node for node in pending if all(not name or name in available for name in node.input)]
        if not ready:
            missing = sorted({name for node in pending for name in node.input if name and name not in available})
            raise RuntimeError(f"Unable to topologically sort ONNX graph; unresolved inputs: {missing[:10]}")
        for node in ready:
            ordered.append(node)
            available.update(name for name in node.output if name)
            pending.remove(node)

    del graph.node[:]
    graph.node.extend(ordered)

    # Preserve support for models containing If/Loop/Scan subgraphs and their outer-scope captures.
    for node in graph.node:
        for attribute in node.attribute:
            if attribute.type == onnx.AttributeProto.GRAPH:
                topologically_sort_graph(attribute.g, frozenset(available))
            elif attribute.type == onnx.AttributeProto.GRAPHS:
                for child_graph in attribute.graphs:
                    topologically_sort_graph(child_graph, frozenset(available))


def export_variant(variant: str, precision: str) -> dict:
    checkpoint = f"yolo26{VARIANTS[variant]}.pt"
    model = YOLO(checkpoint)
    export_options = {"format": "onnx", "imgsz": args.imgsz, "batch": 1, "dynamic": False, "simplify": True}
    if precision == "fp16":
        export_options["quantize"] = 16
    elif precision == "int8":
        # Small built-in calibration set keeps the experimental Docker build self-contained.
        export_options.update({"quantize": 8, "data": "coco8.yaml", "fraction": 1.0})
    exported = Path(model.export(**export_options))
    graph = onnx.load(exported)
    topologically_sort_graph(graph.graph)
    onnx.checker.check_model(graph)
    onnx.save(graph, exported)

    contents = exported.read_bytes()
    digest = hashlib.sha256(contents).hexdigest()
    output_file = OUTPUT_DIR / f"yolo26{VARIANTS[variant]}-e2e-{args.imgsz}-{precision}.{digest[:12]}.onnx"
    shutil.copy2(exported, output_file)

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
        "modelName": f"YOLO26{VARIANTS[variant]} COCO {args.imgsz} {precision.upper()}",
        "variant": variant,
        "precision": precision,
        "license": "Ultralytics AGPL-3.0 or Enterprise",
    }
    print(f"Installed {output_file} ({len(contents) / 1024 / 1024:.1f} MB)")
    return manifest


variants = list(VARIANTS) if args.variant == "all" else [args.variant]
precisions = ["fp16", "int8"] if args.precision == "all" else [args.precision]
models = [
    {"id": f"{variant}-{precision}", "manifest": export_variant(variant, precision)}
    for variant in variants
    for precision in precisions
]
preferred_id = "nano-fp16"
default_id = preferred_id if any(item["id"] == preferred_id for item in models) else models[0]["id"]
catalog = {"version": 1, "defaultModel": default_id, "models": models}
(OUTPUT_DIR / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
(OUTPUT_DIR / "manifest.json").write_text(json.dumps(next(item["manifest"] for item in models if item["id"] == default_id), indent=2) + "\n", encoding="utf-8")
print(f"Catalog default: {default_id}; choices: {', '.join(item['id'] for item in models)}")
