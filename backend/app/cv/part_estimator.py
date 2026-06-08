import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def _load_knowledge() -> dict:
    with (DATA_DIR / "vehicle_knowledge.json").open("r", encoding="utf-8") as file:
        return json.load(file)


KNOWLEDGE = _load_knowledge()


def _part_info(part_id: str) -> dict:
    data = KNOWLEDGE.get(part_id, KNOWLEDGE.get("body", {}))
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


def estimate_parts(vehicle_bbox: list[int]) -> list[dict]:
    x1, y1, x2, y2 = vehicle_bbox
    w = x2 - x1
    h = y2 - y1

    definitions = [
        ("body", "车身", 0.8, _box(x1 + 0.12 * w, y1 + 0.32 * h, x1 + 0.88 * w, y1 + 0.82 * h)),
        ("window", "车窗", 0.65, _box(x1 + 0.25 * w, y1 + 0.14 * h, x1 + 0.72 * w, y1 + 0.45 * h)),
        ("wheel_left", "轮毂", 0.55, _box(x1 + 0.14 * w, y1 + 0.70 * h, x1 + 0.34 * w, y1 + 0.96 * h)),
        ("wheel_right", "轮毂", 0.55, _box(x1 + 0.66 * w, y1 + 0.70 * h, x1 + 0.86 * w, y1 + 0.96 * h)),
        ("headlight", "车灯", 0.5, _box(x1 + 0.76 * w, y1 + 0.38 * h, x1 + 0.94 * w, y1 + 0.56 * h)),
        ("front", "车头", 0.5, _box(x1 + 0.70 * w, y1 + 0.25 * h, x1 + 0.96 * w, y1 + 0.78 * h)),
    ]

    return [
        {
            "part_id": part_id,
            "name": name,
            "confidence": confidence,
            "method": "geometry",
            "bbox": box,
            "anchor": _anchor(box),
            "physical_info": _part_info(part_id),
        }
        for part_id, name, confidence, box in definitions
    ]
