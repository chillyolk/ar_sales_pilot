from __future__ import annotations

import argparse
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_VIDEO = PROJECT_ROOT / "Model3.mp4"
DEFAULT_OUT_DIR = PROJECT_ROOT / "backend" / "datasets" / "model3_parts" / "frames"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract representative frames from Model3.mp4 for part segmentation labeling.")
    parser.add_argument("--video", default=str(DEFAULT_VIDEO), help="Source video path.")
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="Output directory for extracted jpg frames.")
    parser.add_argument("--every-n-frames", type=int, default=30, help="Extract one frame every N frames.")
    parser.add_argument("--fps", type=float, default=0, help="Optional target extraction FPS. Overrides --every-n-frames when > 0.")
    parser.add_argument("--max-frames", type=int, default=80, help="Maximum frames to export.")
    parser.add_argument("--prefix", default="model3", help="Output filename prefix.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    import cv2
    video_path = Path(args.video)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise SystemExit(f"无法打开视频：{video_path}")

    source_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    step = max(1, int(round(source_fps / args.fps))) if args.fps > 0 else max(1, args.every_n_frames)

    exported = 0
    frame_index = 0
    while exported < args.max_frames:
        ok, frame = cap.read()
        if not ok:
            break
        if frame_index % step == 0:
            timestamp = frame_index / source_fps
            out_path = out_dir / f"{args.prefix}_t{timestamp:07.2f}_f{frame_index:06d}.jpg"
            cv2.imwrite(str(out_path), frame)
            exported += 1
        frame_index += 1

    cap.release()
    print(f"video={video_path}")
    print(f"source_fps={source_fps:.3f}")
    print(f"total_frames={total_frames}")
    print(f"step={step}")
    print(f"exported={exported}")
    print(f"out_dir={out_dir}")


if __name__ == "__main__":
    main()
