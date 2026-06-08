from __future__ import annotations


def iou(a: list[int], b: list[int]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union else 0


def center_distance_ratio(a: list[int], b: list[int]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    acx, acy = (ax1 + ax2) / 2, (ay1 + ay2) / 2
    bcx, bcy = (bx1 + bx2) / 2, (by1 + by2) / 2
    distance = ((acx - bcx) ** 2 + (acy - bcy) ** 2) ** 0.5
    scale = max(ax2 - ax1, ay2 - ay1, bx2 - bx1, by2 - by1, 1)
    return distance / scale


def smooth_box(previous: list[int], current: list[int], alpha: float = 0.35) -> list[int]:
    return [round(previous[index] * (1 - alpha) + current[index] * alpha) for index in range(4)]


class VehicleTracker:
    def __init__(self) -> None:
        self.next_id = 1
        self.tracks: dict[int, dict] = {}
        self.max_missed_frames = 4

    def assign(self, detections: list[dict]) -> list[dict]:
        used: set[int] = set()
        assigned: list[dict] = []
        for detection in detections:
            bbox = detection["bbox"]
            best_id = None
            best_score = -1.0
            for track_id, track in self.tracks.items():
                if track_id in used:
                    continue
                track_bbox = track["bbox"]
                overlap = iou(bbox, track_bbox)
                distance = center_distance_ratio(bbox, track_bbox)
                score = overlap - distance * 0.25
                if overlap > 0.18 or distance < 0.45:
                    if score > best_score:
                        best_score = score
                        best_id = track_id

            if best_id is None:
                best_id = self.next_id
                self.next_id += 1
                smoothed_bbox = bbox
            else:
                smoothed_bbox = smooth_box(self.tracks[best_id]["bbox"], bbox)

            self.tracks[best_id] = {"bbox": smoothed_bbox, "missed_frames": 0}
            detection["track_id"] = best_id
            detection["bbox"] = smoothed_bbox
            assigned.append(detection)
            used.add(best_id)

        for track_id in list(self.tracks.keys()):
            if track_id in used:
                continue
            self.tracks[track_id]["missed_frames"] += 1
            if self.tracks[track_id]["missed_frames"] > self.max_missed_frames:
                del self.tracks[track_id]

        return assigned
