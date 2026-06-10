from __future__ import annotations

import argparse
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_WEIGHTS = PROJECT_ROOT / "backend" / "models" / "parts" / "model3_parts_yolov8n_seg.pt"
DEFAULT_OUTPUT = PROJECT_ROOT / "backend" / "outputs" / "part_seg_preview"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run part segmentation inference and save previews.")
    parser.add_argument("--weights", default=str(DEFAULT_WEIGHTS), help="Trained segmentation weights.")
    parser.add_argument("--source", required=True, help="Image, directory, or video source.")
    parser.add_argument("--out-dir", default=str(DEFAULT_OUTPUT), help="Preview output directory.")
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--imgsz", type=int, default=640)
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    from ultralytics import YOLO
    weights = Path(args.weights)
    if not weights.exists():
        raise SystemExit(f"分割模型不存在：{weights}")
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    model = YOLO(str(weights))
    results = model.predict(source=args.source, conf=args.conf, imgsz=args.imgsz, save=True, project=str(out_dir), name="predict", verbose=False)
    for result in results:
        boxes = result.boxes
        masks = result.masks
        count = len(boxes) if boxes is not None else 0
        print(f"source={result.path} instances={count} masks={0 if masks is None else len(masks.xy)}")
        if boxes is not None:
            for index, box in enumerate(boxes):
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                points = 0 if masks is None else len(masks.xy[index])
                print(f"  class={class_id} conf={confidence:.3f} polygon_points={points}")


if __name__ == "__main__":
    main()
