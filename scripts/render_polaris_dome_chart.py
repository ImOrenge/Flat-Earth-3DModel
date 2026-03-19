#!/usr/bin/env python3
"""Render a north-sky dome chart centered on Polaris.

Projection:
- Azimuthal equidistant centered on Polaris.
- Hemisphere radius = 90 degrees from Polaris.

Data sources:
- Stellarium western asterisms + HYG star catalog, via Eleanor Lutz's
  processed open dataset:
  https://github.com/eleanorlutz/western_constellations_atlas_of_space
"""

from __future__ import annotations

import ast
import csv
import math
import urllib.request
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "imagegen" / "polaris-dome-constellations"
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

POLARIS_RA_HOURS = 2.52975
POLARIS_DEC_DEG = 89.264109
MAX_ANGULAR_DISTANCE_DEG = 90.0

CANVAS = 1800
CENTER = CANVAS / 2
OUTER_RADIUS = 810

BG_COLOR = "#07111f"
GRID_COLOR = "#90a5c4"
STAR_COLOR = "#dce8ff"
LINE_COLOR = "#ffffff"
LABEL_COLOR = "#f4f7ff"
POLARIS_COLOR = "#fff1c2"

LABEL_NAMES = {
    "Ursa Minor",
    "Ursa Major",
    "Draco",
    "Cassiopeia",
    "Cepheus",
    "Camelopardalis",
    "Perseus",
    "Auriga",
    "Andromeda",
    "Pegasus",
    "Cygnus",
    "Lyra",
    "Lacerta",
    "Bootes",
    "Corona Borealis",
    "Hercules",
    "Gemini",
    "Taurus",
    "Aries",
}


@dataclass(frozen=True)
class SkyPoint:
    x: float
    y: float
    angular_distance_deg: float


def ensure_file(url: str, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        urllib.request.urlretrieve(url, path)
    return path


def eq_vec(ra_hours: float, dec_deg: float) -> tuple[float, float, float]:
    ra = math.radians(ra_hours * 15.0)
    dec = math.radians(dec_deg)
    return (
        math.cos(dec) * math.cos(ra),
        math.cos(dec) * math.sin(ra),
        math.sin(dec),
    )


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


def vec_to_ra_dec(vec: tuple[float, float, float]) -> tuple[float, float]:
    x, y, z = vec
    ra = math.atan2(y, x)
    if ra < 0:
        ra += 2 * math.pi
    dec = math.asin(max(-1.0, min(1.0, z)))
    return (math.degrees(ra) / 15.0, math.degrees(dec))


def project(ra_hours: float, dec_deg: float) -> SkyPoint | None:
    ra = math.radians(ra_hours * 15.0)
    dec = math.radians(dec_deg)
    ra0 = math.radians(POLARIS_RA_HOURS * 15.0)
    dec0 = math.radians(POLARIS_DEC_DEG)

    delta_ra = ra - ra0
    cos_c = (
        math.sin(dec0) * math.sin(dec)
        + math.cos(dec0) * math.cos(dec) * math.cos(delta_ra)
    )
    cos_c = max(-1.0, min(1.0, cos_c))
    c = math.acos(cos_c)
    c_deg = math.degrees(c)
    if c_deg > MAX_ANGULAR_DISTANCE_DEG:
        return None

    if c < 1e-8:
        return SkyPoint(CENTER, CENTER, 0.0)

    k = c / math.sin(c)
    x = k * math.cos(dec) * math.sin(delta_ra)
    y = k * (
        math.cos(dec0) * math.sin(dec)
        - math.sin(dec0) * math.cos(dec) * math.cos(delta_ra)
    )

    scale = OUTER_RADIUS / math.radians(MAX_ANGULAR_DISTANCE_DEG)
    screen_x = CENTER - x * scale
    screen_y = CENTER - y * scale
    return SkyPoint(screen_x, screen_y, c_deg)


def star_radius(mag: float, emphasized: bool = False) -> float:
    base = max(0.55, 3.6 - 0.42 * max(mag, -1.0))
    if emphasized:
        base += 0.95
    return min(base, 5.2)


def star_opacity(mag: float) -> float:
    return max(0.18, min(0.96, 0.92 - 0.085 * max(mag, 0.0)))


def load_asterisms(path: Path) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            rows.append(
                {
                    "code": row["constellation"],
                    "name": row["name"],
                    "ra": ast.literal_eval(row["ra"]),
                    "dec": ast.literal_eval(row["dec"]),
                }
            )
    return rows


def load_stars(path: Path) -> tuple[list[dict[str, object]], dict[str, float] | None]:
    stars: list[dict[str, object]] = []
    polaris_row: dict[str, float] | None = None
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            try:
                mag = float(row["mag"])
                ra = float(row["ra"])
                dec = float(row["dec"])
            except (TypeError, ValueError):
                continue

            proj = project(ra, dec)
            if row.get("proper") == "Polaris":
                polaris_row = {"ra": ra, "dec": dec, "mag": mag}

            if proj is None or mag > 5.8:
                continue

            stars.append(
                {
                    "x": proj.x,
                    "y": proj.y,
                    "mag": mag,
                }
            )
    return stars, polaris_row


def segment_paths(ra0: float, dec0: float, ra1: float, dec1: float) -> list[list[SkyPoint]]:
    a = eq_vec(ra0, dec0)
    b = eq_vec(ra1, dec1)
    dot = max(-1.0, min(1.0, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
    angular_deg = math.degrees(math.acos(dot))
    steps = max(8, int(math.ceil(angular_deg / 1.4)))

    runs: list[list[SkyPoint]] = []
    current: list[SkyPoint] = []
    for i in range(steps + 1):
        vec = slerp(a, b, i / steps)
        ra, dec = vec_to_ra_dec(vec)
        point = project(ra, dec)
        if point is None:
            if len(current) >= 2:
                runs.append(current)
            current = []
            continue
        current.append(point)

    if len(current) >= 2:
        runs.append(current)
    return runs


def label_anchor(ras: list[float], decs: list[float]) -> SkyPoint | None:
    visible: list[SkyPoint] = []
    for ra, dec in zip(ras, decs):
        point = project(ra, dec)
        if point is not None:
            visible.append(point)
    if not visible:
        return None
    return SkyPoint(
        x=sum(point.x for point in visible) / len(visible),
        y=sum(point.y for point in visible) / len(visible),
        angular_distance_deg=sum(point.angular_distance_deg for point in visible) / len(visible),
    )


def circle_svg(cx: float, cy: float, r: float, stroke: str, opacity: float, width: float, dash: str | None = None) -> str:
    dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
    return (
        f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="none" '
        f'stroke="{stroke}" stroke-width="{width}" opacity="{opacity:.3f}"{dash_attr} />'
    )


def build_svg(
    asterisms: list[dict[str, object]],
    stars: list[dict[str, object]],
    polaris_row: dict[str, float] | None,
    *,
    labeled: bool,
) -> str:
    parts: list[str] = []
    parts.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" '
        f'viewBox="0 0 {CANVAS} {CANVAS}">'
    )
    parts.append(f'<rect width="{CANVAS}" height="{CANVAS}" fill="{BG_COLOR}" />')

    parts.append(
        f'<circle cx="{CENTER}" cy="{CENTER}" r="{OUTER_RADIUS}" fill="#0b1730" opacity="0.42" />'
    )

    for distance_deg in (15, 30, 45, 60, 75, 90):
        radius = OUTER_RADIUS * (distance_deg / MAX_ANGULAR_DISTANCE_DEG)
        opacity = 0.20 if distance_deg in (30, 60, 90) else 0.11
        dash = None if distance_deg == 90 else "8 8"
        parts.append(circle_svg(CENTER, CENTER, radius, GRID_COLOR, opacity, 1.1, dash))

    for hour in range(0, 24, 2):
        outer = project(hour, 0.0)
        if outer is None:
            continue
        opacity = 0.18 if hour % 6 == 0 else 0.10
        parts.append(
            f'<line x1="{CENTER:.2f}" y1="{CENTER:.2f}" x2="{outer.x:.2f}" y2="{outer.y:.2f}" '
            f'stroke="{GRID_COLOR}" stroke-width="1" opacity="{opacity:.3f}" />'
        )

    for star in stars:
        parts.append(
            f'<circle cx="{star["x"]:.2f}" cy="{star["y"]:.2f}" '
            f'r="{star_radius(star["mag"]):.2f}" fill="{STAR_COLOR}" '
            f'opacity="{star_opacity(star["mag"]):.3f}" />'
        )

    for row in asterisms:
        ras = row["ra"]
        decs = row["dec"]
        for idx in range(0, len(ras), 2):
            for run in segment_paths(ras[idx], decs[idx], ras[idx + 1], decs[idx + 1]):
                d = "M " + " L ".join(f"{p.x:.2f},{p.y:.2f}" for p in run)
                parts.append(
                    f'<path d="{d}" fill="none" stroke="{LINE_COLOR}" stroke-width="2.15" '
                    'stroke-linecap="round" stroke-linejoin="round" opacity="0.96" />'
                )

        for ra, dec in zip(ras, decs):
            point = project(ra, dec)
            if point is None:
                continue
            parts.append(
                f'<circle cx="{point.x:.2f}" cy="{point.y:.2f}" r="3.15" fill="{LINE_COLOR}" opacity="0.98" />'
            )

    if polaris_row is not None:
        polaris = project(polaris_row["ra"], polaris_row["dec"])
        if polaris is not None:
            parts.append(
                f'<circle cx="{polaris.x:.2f}" cy="{polaris.y:.2f}" r="7.5" fill="{POLARIS_COLOR}" opacity="1" />'
            )
            parts.append(
                f'<circle cx="{polaris.x:.2f}" cy="{polaris.y:.2f}" r="14.0" fill="none" '
                f'stroke="{POLARIS_COLOR}" stroke-width="1.4" opacity="0.45" />'
            )

    if labeled:
        parts.append(
            '<g font-family="Georgia, Times New Roman, serif" font-size="26" '
            f'fill="{LABEL_COLOR}" letter-spacing="0.4">'
        )
        for row in asterisms:
            if row["name"] not in LABEL_NAMES:
                continue
            anchor = label_anchor(row["ra"], row["dec"])
            if anchor is None or anchor.angular_distance_deg > 82:
                continue
            parts.append(
                f'<text x="{anchor.x:.2f}" y="{anchor.y - 14:.2f}" text-anchor="middle" '
                'paint-order="stroke" stroke="#07111f" stroke-width="6" '
                f'stroke-linejoin="round">{row["name"]}</text>'
            )
        if polaris_row is not None:
            parts.append(
                f'<text x="{CENTER + 18:.2f}" y="{CENTER - 18:.2f}" text-anchor="start" '
                'paint-order="stroke" stroke="#07111f" stroke-width="6" '
                f'stroke-linejoin="round">Polaris</text>'
            )
        parts.append("</g>")

    parts.append("</svg>")
    return "\n".join(parts)


def write_png(
    asterisms: list[dict[str, object]],
    stars: list[dict[str, object]],
    polaris_row: dict[str, float] | None,
    out_path: Path,
    *,
    labeled: bool,
) -> None:
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(10, 10), dpi=220, facecolor=BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    ax.set_xlim(0, CANVAS)
    ax.set_ylim(CANVAS, 0)

    dome_fill = plt.Circle((CENTER, CENTER), OUTER_RADIUS, color="#0b1730", alpha=0.42, zorder=0)
    ax.add_patch(dome_fill)

    for distance_deg in (15, 30, 45, 60, 75, 90):
        radius = OUTER_RADIUS * (distance_deg / MAX_ANGULAR_DISTANCE_DEG)
        alpha = 0.20 if distance_deg in (30, 60, 90) else 0.11
        circle = plt.Circle(
            (CENTER, CENTER),
            radius,
            fill=False,
            color=GRID_COLOR,
            alpha=alpha,
            lw=0.8,
            linestyle="-" if distance_deg == 90 else (0, (6, 6)),
        )
        ax.add_patch(circle)

    for hour in range(0, 24, 2):
        outer = project(hour, 0.0)
        if outer is None:
            continue
        alpha = 0.18 if hour % 6 == 0 else 0.10
        ax.plot([CENTER, outer.x], [CENTER, outer.y], color=GRID_COLOR, lw=0.6, alpha=alpha, zorder=1)

    ax.scatter(
        [star["x"] for star in stars],
        [star["y"] for star in stars],
        s=[(star_radius(star["mag"]) * 2.4) ** 2 for star in stars],
        c=STAR_COLOR,
        alpha=[star_opacity(star["mag"]) for star in stars],
        linewidths=0,
        zorder=2,
    )

    for row in asterisms:
        ras = row["ra"]
        decs = row["dec"]
        for idx in range(0, len(ras), 2):
            for run in segment_paths(ras[idx], decs[idx], ras[idx + 1], decs[idx + 1]):
                ax.plot(
                    [p.x for p in run],
                    [p.y for p in run],
                    color=LINE_COLOR,
                    lw=1.4,
                    alpha=0.96,
                    solid_capstyle="round",
                    solid_joinstyle="round",
                    zorder=4,
                )

        vertices = [project(ra, dec) for ra, dec in zip(ras, decs)]
        vertices = [point for point in vertices if point is not None]
        if vertices:
            ax.scatter(
                [point.x for point in vertices],
                [point.y for point in vertices],
                s=20,
                c=LINE_COLOR,
                alpha=0.98,
                linewidths=0,
                zorder=5,
            )

    if polaris_row is not None:
        polaris = project(polaris_row["ra"], polaris_row["dec"])
        if polaris is not None:
            ax.scatter([polaris.x], [polaris.y], s=82, c=POLARIS_COLOR, linewidths=0, zorder=6)
            ring = plt.Circle((polaris.x, polaris.y), 14.0, fill=False, color=POLARIS_COLOR, alpha=0.45, lw=1.0)
            ax.add_patch(ring)

    if labeled:
        for row in asterisms:
            if row["name"] not in LABEL_NAMES:
                continue
            anchor = label_anchor(row["ra"], row["dec"])
            if anchor is None or anchor.angular_distance_deg > 82:
                continue
            ax.text(
                anchor.x,
                anchor.y - 12,
                row["name"],
                color=LABEL_COLOR,
                fontsize=9.5,
                ha="center",
                va="center",
                family="DejaVu Serif",
                bbox={"facecolor": BG_COLOR, "edgecolor": "none", "pad": 1.2, "alpha": 0.82},
                zorder=7,
            )
        ax.text(
            CENTER + 20,
            CENTER - 16,
            "Polaris",
            color=LABEL_COLOR,
            fontsize=10,
            ha="left",
            va="center",
            family="DejaVu Serif",
            bbox={"facecolor": BG_COLOR, "edgecolor": "none", "pad": 1.2, "alpha": 0.82},
            zorder=7,
        )

    ax.set_xticks([])
    ax.set_yticks([])
    ax.set_aspect("equal", adjustable="box")
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
    stars, polaris_row = load_stars(hyg_path)

    unlabeled_svg = build_svg(asterisms, stars, polaris_row, labeled=False)
    labeled_svg = build_svg(asterisms, stars, polaris_row, labeled=True)

    (OUT_DIR / "polaris_dome_constellations.svg").write_text(unlabeled_svg, encoding="utf-8")
    (OUT_DIR / "polaris_dome_constellations_labeled.svg").write_text(labeled_svg, encoding="utf-8")
    write_png(
        asterisms,
        stars,
        polaris_row,
        OUT_DIR / "polaris_dome_constellations.png",
        labeled=False,
    )
    write_png(
        asterisms,
        stars,
        polaris_row,
        OUT_DIR / "polaris_dome_constellations_labeled.png",
        labeled=True,
    )

    notes = (
        "North-sky dome chart centered on Polaris.\n"
        "Projection: azimuthal equidistant\n"
        "Hemisphere radius: 90 degrees from Polaris\n"
        f"Polaris center: RA {POLARIS_RA_HOURS:.5f} h, Dec {POLARIS_DEC_DEG:.6f} deg\n"
        f"Labeled reference constellations: {', '.join(sorted(LABEL_NAMES))}\n"
    )
    (OUT_DIR / "render_notes.txt").write_text(notes, encoding="utf-8")

    print(f"Wrote {(OUT_DIR / 'polaris_dome_constellations.svg')}")
    print(f"Wrote {(OUT_DIR / 'polaris_dome_constellations_labeled.svg')}")
    print(f"Wrote {(OUT_DIR / 'polaris_dome_constellations.png')}")
    print(f"Wrote {(OUT_DIR / 'polaris_dome_constellations_labeled.png')}")
    print(f"Wrote {(OUT_DIR / 'render_notes.txt')}")


if __name__ == "__main__":
    main()
