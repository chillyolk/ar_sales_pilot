from __future__ import annotations

import os
from pathlib import Path

import cv2
import numpy as np

from app.cv.part_segmenter import PartSegmenter
from app.cv.vehicle_tracker import VehicleTracker

VEHICLE_CLASS_NAMES = {"car", "truck", "bus", "motorcycle"}
COCO_FALLBACK_LABEL = "car"


class VehicleDetector:
    def __init__(self) -> None:
        self.tracker = VehicleTracker()
        self.part_segmenter = PartSegmenter()
        self.model_name = "YOLOv8n"
        self.model = None
        self.yolo_available = False
        self._load_model()

    def _load_model(self) -> None:
        if os.getenv("DISABLE_YOLO") == "1":
            return
        try:
            from ultralytics import YOLO

            model_path = Path(__file__).resolve().parents[2] / "models" / "yolov8n.pt"
            self.model = YOLO(str(model_path) if model_path.exists() else "yolov8n.pt")
            self.yolo_available = True
        except Exception:
            self.model = None
            self.yolo_available = False
            self.model_name = "fallback-contour"

    def detect(self, image: np.ndarray, brand: str = "演示品牌", model: str = "演示车型") -> list[dict]:
        if self.yolo_available and self.model is not None:
            detections = self._detect_with_yolo(image)
        else:
            detections = self._detect_with_fallback(image)
        detections = self._select_primary_vehicle(detections)
        tracked = self.tracker.assign(detections)
        for item in tracked:
            item["brand"] = brand
            item["model"] = model
            item["parts"] = self.part_segmenter.segment_parts(image, item["bbox"], model=model)
        return tracked

    def _select_primary_vehicle(self, detections: list[dict]) -> list[dict]:
        if not detections:
            return []
        primary = max(
            detections,
            key=lambda item: (item["bbox"][2] - item["bbox"][0]) * (item["bbox"][3] - item["bbox"][1]),
        )
        return [primary]

    def _detect_with_yolo(self, image: np.ndarray) -> list[dict]:
        results = self.model.predict(image, imgsz=640, conf=0.35, verbose=False)
        detections: list[dict] = []
        for result in results:
            names = result.names
            for box in result.boxes:
                class_id = int(box.cls[0])
                class_name = names[class_id]
                if class_name not in VEHICLE_CLASS_NAMES:
                    continue
                x1, y1, x2, y2 = [round(float(value)) for value in box.xyxy[0].tolist()]
                detections.append(
                    {
                        "class_name": class_name,
                        "confidence": round(float(box.conf[0]), 3),
                        "bbox": [x1, y1, x2, y2],
                    }
                )
        return sorted(detections, key=lambda item: item["confidence"], reverse=True)[:3]

    def _detect_with_fallback(self, image: np.ndarray) -> list[dict]:
        height, width = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 80, 160)
        edge_ratio = float(np.count_nonzero(edges)) / float(edges.size)
        if float(np.mean(gray)) < 18 or edge_ratio < 0.003:
            return []

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        candidates: list[tuple[int, list[int]]] = []
        min_area = width * height * 0.04
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            area = w * h
            ratio = w / h if h else 0
            if area >= min_area and 1.2 <= ratio <= 5.5:
                candidates.append((area, [x, y, x + w, y + h]))
        if not candidates:
            return []
        _, bbox = max(candidates, key=lambda item: item[0])
        return [{"class_name": COCO_FALLBACK_LABEL, "confidence": 0.35, "bbox": bbox}]
