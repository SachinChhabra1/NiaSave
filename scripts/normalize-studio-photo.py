#!/usr/bin/env python3
"""Cover-crop a studio still to 4:3 1200x900 WebP using attention (energy) centering."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def energy_map(gray: Image.Image) -> np.ndarray:
    blurred = gray.filter(ImageFilter.GaussianBlur(radius=1.2))
    arr = np.asarray(blurred, dtype=np.float32)
    dx = np.abs(np.diff(arr, axis=1, prepend=arr[:, :1]))
    dy = np.abs(np.diff(arr, axis=0, prepend=arr[:1, :]))
    return dx + dy


def integral(energy: np.ndarray) -> np.ndarray:
    padded = np.pad(energy, ((1, 0), (1, 0)))
    return padded.cumsum(0).cumsum(1)


def region(ii: np.ndarray, x: int, y: int, w: int, h: int) -> float:
    return float(ii[y + h, x + w] - ii[y, x + w] - ii[y + h, x] + ii[y, x])


def attention_crop(img: Image.Image, target_w: int, target_h: int) -> tuple[int, int, int, int]:
    width, height = img.size
    ratio = target_w / target_h
    if width / height >= ratio:
        crop_h = height
        crop_w = max(1, round(height * ratio))
    else:
        crop_w = width
        crop_h = max(1, round(width / ratio))
    crop_w = min(crop_w, width)
    crop_h = min(crop_h, height)
    margin_x = round(crop_w * 0.04)
    margin_y = round(crop_h * 0.04)
    min_x = min(margin_x, max(0, width - crop_w))
    min_y = min(margin_y, max(0, height - crop_h))
    max_x = max(min_x, width - crop_w - margin_x)
    max_y = max(min_y, height - crop_h - margin_y)
    gray = img.convert("L")
    ii = integral(energy_map(gray))
    step = max(1, min(crop_w, crop_h) // 24)
    best = -1.0
    bx, by = min_x, min_y
    y = min_y
    while y <= max_y:
        x = min_x
        while x <= max_x:
            score = region(ii, x, y, crop_w, crop_h)
            if score > best:
                best = score
                bx, by = x, y
            x += step
        y += step
    return bx, by, crop_w, crop_h


def normalize(src: Path, dest: Path, width: int, height: int, quality: int) -> dict:
    with Image.open(src) as raw:
        img = raw.convert("RGB")
        source_w, source_h = img.size
        x, y, w, h = attention_crop(img, width, height)
        cropped = img.crop((x, y, x + w, y + h))
        out = cropped.resize((width, height), Image.Resampling.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "WEBP", quality=quality, method=6)
        return {
            "ok": True,
            "width": width,
            "height": height,
            "aspect": "4:3",
            "format": "webp",
            "quality": quality,
            "crop": "cover-attention",
            "sourceWidth": source_w,
            "sourceHeight": source_h,
            "window": [x, y, w, h],
        }


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: normalize-studio-photo.py SRC DEST [W H QUALITY]", file=sys.stderr)
        return 2
    src = Path(sys.argv[1])
    dest = Path(sys.argv[2])
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 1200
    height = int(sys.argv[4]) if len(sys.argv) > 4 else 900
    quality = int(sys.argv[5]) if len(sys.argv) > 5 else 80
    if not src.is_file():
        print("photo_source_missing", file=sys.stderr)
        return 1
    try:
        info = normalize(src, dest, width, height, quality)
    except Exception as error:
        print(f"photo_normalize_unavailable: {error}", file=sys.stderr)
        return 1
    print(json.dumps(info))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
