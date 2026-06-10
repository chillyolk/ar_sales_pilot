import json
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def _load_knowledge() -> dict:
    with (DATA_DIR / "vehicle_knowledge.json").open("r", encoding="utf-8") as file:
        return json.load(file)


KNOWLEDGE = _load_knowledge()


def _part_info(part_id: str, model: str = "演示车型") -> dict:
    model_parts = KNOWLEDGE.get("models", {}).get(model, {}).get("parts", {})
    default_parts = KNOWLEDGE.get("default", {}).get("parts", {})
    data = model_parts.get(part_id) or default_parts.get(part_id) or default_parts.get("body", {})
    return {
        "title": data.get("title", "车辆部件"),
        "description": data.get("description", "当前画面识别到车辆相关部件。"),
        "selling_points": data.get("selling_points", []),
    }


def _box(x1: float, y1: float, x2: float, y2: float) -> list[int]:
    return [round(x1), round(y1), round(x2), round(y2)]


def _anchor(box: list[int]) -> list[int]:
    x1, y1, x2, y2 = box
    return [round((x1 + x2) / 2), round((y1 + y2) / 2)]


def _clip_box(box: list[int], width: int, height: int) -> list[int]:
    x1, y1, x2, y2 = box
    return [max(0, x1), max(0, y1), min(width - 1, x2), min(height - 1, y2)]


def _make_part(part_id: str, name: str, confidence: float, method: str, box: list[int], model: str) -> dict:
    return {
        "part_id": part_id,
        "name": name,
        "confidence": confidence,
        "method": method,
        "bbox": box,
        "anchor": _anchor(box),
        "physical_info": _part_info(part_id, model=model),
    }


def _detect_window(image: np.ndarray, vehicle_bbox: list[int], model: str) -> Optional[dict]:
    height, width = image.shape[:2]
    x1, y1, x2, y2 = vehicle_bbox
    w = x2 - x1
    h = y2 - y1
    roi_box = _clip_box(_box(x1 + 0.12 * w, y1 + 0.05 * h, x1 + 0.88 * w, y1 + 0.56 * h), width, height)
    rx1, ry1, rx2, ry2 = roi_box
    roi = image[ry1:ry2, rx1:rx2]
    if roi.size == 0:
        return None

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    value = hsv[:, :, 2]
    saturation = hsv[:, :, 1]
    mask = ((value < 125) & (saturation < 95)).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    candidates: list[tuple[int, list[int]]] = []
    min_area = max(260, int(w * h * 0.012))
    for contour in contours:
        x, y, cw, ch = cv2.boundingRect(contour)
        area = cw * ch
        ratio = cw / ch if ch else 0
        if area >= min_area and 1.4 <= ratio <= 6.5:
            candidates.append((area, [rx1 + x, ry1 + y, rx1 + x + cw, ry1 + y + ch]))

    if not candidates:
        return None
    _, box = max(candidates, key=lambda item: item[0])
    part = _make_part("window", "车窗", 0.72, "visual-dark-region", box, model)
    part["anchor"] = [round((box[0] + box[2]) / 2), round(box[1] + (box[3] - box[1]) * 0.35)]
    return part


def _detect_wheels(image: np.ndarray, vehicle_bbox: list[int], model: str) -> list[dict]:
    height, width = image.shape[:2]
    x1, y1, x2, y2 = vehicle_bbox
    w = x2 - x1
    h = y2 - y1
    roi_box = _clip_box(_box(x1, y1 + 0.64 * h, x2, y2), width, height)
    rx1, ry1, rx2, ry2 = roi_box
    roi = image[ry1:ry2, rx1:rx2]
    if roi.size == 0:
        return []

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray = cv2.medianBlur(gray, 5)
    min_radius = max(10, round(min(w, h) * 0.055))
    max_radius = max(min_radius + 6, round(min(w, h) * 0.17))
    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1.25,
        minDist=max(36, round(w * 0.22)),
        param1=90,
        param2=24,
        minRadius=min_radius,
        maxRadius=max_radius,
    )
    if circles is None:
        return []

    results: list[dict] = []
    seen_x: list[int] = []
    for index, circle in enumerate(sorted(np.round(circles[0]).astype(int), key=lambda item: item[0])):
        cx, cy, radius = circle.tolist()
        gx = rx1 + cx
        gy = ry1 + cy
        if gy < y1 + h * 0.84:
            continue
        circle_x1 = max(0, cx - radius)
        circle_y1 = max(0, cy - radius)
        circle_x2 = min(roi.shape[1] - 1, cx + radius)
        circle_y2 = min(roi.shape[0] - 1, cy + radius)
        circle_roi = gray[circle_y1:circle_y2, circle_x1:circle_x2]
        if circle_roi.size == 0 or float(np.mean(circle_roi)) > 115:
            continue
        edges = cv2.Canny(circle_roi, 70, 150)
        if float(np.count_nonzero(edges)) / float(edges.size) < 0.045:
            continue
        if any(abs(gx - sx) < radius * 1.4 for sx in seen_x):
            continue
        seen_x.append(gx)
        part_id = "wheel_left" if len(results) == 0 else "wheel_right"
        box = _clip_box([gx - radius, gy - radius, gx + radius, gy + radius], width, height)
        results.append(_make_part(part_id, "轮毂", 0.76, "visual-circle", box, model))
        if len(results) == 2:
            break
    return results


def estimate_parts(image: np.ndarray, vehicle_bbox: list[int], model: str = "演示车型") -> list[dict]:
    height, width = image.shape[:2]
    x1, y1, x2, y2 = vehicle_bbox
    w = x2 - x1
    h = y2 - y1
    parts = [
        _make_part("body", "车身", 0.82, "geometry", _clip_box(_box(x1 + 0.12 * w, y1 + 0.32 * h, x1 + 0.88 * w, y1 + 0.82 * h), width, height), model),
        _make_part("front", "车头", 0.55, "geometry", _clip_box(_box(x1 + 0.70 * w, y1 + 0.25 * h, x1 + 0.96 * w, y1 + 0.78 * h), width, height), model),
    ]

    window = _detect_window(image, vehicle_bbox, model)
    if window:
        parts.append(window)
    parts.extend(_detect_wheels(image, vehicle_bbox, model))
    return parts
