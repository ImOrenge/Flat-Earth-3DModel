from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    default_input = repo_root / "assets" / "flat-earth-map-square.png"
    default_output = repo_root / "assets" / "flat-earth-map-square.svg"

    parser = argparse.ArgumentParser(
        description="Convert a flat-earth PNG texture into a segmented SVG vector map."
    )
    parser.add_argument("--input", type=Path, default=default_input)
    parser.add_argument("--output", type=Path, default=default_output)
    parser.add_argument(
        "--colors",
        type=int,
        default=28,
        help="Number of land colors to keep during vectorization.",
    )
    parser.add_argument(
        "--water-colors",
        type=int,
        default=3,
        help="Number of water colors to keep during vectorization.",
    )
    parser.add_argument(
        "--ice-colors",
        type=int,
        default=5,
        help="Number of ice colors to keep during vectorization.",
    )
    parser.add_argument(
        "--min-area",
        type=float,
        default=2.0,
        help="Ignore traced regions smaller than this area in pixels.",
    )
    parser.add_argument(
        "--epsilon-scale",
        type=float,
        default=0.0007,
        help="Contour simplification factor relative to perimeter length.",
    )
    parser.add_argument(
        "--stroke-width",
        type=float,
        default=0.5,
        help="Stroke width used to hide hairline gaps between vector paths.",
    )
    return parser.parse_args()


def load_image(path: Path) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise FileNotFoundError(f"Could not read input image: {path}")
    return image


def clean_mask(mask: np.ndarray, open_size: int, close_size: int) -> np.ndarray:
    result = mask.astype(np.uint8) * 255
    if open_size > 1:
        open_kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (open_size, open_size)
        )
        result = cv2.morphologyEx(result, cv2.MORPH_OPEN, open_kernel)
    if close_size > 1:
        close_kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (close_size, close_size)
        )
        result = cv2.morphologyEx(result, cv2.MORPH_CLOSE, close_kernel)
    return result > 0


def create_disc_mask(image: np.ndarray) -> tuple[np.ndarray, tuple[float, float, float]]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, thresholded = cv2.threshold(gray, 6, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(
        thresholded, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        raise RuntimeError("Could not detect the circular map area.")

    largest = max(contours, key=cv2.contourArea)
    mask = np.zeros_like(gray)
    cv2.drawContours(mask, [largest], -1, 255, thickness=cv2.FILLED)
    mask = clean_mask(mask > 0, open_size=3, close_size=7)

    (center_x, center_y), radius = cv2.minEnclosingCircle(largest)
    return mask, (center_x, center_y, radius)


def build_region_masks(
    image: np.ndarray, disc_mask: np.ndarray, circle: tuple[float, float, float]
) -> dict[str, np.ndarray]:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    hue = hsv[:, :, 0]
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]

    center_x, center_y, radius = circle
    yy, xx = np.ogrid[: image.shape[0], : image.shape[1]]
    normalized_radius = np.sqrt((xx - center_x) ** 2 + (yy - center_y) ** 2) / radius

    rim_mask = disc_mask & (normalized_radius >= 0.92)
    bright_ice = disc_mask & (sat < 52) & (val > 150)
    polar_ice = disc_mask & (sat < 75) & (val > 132) & (normalized_radius < 0.24)
    ice_mask = clean_mask(rim_mask | bright_ice | polar_ice, open_size=3, close_size=7)

    water_seed = (
        disc_mask
        & ~ice_mask
        & (hue >= 82)
        & (hue <= 118)
        & (sat >= 55)
        & (val >= 45)
    )
    water_mask = clean_mask(water_seed, open_size=5, close_size=11)

    land_mask = disc_mask & ~ice_mask & ~water_mask
    land_mask = clean_mask(land_mask, open_size=3, close_size=7)

    unresolved = disc_mask & ~ice_mask & ~water_mask & ~land_mask
    land_mask = land_mask | unresolved

    return {
        "water": water_mask,
        "land": land_mask,
        "ice": ice_mask,
    }


def quantize_pixels(pixels_bgr: np.ndarray, color_count: int) -> np.ndarray:
    if len(pixels_bgr) == 0:
        return np.empty((0, 3), dtype=np.uint8)

    unique = np.unique(pixels_bgr, axis=0)
    if len(unique) <= color_count:
        return pixels_bgr

    lab = cv2.cvtColor(pixels_bgr.reshape((-1, 1, 3)), cv2.COLOR_BGR2LAB).reshape((-1, 3))
    samples = lab.astype(np.float32)

    criteria = (
        cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER,
        64,
        0.1,
    )
    cv2.setRNGSeed(7)
    _, labels, centers = cv2.kmeans(
        samples,
        color_count,
        None,
        criteria,
        3,
        cv2.KMEANS_PP_CENTERS,
    )
    centers = np.uint8(centers)
    quantized_lab = centers[labels.flatten()].reshape((-1, 1, 3))
    return cv2.cvtColor(quantized_lab, cv2.COLOR_LAB2BGR).reshape((-1, 3))


def quantize_region(
    image: np.ndarray,
    mask: np.ndarray,
    color_count: int,
    blur_size: int,
    sigma_color: float,
    sigma_space: float,
) -> np.ndarray:
    if blur_size % 2 == 0:
        blur_size += 1

    filtered = cv2.bilateralFilter(
        image, d=blur_size, sigmaColor=sigma_color, sigmaSpace=sigma_space
    )
    region_pixels = filtered[mask]
    quantized_pixels = quantize_pixels(region_pixels, color_count)

    result = np.zeros_like(image)
    result[mask] = quantized_pixels
    return result


def color_to_hex(color: np.ndarray) -> str:
    b, g, r = [int(channel) for channel in color]
    return f"#{r:02x}{g:02x}{b:02x}"


def rgb_to_hex(color: np.ndarray) -> str:
    r, g, b = [int(channel) for channel in color]
    return f"#{r:02x}{g:02x}{b:02x}"


def contour_to_path(contour: np.ndarray) -> str:
    points = contour.reshape(-1, 2)
    if len(points) < 3:
        return ""

    start_x, start_y = points[0]
    commands = [f"M {start_x} {start_y}"]
    for x, y in points[1:]:
        commands.append(f"L {x} {y}")
    commands.append("Z")
    return " ".join(commands)


def build_guide_mask(image: np.ndarray, water_mask: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    top_hat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, kernel)

    guide_seed = water_mask & (top_hat > 10) & (sat < 120) & (val > 70)
    guide_mask = clean_mask(guide_seed, open_size=1, close_size=3)
    return guide_mask


def guide_color_from_image(image: np.ndarray, guide_mask: np.ndarray) -> str:
    if not guide_mask.any():
        return "#7fa3b5"

    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    guide_pixels = rgb[guide_mask].astype(np.float32)
    average = guide_pixels.mean(axis=0)
    lifted = np.clip((average * 0.78) + (255.0 * 0.22), 0, 255).astype(np.uint8)
    return rgb_to_hex(lifted)


def append_color_paths(
    svg_parts: list[str],
    quantized_region: np.ndarray,
    mask: np.ndarray,
    min_area: float,
    epsilon_scale: float,
    stroke_width: float,
) -> None:
    pixels = quantized_region[mask]
    if len(pixels) == 0:
        return

    unique_colors, counts = np.unique(pixels, axis=0, return_counts=True)
    order = np.argsort(counts)[::-1]

    for color in unique_colors[order]:
        color_mask = np.all(quantized_region == color, axis=2) & mask
        contour_mask = (color_mask.astype(np.uint8)) * 255
        contours, _ = cv2.findContours(
            contour_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE
        )

        path_segments: list[str] = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < min_area:
                continue

            epsilon = max(0.12, epsilon_scale * cv2.arcLength(contour, True))
            simplified = cv2.approxPolyDP(contour, epsilon, True)
            path_data = contour_to_path(simplified)
            if path_data:
                path_segments.append(path_data)

        if not path_segments:
            continue

        hex_color = color_to_hex(color)
        svg_parts.append(
            (
                f'<path fill="{hex_color}" stroke="{hex_color}" '
                f'stroke-width="{stroke_width}" fill-rule="evenodd" '
                f'd="{" ".join(path_segments)}"/>'
            )
        )


def append_mask_paths(
    svg_parts: list[str],
    mask: np.ndarray,
    color: str,
    min_area: float,
    epsilon_scale: float,
    stroke_width: float,
    opacity: float,
) -> None:
    contour_mask = (mask.astype(np.uint8)) * 255
    contours, _ = cv2.findContours(
        contour_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE
    )

    path_segments: list[str] = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area:
            continue

        epsilon = max(0.08, epsilon_scale * cv2.arcLength(contour, True))
        simplified = cv2.approxPolyDP(contour, epsilon, True)
        path_data = contour_to_path(simplified)
        if path_data:
            path_segments.append(path_data)

    if not path_segments:
        return

    svg_parts.append(
        (
            f'<path fill="{color}" stroke="{color}" stroke-width="{stroke_width}" '
            f'opacity="{opacity}" fill-rule="evenodd" d="{" ".join(path_segments)}"/>'
        )
    )


def build_svg(
    image: np.ndarray,
    regions: dict[str, np.ndarray],
    land_colors: int,
    water_colors: int,
    ice_colors: int,
    min_area: float,
    epsilon_scale: float,
    stroke_width: float,
) -> str:
    height, width = image.shape[:2]
    guide_mask = build_guide_mask(image, regions["water"])
    guide_color = guide_color_from_image(image, guide_mask)

    water_quantized = quantize_region(
        image, regions["water"], water_colors, blur_size=11, sigma_color=36, sigma_space=24
    )
    land_quantized = quantize_region(
        image, regions["land"], land_colors, blur_size=7, sigma_color=20, sigma_space=18
    )
    ice_quantized = quantize_region(
        image, regions["ice"], ice_colors, blur_size=9, sigma_color=24, sigma_space=18
    )

    svg_parts: list[str] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
        ),
        '<title>Flat Earth Map Vector</title>',
        '<desc>Segmented SVG generated from the square flat-earth map texture.</desc>',
        '<rect width="100%" height="100%" fill="#000000"/>',
        '<g stroke-linejoin="round" stroke-linecap="round">',
    ]

    append_color_paths(
        svg_parts,
        water_quantized,
        regions["water"],
        min_area=max(8.0, min_area * 6),
        epsilon_scale=epsilon_scale * 1.8,
        stroke_width=stroke_width,
    )
    append_mask_paths(
        svg_parts,
        guide_mask,
        color=guide_color,
        min_area=max(1.5, min_area),
        epsilon_scale=epsilon_scale * 0.55,
        stroke_width=max(0.28, stroke_width * 0.8),
        opacity=0.82,
    )
    append_color_paths(
        svg_parts,
        land_quantized,
        regions["land"],
        min_area=min_area,
        epsilon_scale=epsilon_scale,
        stroke_width=stroke_width,
    )
    append_color_paths(
        svg_parts,
        ice_quantized,
        regions["ice"],
        min_area=max(4.0, min_area * 2),
        epsilon_scale=epsilon_scale * 1.2,
        stroke_width=stroke_width,
    )

    svg_parts.append("</g>")
    svg_parts.append("</svg>")
    return "\n".join(svg_parts)


def main() -> None:
    args = parse_args()
    image = load_image(args.input)
    disc_mask, circle = create_disc_mask(image)
    regions = build_region_masks(image, disc_mask, circle)
    svg = build_svg(
        image=image,
        regions=regions,
        land_colors=args.colors,
        water_colors=args.water_colors,
        ice_colors=args.ice_colors,
        min_area=args.min_area,
        epsilon_scale=args.epsilon_scale,
        stroke_width=args.stroke_width,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(svg, encoding="utf-8")

    region_stats = ", ".join(
        f"{name}={int(mask.sum())}" for name, mask in regions.items()
    )
    print(f"Created {args.output}")
    print(f"Regions: {region_stats}")


if __name__ == "__main__":
    main()
