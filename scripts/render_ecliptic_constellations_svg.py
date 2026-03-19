#!/usr/bin/env python3
"""Render a deterministic SVG chart of the ecliptic constellations.

Data sources:
- Stellarium western asterisms + HYG star catalog, via Eleanor Lutz's
  processed open dataset:
  https://github.com/eleanorlutz/western_constellations_atlas_of_space

This script renders a rectangular ecliptic-coordinate chart focused on the
actual constellations that intersect the ecliptic, including Ophiuchus.
"""

from __future__ import annotations

import ast
import csv
import math
import urllib.request
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "imagegen" / "ecliptic-constellations-svg"
DATA_DIR = OUT_DIR / "data"

ASTERISMS_URL = (
    "https://raw.githubusercontent.com/eleanorlutz/"
    "western_constellations_atlas_of_space/master/data/processed/asterisms.csv"
)
HYG_URL = (
    "https://raw.githubusercontent.com/eleanorlutz/"
    "western_constellations_atlas_of_space/master/data/processed/"
    "hygdata_processed_mag65.csv"
)

ZODIAC_ORDER = [
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpius",
    "Ophiuchus",
    "Sagittarius",
    "Capricornus",
    "Aquarius",
    "Pisces",
]

CANVAS_WIDTH = 2400
CANVAS_HEIGHT = 1200
MARGIN_X = 120
MARGIN_Y = 95
LAT_LIMIT = 36.0
OBLIQUITY_DEG = 23.4392911
START_LONGITUDE_DEG = 31.0

BG_COLOR = "#07111f"
GRID_COLOR = "#8ba0be"
STAR_COLOR = "#dbe7ff"
LINE_COLOR = "#ffffff"
ECLIPTIC_COLOR = "#b6c7dd"
LABEL_COLOR = "#f4f7ff"


@dataclass(frozen=True)
class Point:
    lon: float
    lat: float


def ensure_file(url: str, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        urllib.request.urlretrieve(url, path)
    return path


def circular_unwrap_deg(value: float, start_deg: float) -> float:
    wrapped = (value - start_deg) % 360.0
    return wrapped


def eq_to_ecl_deg(ra_hours: float, dec_deg: float) -> Point:
    ra_rad = math.radians(ra_hours * 15.0)
    dec_rad = math.radians(dec_deg)
    eps = math.radians(OBLIQUITY_DEG)

    x = math.cos(dec_rad) * math.cos(ra_rad)
    y = math.cos(dec_rad) * math.sin(ra_rad)
    z = math.sin(dec_rad)

    x_ecl = x
    y_ecl = y * math.cos(eps) + z * math.sin(eps)
    z_ecl = -y * math.sin(eps) + z * math.cos(eps)

    lon = math.degrees(math.atan2(y_ecl, x_ecl)) % 360.0
    lat = math.degrees(math.asin(max(-1.0, min(1.0, z_ecl))))
    return Point(lon=lon, lat=lat)


def eq_vec(ra_hours: float, dec_deg: float) -> tuple[float, float, float]:
    ra_rad = math.radians(ra_hours * 15.0)
    dec_rad = math.radians(dec_deg)
    return (
        math.cos(dec_rad) * math.cos(ra_rad),
        math.cos(dec_rad) * math.sin(ra_rad),
        math.sin(dec_rad),
    )


def ecl_from_vec(vec: tuple[float, float, float]) -> Point:
    x, y, z = vec
    eps = math.radians(OBLIQUITY_DEG)
    x_ecl = x
    y_ecl = y * math.cos(eps) + z * math.sin(eps)
    z_ecl = -y * math.sin(eps) + z * math.cos(eps)
    lon = math.degrees(math.atan2(y_ecl, x_ecl)) % 360.0
    lat = math.degrees(math.asin(max(-1.0, min(1.0, z_ecl))))
    return Point(lon=lon, lat=lat)


def slerp(
    a: tuple[float, float, float],
    b: tuple[float, float, float],
    t: float,
) -> tuple[float, float, float]:
    dot = max(-1.0, min(1.0, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
    omega = math.acos(dot)
    if omega < 1e-8:
        x = a[0] + (b[0] - a[0]) * t
        y = a[1] + (b[1] - a[1]) * t
        z = a[2] + (b[2] - a[2]) * t
    else:
        sin_omega = math.sin(omega)
        s0 = math.sin((1.0 - t) * omega) / sin_omega
        s1 = math.sin(t * omega) / sin_omega
        x = s0 * a[0] + s1 * b[0]
        y = s0 * a[1] + s1 * b[1]
        z = s0 * a[2] + s1 * b[2]
    norm = math.sqrt(x * x + y * y + z * z)
    return (x / norm, y / norm, z / norm)


def project(point: Point) -> tuple[float, float]:
    inner_w = CANVAS_WIDTH - 2 * MARGIN_X
    inner_h = CANVAS_HEIGHT - 2 * MARGIN_Y
    x = MARGIN_X + (point.lon / 360.0) * inner_w
    y = MARGIN_Y + ((LAT_LIMIT - point.lat) / (2.0 * LAT_LIMIT)) * inner_h
    return (x, y)


def normalize_path(points: list[Point]) -> list[Point]:
    if not points:
        return points
    normalized = [Point(circular_unwrap_deg(points[0].lon, START_LONGITUDE_DEG), points[0].lat)]
    for point in points[1:]:
        lon = circular_unwrap_deg(point.lon, START_LONGITUDE_DEG)
        prev = normalized[-1].lon
        while lon - prev > 180.0:
            lon -= 360.0
        while prev - lon > 180.0:
            lon += 360.0
        normalized.append(Point(lon=lon, lat=point.lat))
    return normalized


def path_for_segment(
    ra0: float,
    dec0: float,
    ra1: float,
    dec1: float,
) -> list[tuple[float, float]]:
    a = eq_vec(ra0, dec0)
    b = eq_vec(ra1, dec1)
    dot = max(-1.0, min(1.0, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
    angular_deg = math.degrees(math.acos(dot))
    steps = max(8, int(math.ceil(angular_deg / 1.5)))

    sampled = [ecl_from_vec(slerp(a, b, i / steps)) for i in range(steps + 1)]
    sampled = normalize_path(sampled)
    return [project(p) for p in sampled]


def polyline_d(points: list[tuple[float, float]]) -> str:
    return "M " + " L ".join(f"{x:.2f},{y:.2f}" for x, y in points)


def star_radius(mag: float, emphasized: bool = False) -> float:
    base = max(0.5, 3.6 - 0.42 * max(mag, -1.0))
    if emphasized:
        base += 0.8
    return min(base, 4.8)


def star_opacity(mag: float) -> float:
    return max(0.18, min(0.95, 0.90 - 0.085 * max(mag, 0.0)))


def load_asterisms(path: Path) -> dict[str, dict[str, list[float] | str]]:
    rows: dict[str, dict[str, list[float] | str]] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            name = row["name"]
            if name not in ZODIAC_ORDER:
                continue
            rows[name] = {
                "code": row["constellation"],
                "ra": ast.literal_eval(row["ra"]),
                "dec": ast.literal_eval(row["dec"]),
            }
    return rows


def load_background_stars(path: Path) -> list[dict[str, float]]:
    stars: list[dict[str, float]] = []
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            try:
                mag = float(row["mag"])
                ra = float(row["ra"])
                dec = float(row["dec"])
            except (TypeError, ValueError):
                continue

            point = eq_to_ecl_deg(ra, dec)
            lon = circular_unwrap_deg(point.lon, START_LONGITUDE_DEG)
            if abs(point.lat) > LAT_LIMIT or mag > 5.8:
                continue
            stars.append(
                {
                    "lon": lon,
                    "lat": point.lat,
                    "mag": mag,
                }
            )
    return stars


def label_anchor(ras: list[float], decs: list[float]) -> Point:
    points = [eq_to_ecl_deg(ra, dec) for ra, dec in zip(ras, decs)]
    lons = [circular_unwrap_deg(p.lon, START_LONGITUDE_DEG) for p in points]
    lats = [p.lat for p in points]
    return Point(sum(lons) / len(lons), sum(lats) / len(lats))


def build_svg(asterisms: dict[str, dict[str, list[float] | str]], stars: list[dict[str, float]], *, labeled: bool) -> str:
    parts: list[str] = []
    parts.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS_WIDTH}" '
        f'height="{CANVAS_HEIGHT}" viewBox="0 0 {CANVAS_WIDTH} {CANVAS_HEIGHT}">'
    )
    parts.append(
        f'<rect width="{CANVAS_WIDTH}" height="{CANVAS_HEIGHT}" fill="{BG_COLOR}" />'
    )

    # Ecliptic band and grid.
    band_top = project(Point(0, 8.0))[1]
    band_bottom = project(Point(0, -8.0))[1]
    parts.append(
        f'<rect x="{MARGIN_X}" y="{band_top:.2f}" width="{CANVAS_WIDTH - 2 * MARGIN_X}" '
        f'height="{band_bottom - band_top:.2f}" fill="{ECLIPTIC_COLOR}" opacity="0.08" />'
    )

    for lon in range(0, 361, 30):
        x, _ = project(Point(lon, 0))
        opacity = "0.24" if lon % 90 == 0 else "0.12"
        parts.append(
            f'<line x1="{x:.2f}" y1="{MARGIN_Y}" x2="{x:.2f}" '
            f'y2="{CANVAS_HEIGHT - MARGIN_Y}" stroke="{GRID_COLOR}" '
            f'stroke-width="1" opacity="{opacity}" />'
        )

    for lat in range(-30, 31, 10):
        _, y = project(Point(0, float(lat)))
        opacity = "0.18" if lat == 0 else "0.10"
        dash = ' stroke-dasharray="8 8"' if lat != 0 else ""
        parts.append(
            f'<line x1="{MARGIN_X}" y1="{y:.2f}" x2="{CANVAS_WIDTH - MARGIN_X}" '
            f'y2="{y:.2f}" stroke="{GRID_COLOR}" stroke-width="1"{dash} opacity="{opacity}" />'
        )

    # Background stars.
    for star in stars:
        x, y = project(Point(star["lon"], star["lat"]))
        parts.append(
            f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{star_radius(star["mag"]):.2f}" '
            f'fill="{STAR_COLOR}" opacity="{star_opacity(star["mag"]):.3f}" />'
        )

    # Constellation great-circle lines.
    for name in ZODIAC_ORDER:
        row = asterisms[name]
        ras = row["ra"]
        decs = row["dec"]
        for idx in range(0, len(ras), 2):
            path_points = path_for_segment(ras[idx], decs[idx], ras[idx + 1], decs[idx + 1])
            parts.append(
                f'<path d="{polyline_d(path_points)}" fill="none" stroke="{LINE_COLOR}" '
                f'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" '
                f'opacity="0.96" />'
            )

        # Emphasized vertices used by the stick figures.
        for ra, dec in zip(ras, decs):
            point = eq_to_ecl_deg(ra, dec)
            x, y = project(Point(circular_unwrap_deg(point.lon, START_LONGITUDE_DEG), point.lat))
            parts.append(
                f'<circle cx="{x:.2f}" cy="{y:.2f}" r="3.35" fill="{LINE_COLOR}" opacity="0.98" />'
            )

    if labeled:
        parts.append(
            '<g font-family="Georgia, Times New Roman, serif" font-size="34" '
            f'fill="{LABEL_COLOR}" letter-spacing="0.5">'
        )
        for name in ZODIAC_ORDER:
            row = asterisms[name]
            anchor = label_anchor(row["ra"], row["dec"])
            x, y = project(anchor)
            y -= 18.0 if anchor.lat < 0 else 14.0
            parts.append(
                f'<text x="{x:.2f}" y="{y:.2f}" text-anchor="middle" '
                'paint-order="stroke" stroke="#07111f" stroke-width="6" '
                f'stroke-linejoin="round">{name}</text>'
            )
        parts.append("</g>")

    parts.append("</svg>")
    return "\n".join(parts)


def write_png(
    asterisms: dict[str, dict[str, list[float] | str]],
    stars: list[dict[str, float]],
    out_path: Path,
    *,
    labeled: bool,
) -> None:
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(16, 8), dpi=220, facecolor=BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    ax.set_xlim(0.0, 360.0)
    ax.set_ylim(-LAT_LIMIT, LAT_LIMIT)

    ax.axhspan(-8.0, 8.0, color=ECLIPTIC_COLOR, alpha=0.08, zorder=0)

    for lon in range(0, 361, 30):
        alpha = 0.24 if lon % 90 == 0 else 0.12
        ax.axvline(lon, color=GRID_COLOR, lw=0.6, alpha=alpha, zorder=0)

    for lat in range(-30, 31, 10):
        alpha = 0.18 if lat == 0 else 0.10
        linestyle = "-" if lat == 0 else (0, (6, 6))
        ax.axhline(lat, color=GRID_COLOR, lw=0.6, alpha=alpha, linestyle=linestyle, zorder=0)

    xs = [star["lon"] for star in stars]
    ys = [star["lat"] for star in stars]
    sizes = [(star_radius(star["mag"]) * 2.6) ** 2 for star in stars]
    alphas = [star_opacity(star["mag"]) for star in stars]
    ax.scatter(xs, ys, s=sizes, c=STAR_COLOR, alpha=alphas, linewidths=0, zorder=1)

    for name in ZODIAC_ORDER:
        row = asterisms[name]
        ras = row["ra"]
        decs = row["dec"]
        for idx in range(0, len(ras), 2):
            curve = []
            a = eq_vec(ras[idx], decs[idx])
            b = eq_vec(ras[idx + 1], decs[idx + 1])
            dot = max(-1.0, min(1.0, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
            angular_deg = math.degrees(math.acos(dot))
            steps = max(8, int(math.ceil(angular_deg / 1.5)))
            for i in range(steps + 1):
                point = ecl_from_vec(slerp(a, b, i / steps))
                curve.append(point)
            curve = normalize_path(curve)
            ax.plot(
                [p.lon for p in curve],
                [p.lat for p in curve],
                color=LINE_COLOR,
                lw=1.5,
                alpha=0.96,
                solid_capstyle="round",
                solid_joinstyle="round",
                zorder=3,
            )

        points = [eq_to_ecl_deg(ra, dec) for ra, dec in zip(ras, decs)]
        ax.scatter(
            [circular_unwrap_deg(p.lon, START_LONGITUDE_DEG) for p in points],
            [p.lat for p in points],
            s=24,
            c=LINE_COLOR,
            alpha=0.98,
            linewidths=0,
            zorder=4,
        )

    if labeled:
        for name in ZODIAC_ORDER:
            row = asterisms[name]
            anchor = label_anchor(row["ra"], row["dec"])
            y = anchor.lat - 2.0 if anchor.lat < 0 else anchor.lat + 1.8
            ax.text(
                anchor.lon,
                y,
                name,
                color=LABEL_COLOR,
                fontsize=11,
                ha="center",
                va="center",
                family="DejaVu Serif",
                zorder=5,
                bbox={"facecolor": BG_COLOR, "edgecolor": "none", "pad": 1.6, "alpha": 0.82},
            )

    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)

    plt.subplots_adjust(left=0, right=1, bottom=0, top=1)
    fig.savefig(out_path, dpi=220, facecolor=fig.get_facecolor(), bbox_inches="tight", pad_inches=0)
    plt.close(fig)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    asterisms_path = ensure_file(ASTERISMS_URL, DATA_DIR / "asterisms.csv")
    hyg_path = ensure_file(HYG_URL, DATA_DIR / "hygdata_processed_mag65.csv")

    asterisms = load_asterisms(asterisms_path)
    missing = [name for name in ZODIAC_ORDER if name not in asterisms]
    if missing:
        raise RuntimeError(f"Missing constellations in asterism data: {missing}")
    stars = load_background_stars(hyg_path)

    unlabeled_svg = build_svg(asterisms, stars, labeled=False)
    labeled_svg = build_svg(asterisms, stars, labeled=True)

    (OUT_DIR / "ecliptic_constellations_actual.svg").write_text(unlabeled_svg, encoding="utf-8")
    (OUT_DIR / "ecliptic_constellations_actual_labeled.svg").write_text(labeled_svg, encoding="utf-8")
    write_png(
        asterisms,
        stars,
        OUT_DIR / "ecliptic_constellations_actual.png",
        labeled=False,
    )
    write_png(
        asterisms,
        stars,
        OUT_DIR / "ecliptic_constellations_actual_labeled.png",
        labeled=True,
    )

    manifest = (
        "Deterministic astronomy chart generated from Stellarium western "
        "asterisms + HYG star positions.\n"
        f"Start longitude cut: {START_LONGITUDE_DEG:.1f} deg\n"
        f"Ecliptic latitude extent: +/-{LAT_LIMIT:.1f} deg\n"
        "Included constellations: "
        + ", ".join(ZODIAC_ORDER)
        + "\n"
    )
    (OUT_DIR / "render_notes.txt").write_text(manifest, encoding="utf-8")

    print(f"Wrote {(OUT_DIR / 'ecliptic_constellations_actual.svg')}")
    print(f"Wrote {(OUT_DIR / 'ecliptic_constellations_actual_labeled.svg')}")
    print(f"Wrote {(OUT_DIR / 'ecliptic_constellations_actual.png')}")
    print(f"Wrote {(OUT_DIR / 'ecliptic_constellations_actual_labeled.png')}")
    print(f"Wrote {(OUT_DIR / 'render_notes.txt')}")


if __name__ == "__main__":
    main()
