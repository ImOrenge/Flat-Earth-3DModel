from __future__ import annotations

import argparse
import base64
from collections import deque
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


MAJOR_COMPONENT_MIN_AREA = 1500
MIN_COMPONENT_AREA = 8
OUTLINE_STROKE = "#10232f"
OUTLINE_STROKE_OPACITY = 0.58
OUTLINE_STROKE_WIDTH = 1.25


def load_rgb_image(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB"))


def encode_png_bytes(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def encode_file_bytes(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def build_land_mask(image: np.ndarray) -> np.ndarray:
    cv2.setRNGSeed(42)

    non_black = image.mean(axis=2) > 10
    pixels = image[non_black].reshape(-1, 3).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 1.0)
    _, labels, centers = cv2.kmeans(
        pixels,
        10,
        None,
        criteria,
        12,
        cv2.KMEANS_PP_CENTERS,
    )

    centers = centers.astype(int)
    land_clusters = []
    for index, center in enumerate(centers):
        red, green, blue = center.tolist()
        if red > blue + 15 and green > blue - 25 and red > 70:
            land_clusters.append(index)

    clustered = np.zeros(non_black.sum(), dtype=np.uint8)
    clustered[np.isin(labels.flatten(), land_clusters)] = 255

    land_mask = np.zeros(non_black.shape, dtype=np.uint8)
    land_mask[non_black] = clustered

    kernel = np.ones((3, 3), np.uint8)
    land_mask = cv2.morphologyEx(land_mask, cv2.MORPH_OPEN, kernel)
    land_mask = cv2.morphologyEx(land_mask, cv2.MORPH_CLOSE, kernel)
    return land_mask


def pick_nearest_mask_pixel(mask: np.ndarray, target_x: float, target_y: float) -> tuple[int, int]:
    points = np.argwhere(mask > 0)
    ys = points[:, 0]
    xs = points[:, 1]
    index = int(np.argmin((xs - target_x) ** 2 + (ys - target_y) ** 2))
    return int(xs[index]), int(ys[index])


def split_old_world(old_world_mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    points = np.argwhere(old_world_mask > 0)
    ymin, xmin = points.min(axis=0)
    ymax, xmax = points.max(axis=0)
    width = xmax - xmin + 1
    height = ymax - ymin + 1

    africa_seed = pick_nearest_mask_pixel(
        old_world_mask,
        xmin + (width * 0.45),
        ymin + (height * 0.80),
    )
    eurasia_seed = pick_nearest_mask_pixel(
        old_world_mask,
        xmin + (width * 0.50),
        ymin + (height * 0.18),
    )

    labels = np.full(old_world_mask.shape, -1, dtype=np.int16)
    queue: deque[tuple[int, int, int]] = deque()

    for label, (seed_x, seed_y) in enumerate((africa_seed, eurasia_seed)):
        labels[seed_y, seed_x] = label
        queue.append((seed_x, seed_y, label))

    neighbors = (
        (-1, -1), (0, -1), (1, -1),
        (-1, 0),            (1, 0),
        (-1, 1),  (0, 1),   (1, 1),
    )

    height_px, width_px = old_world_mask.shape
    while queue:
        x, y, label = queue.popleft()
        for dx, dy in neighbors:
            nx = x + dx
            ny = y + dy
            if nx < 0 or ny < 0 or nx >= width_px or ny >= height_px:
                continue
            if not old_world_mask[ny, nx] or labels[ny, nx] != -1:
                continue
            labels[ny, nx] = label
            queue.append((nx, ny, label))

    africa = (labels == 0)
    eurasia = (labels == 1)
    return africa, eurasia


def build_continent_masks(land_mask: np.ndarray) -> dict[str, np.ndarray]:
    component_count, component_labels, stats, centroids = cv2.connectedComponentsWithStats(land_mask, 8)
    major_components = [
        index
        for index in range(1, component_count)
        if stats[index, cv2.CC_STAT_AREA] > MAJOR_COMPONENT_MIN_AREA
    ]

    if len(major_components) != 4:
        raise RuntimeError(f"Expected 4 major landmasses, found {len(major_components)}")

    oceania_component = min(major_components, key=lambda index: centroids[index][1])
    remaining = [index for index in major_components if index != oceania_component]

    south_america_component = min(remaining, key=lambda index: centroids[index][0])
    remaining = [index for index in remaining if index != south_america_component]

    north_america_component = min(remaining, key=lambda index: centroids[index][0])
    old_world_component = next(index for index in remaining if index != north_america_component)

    continent_masks: dict[str, np.ndarray] = {
        "north-america": component_labels == north_america_component,
        "south-america": component_labels == south_america_component,
        "oceania": component_labels == oceania_component,
    }

    africa_mask, eurasia_mask = split_old_world(component_labels == old_world_component)
    continent_masks["africa"] = africa_mask
    continent_masks["eurasia"] = eurasia_mask

    centroids_by_name = {
        name: np.argwhere(mask).mean(axis=0)[::-1]
        for name, mask in continent_masks.items()
    }

    for index in range(1, component_count):
        if index in major_components:
            continue
        area = int(stats[index, cv2.CC_STAT_AREA])
        if area < MIN_COMPONENT_AREA:
            continue

        cx, cy = centroids[index]
        nearest_name = min(
            centroids_by_name,
            key=lambda name: (
                (centroids_by_name[name][0] - cx) ** 2
                + (centroids_by_name[name][1] - cy) ** 2
            ),
        )
        continent_masks[nearest_name] |= component_labels == index

    return continent_masks


def build_background_image(source_image: np.ndarray, continent_masks: dict[str, np.ndarray]) -> Image.Image:
    rgba = np.dstack([source_image, np.full(source_image.shape[:2], 255, dtype=np.uint8)])
    union_mask = np.zeros(source_image.shape[:2], dtype=bool)
    for mask in continent_masks.values():
        union_mask |= mask
    rgba[union_mask, 3] = 0
    return Image.fromarray(rgba, mode="RGBA")


def contour_to_path(contour: np.ndarray) -> str:
    points = contour.reshape(-1, 2)
    head = f"M {points[0][0]} {points[0][1]}"
    segments = [f"L {x} {y}" for x, y in points[1:]]
    return " ".join([head, *segments, "Z"])


def mask_to_svg_path(mask: np.ndarray) -> str:
    mask_u8 = (mask.astype(np.uint8)) * 255
    contours, _ = cv2.findContours(mask_u8, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)

    path_parts: list[str] = []
    for contour in contours:
        area = abs(cv2.contourArea(contour))
        if area < MIN_COMPONENT_AREA:
            continue
        simplified = cv2.approxPolyDP(contour, epsilon=0.8, closed=True)
        path_parts.append(contour_to_path(simplified))

    if not path_parts:
        raise RuntimeError("Mask conversion produced an empty SVG path.")

    return " ".join(path_parts)


def build_svg(
    width: int,
    height: int,
    full_map_base64: str,
    background_base64: str,
    continent_paths: dict[str, str],
) -> str:
    clip_defs = []
    continent_groups = []
    ordered_names = (
        "north-america",
        "south-america",
        "eurasia",
        "africa",
        "oceania",
    )

    for name in ordered_names:
        path_data = continent_paths[name]
        clip_defs.append(
            f'    <clipPath id="clip-{name}" clipPathUnits="userSpaceOnUse">'
            f'<path d="{path_data}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath>'
        )
        continent_groups.append(
            "\n".join(
                [
                    f'  <g id="{name}" class="continent">',
                    f'    <g clip-path="url(#clip-{name})">',
                    (
                        f'      <image width="{width}" height="{height}" preserveAspectRatio="none" '
                        f'href="data:image/png;base64,{full_map_base64}"/>'
                    ),
                    "    </g>",
                    (
                        f'    <path d="{path_data}" fill="none" stroke="{OUTLINE_STROKE}" '
                        f'stroke-opacity="{OUTLINE_STROKE_OPACITY}" stroke-width="{OUTLINE_STROKE_WIDTH}" '
                        'stroke-linejoin="round" stroke-linecap="round"/>'
                    ),
                    "  </g>",
                ]
            )
        )

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        "  <title>Flat Earth Map Continents</title>",
        "  <desc>PNG-colored flat earth map with continents separated into clipped SVG groups.</desc>",
        "  <defs>",
        *clip_defs,
        "  </defs>",
        (
            f'  <image width="{width}" height="{height}" preserveAspectRatio="none" '
            f'href="data:image/png;base64,{background_base64}"/>'
        ),
        *continent_groups,
        "</svg>",
        "",
    ]
    return "\n".join(lines)


def generate(source_png: Path, output_svg: Path) -> None:
    source_image = load_rgb_image(source_png)
    height, width = source_image.shape[:2]

    land_mask = build_land_mask(source_image)
    continent_masks = build_continent_masks(land_mask)
    background_image = build_background_image(source_image, continent_masks)
    continent_paths = {
        name: mask_to_svg_path(mask)
        for name, mask in continent_masks.items()
    }

    svg_text = build_svg(
        width=width,
        height=height,
        full_map_base64=encode_file_bytes(source_png),
        background_base64=encode_png_bytes(background_image),
        continent_paths=continent_paths,
    )
    output_svg.write_text(svg_text, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a continent-separated flat earth SVG.")
    parser.add_argument("source_png", type=Path, help="Source flat-earth PNG to sample colors from.")
    parser.add_argument("output_svg", type=Path, help="Target SVG path.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    generate(args.source_png, args.output_svg)


if __name__ == "__main__":
    main()
