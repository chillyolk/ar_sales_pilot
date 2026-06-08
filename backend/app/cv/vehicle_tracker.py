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


class VehicleTracker:
    def __init__(self) -> None:
        self.next_id = 1
        self.tracks: dict[int, list[int]] = {}

    def assign(self, detections: list[dict]) -> list[dict]:
        used: set[int] = set()
        for detection in detections:
            bbox = detection["bbox"]
            best_id = None
            best_iou = 0.0
            for track_id, track_bbox in self.tracks.items():
                if track_id in used:
                    continue
                score = iou(bbox, track_bbox)
                if score > best_iou:
                    best_iou = score
                    best_id = track_id
            if best_id is None or best_iou < 0.25:
                best_id = self.next_id
                self.next_id += 1
            detection["track_id"] = best_id
            self.tracks[best_id] = bbox
            used.add(best_id)
        self.tracks = {track_id: self.tracks[track_id] for track_id in used}
        return detections
