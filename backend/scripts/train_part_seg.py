from __future__ import annotations

import argparse
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA = PROJECT_ROOT / "backend" / "datasets" / "model3_parts" / "data.yaml"
DEFAULT_PROJECT = PROJECT_ROOT / "backend" / "runs" / "part_seg"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train YOLOv8n-seg for vehicle part segmentation.")
    parser.add_argument("--data", default=str(DEFAULT_DATA), help="YOLO segmentation data.yaml path.")
    parser.add_argument("--model", default="yolov8n-seg.pt", help="Base segmentation model.")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=4)
    parser.add_argument("--device", default=None)
    parser.add_argument("--project", default=str(DEFAULT_PROJECT))
    parser.add_argument("--name", default="model3_parts_yolov8n_seg")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    from ultralytics import YOLO
    model = YOLO(args.model)
    kwargs = {
        "data": args.data,
        "epochs": args.epochs,
        "imgsz": args.imgsz,
        "batch": args.batch,
        "patience": 20,
        "project": args.project,
        "name": args.name,
    }
    if args.device is not None:
        kwargs["device"] = args.device
    model.train(**kwargs)


if __name__ == "__main__":
    main()
