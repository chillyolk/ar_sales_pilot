from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from app.cv.part_estimator import _part_info, estimate_parts

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MODEL_PATH = PROJECT_ROOT / "backend" / "models" / "parts" / "model3_parts_yolov8n_seg.pt"

CLASS_NAME_TO_LABEL = {
    "windshield": "前挡风玻璃",
    "hood": "引擎盖",
    "wheel": "轮毂",
    "side_window": "侧窗",
    "headlight": "车灯",
    "body": "车身",
    "front_grille": "前脸",
    "mirror": "后视镜",
}


def _clip_box(box: list[int], width: int, height: int) -> list[int]:
    x1, y1, x2, y2 = box
    return [max(0, x1), max(0, y1), min(width - 1, x2), min(height - 1, y2)]


def _box_center(box: list[int]) -> tuple[float, float]:
    return (box[0] + box[2]) / 2, (box[1] + box[3]) / 2


def _expand_box(box: list[int], ratio: float, width: int, height: int) -> list[int]:
    x1, y1, x2, y2 = box
    dx = (x2 - x1) * ratio
    dy = (y2 - y1) * ratio
    return _clip_box([round(x1 - dx), round(y1 - dy), round(x2 + dx), round(y2 + dy)], width, height)


def _point_in_box(point: tuple[float, float], box: list[int]) -> bool:
    x, y = point
    return box[0] <= x <= box[2] and box[1] <= y <= box[3]


def _simplify_polygon(points: np.ndarray, max_points: int = 60) -> list[list[int]]:
    if len(points) == 0:
        return []
    contour = points.astype(np.float32).reshape((-1, 1, 2))
    epsilon = max(1.0, cv2.arcLength(contour, True) * 0.006)
    simplified = cv2.approxPolyDP(contour, epsilon, True).reshape((-1, 2))
    if len(simplified) > max_points:
        step = max(1, round(len(simplified) / max_points))
        simplified = simplified[::step][:max_points]
    return [[round(float(x)), round(float(y))] for x, y in simplified]


def _polygon_anchor(polygon: list[list[int]], bbox: list[int]) -> list[int]:
    if polygon:
        points = np.array(polygon, dtype=np.float32)
        moments = cv2.moments(points)
        if moments["m00"]:
            return [round(moments["m10"] / moments["m00"]), round(moments["m01"] / moments["m00"])]
        return [round(float(points[:, 0].mean())), round(float(points[:, 1].mean()))]
    return [round((bbox[0] + bbox[2]) / 2), round((bbox[1] + bbox[3]) / 2)]


class PartSegmenter:
    def __init__(self) -> None:
        self.model = None
        self.available = False
        self.model_path = Path(os.getenv("PART_SEG_MODEL", str(DEFAULT_MODEL_PATH)))
        self.use_legacy = os.getenv("USE_LEGACY_PART_ESTIMATOR") == "1"
        self._load_model()

    def _load_model(self) -> None:
        if os.getenv("DISABLE_PART_SEG") == "1":
            return
        if not self.model_path.exists():
            return
        try:
            from ultralytics import YOLO

            self.model = YOLO(str(self.model_path))
            self.available = True
        except Exception:
            self.model = None
            self.available = False

    def segment_parts(self, image: np.ndarray, vehicle_bbox: list[int], model: str = "演示车型") -> list[dict]:
        if not self.available or self.model is None:
            if self.use_legacy:
                return estimate_parts(image, vehicle_bbox, model=model)
            return []

        height, width = image.shape[:2]
        expanded_vehicle = _expand_box(vehicle_bbox, 0.05, width, height)
        results = self.model.predict(image, imgsz=640, conf=0.25, verbose=False)
        if not results:
            return []

        parts: list[dict] = []
        class_counts: dict[str, int] = {}
        result = results[0]
        if result.boxes is None or result.masks is None:
            return []

        names = result.names
        for index, box in enumerate(result.boxes):
            class_id = int(box.cls[0])
            class_name = names[class_id]
            confidence = float(box.conf[0])
            x1, y1, x2, y2 = [round(float(value)) for value in box.xyxy[0].tolist()]
            bbox = _clip_box([x1, y1, x2, y2], width, height)
            center = _box_center(bbox)
            if not _point_in_box(center, expanded_vehicle):
                continue

            polygon = _simplify_polygon(result.masks.xy[index])
            if not polygon:
                continue

            class_counts[class_name] = class_counts.get(class_name, 0) + 1
            suffix = class_counts[class_name]
            part_id = class_name if suffix == 1 and class_name not in {"wheel", "headlight"} else f"{class_name}_{suffix}"
            label = CLASS_NAME_TO_LABEL.get(class_name, class_name)
            anchor = _polygon_anchor(polygon, bbox)
            parts.append(
                {
                    "part_id": part_id,
                    "name": label,
                    "confidence": round(confidence, 3),
                    "method": "segmentation-yolov8n-seg",
                    "bbox": bbox,
                    "anchor": anchor,
                    "polygon": polygon,
                    "physical_info": _part_info(class_name, model=model),
                }
            )

        return parts
