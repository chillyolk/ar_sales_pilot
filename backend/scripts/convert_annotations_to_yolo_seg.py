from __future__ import annotations

import argparse
import json
import random
import shutil
import zipfile
from collections import defaultdict
from pathlib import Path
from tempfile import TemporaryDirectory

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
CLASS_NAMES = ["windshield", "hood", "wheel", "side_window", "headlight"]
CLASS_TO_ID = {name: index for index, name in enumerate(CLASS_NAMES)}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert COCO polygon annotations or validate YOLO segmentation labels.")
    parser.add_argument("--coco-json", help="COCO result.json path.")
    parser.add_argument("--coco-zip", help="COCO zip export containing result.json.")
    parser.add_argument("--frames-dir", required=True, help="Directory containing labeled images.")
    parser.add_argument("--labels-dir", help="Directory containing existing YOLO segmentation txt labels.")
    parser.add_argument("--out-dir", required=True, help="Output YOLO dataset directory.")
    parser.add_argument("--val-ratio", type=float, default=0.2, help="Validation split ratio.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    parser.add_argument("--num-classes", type=int, default=len(CLASS_NAMES), help="Number of valid class ids.")
    return parser.parse_args()


def validate_label(label_path: Path, num_classes: int) -> list[str]:
    errors: list[str] = []
    for line_no, line in enumerate(label_path.read_text().splitlines(), start=1):
        if not line.strip():
            continue
        values = line.split()
        if len(values) < 7 or len(values[1:]) % 2 != 0:
            errors.append(f"{label_path}:{line_no} polygon 点数不足或坐标数不是偶数")
            continue
        try:
            class_id = int(values[0])
            coords = [float(value) for value in values[1:]]
        except ValueError:
            errors.append(f"{label_path}:{line_no} 存在非数字字段")
            continue
        if class_id < 0 or class_id >= num_classes:
            errors.append(f"{label_path}:{line_no} class_id 越界：{class_id}")
        if any(value < 0 or value > 1 for value in coords):
            errors.append(f"{label_path}:{line_no} 坐标不在 [0, 1]")
    return errors


def copy_pair(image: Path, label: Path, out_dir: Path, split: str) -> None:
    image_out = out_dir / "images" / split / image.name
    label_out = out_dir / "labels" / split / label.name
    image_out.parent.mkdir(parents=True, exist_ok=True)
    label_out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(image, image_out)
    shutil.copy2(label, label_out)


def write_data_yaml(out_dir: Path) -> None:
    lines = [
        f"path: {out_dir}",
        "train: images/train",
        "val: images/val",
        "",
        "names:",
    ]
    lines.extend(f"  {index}: {name}" for index, name in enumerate(CLASS_NAMES))
    (out_dir / "data.yaml").write_text("\n".join(lines) + "\n", encoding="utf-8")


def image_lookup_name(file_name: str) -> str:
    name = Path(file_name).name
    if "-model3_" in name:
        return name.split("-", 1)[1]
    return name


def load_coco(args: argparse.Namespace) -> dict:
    if args.coco_json:
        return json.loads(Path(args.coco_json).read_text(encoding="utf-8"))
    if args.coco_zip:
        with zipfile.ZipFile(args.coco_zip) as archive:
            return json.loads(archive.read("result.json"))
    raise SystemExit("必须提供 --coco-json 或 --coco-zip，或使用 --labels-dir 校验已有 YOLO labels")


def convert_coco_to_temp_labels(coco: dict, frames_dir: Path, temp_labels_dir: Path) -> tuple[list[tuple[Path, Path]], list[str]]:
    categories = {category["id"]: category["name"] for category in coco.get("categories", [])}
    images = {image["id"]: image for image in coco.get("images", [])}
    frame_by_name = {path.name: path for path in frames_dir.iterdir() if path.suffix.lower() in IMAGE_EXTENSIONS}
    lines_by_image: dict[int, list[str]] = defaultdict(list)
    errors: list[str] = []

    for annotation in coco.get("annotations", []):
        image = images.get(annotation.get("image_id"))
        if not image:
            errors.append(f"annotation {annotation.get('id')} 找不到 image_id")
            continue
        category_name = categories.get(annotation.get("category_id"))
        if category_name not in CLASS_TO_ID:
            errors.append(f"未知类别：{category_name}")
            continue
        segmentation = annotation.get("segmentation") or []
        if not segmentation or not isinstance(segmentation, list):
            errors.append(f"annotation {annotation.get('id')} segmentation 为空或格式不支持")
            continue
        width = image["width"]
        height = image["height"]
        class_id = CLASS_TO_ID[category_name]
        for polygon in segmentation:
            if len(polygon) < 6 or len(polygon) % 2 != 0:
                errors.append(f"annotation {annotation.get('id')} polygon 点数不足")
                continue
            normalized: list[str] = []
            for index, value in enumerate(polygon):
                limit = width if index % 2 == 0 else height
                normalized.append(f"{min(max(float(value) / limit, 0.0), 1.0):.6f}")
            lines_by_image[image["id"]].append(" ".join([str(class_id), *normalized]))

    pairs: list[tuple[Path, Path]] = []
    for image_id, image in images.items():
        frame_name = image_lookup_name(image["file_name"])
        frame = frame_by_name.get(frame_name)
        if frame is None:
            errors.append(f"找不到图片文件：{frame_name}")
            continue
        label_path = temp_labels_dir / f"{frame.stem}.txt"
        label_path.parent.mkdir(parents=True, exist_ok=True)
        label_path.write_text("\n".join(lines_by_image.get(image_id, [])) + "\n", encoding="utf-8")
        pairs.append((frame, label_path))
    return pairs, errors


def load_existing_yolo_pairs(frames_dir: Path, labels_dir: Path, num_classes: int) -> tuple[list[tuple[Path, Path]], list[str]]:
    images = sorted(path for path in frames_dir.iterdir() if path.suffix.lower() in IMAGE_EXTENSIONS)
    pairs: list[tuple[Path, Path]] = []
    errors: list[str] = []
    for image in images:
        label = labels_dir / f"{image.stem}.txt"
        if not label.exists():
            errors.append(f"缺少 label：{label}")
            continue
        label_errors = validate_label(label, num_classes)
        errors.extend(label_errors)
        if not label_errors:
            pairs.append((image, label))
    return pairs, errors


def split_and_copy(pairs: list[tuple[Path, Path]], out_dir: Path, val_ratio: float, seed: int) -> None:
    random.Random(seed).shuffle(pairs)
    val_count = max(1, round(len(pairs) * val_ratio)) if len(pairs) > 1 else 0
    val_pairs = pairs[:val_count]
    train_pairs = pairs[val_count:]
    for image, label in train_pairs:
        copy_pair(image, label, out_dir, "train")
    for image, label in val_pairs:
        copy_pair(image, label, out_dir, "val")
    write_data_yaml(out_dir)
    print(f"valid_pairs={len(pairs)}")
    print(f"train={len(train_pairs)}")
    print(f"val={len(val_pairs)}")
    print(f"out_dir={out_dir}")


def main() -> None:
    args = parse_args()
    frames_dir = Path(args.frames_dir)
    out_dir = Path(args.out_dir)

    with TemporaryDirectory() as temp_dir:
        if args.coco_json or args.coco_zip:
            pairs, errors = convert_coco_to_temp_labels(load_coco(args), frames_dir, Path(temp_dir))
        else:
            if not args.labels_dir:
                raise SystemExit("使用已有 YOLO labels 时必须提供 --labels-dir")
            pairs, errors = load_existing_yolo_pairs(frames_dir, Path(args.labels_dir), args.num_classes)

        if errors:
            print("\n".join(errors))
            raise SystemExit(1)
        if not pairs:
            raise SystemExit("没有可转换的标注样本")
        split_and_copy(pairs, out_dir, args.val_ratio, args.seed)


if __name__ == "__main__":
    main()
