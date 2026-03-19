#!/usr/bin/env python3
"""Render a flat-earth-style interior dome constellation chart.

This is an intentionally illustrative sky map. It uses real star positions and
Western asterism connectivity, but remaps declination into a custom single-dome
layout rather than a standard astronomical projection.
"""

from __future__ import annotations

import ast
import csv
import math
import urllib.request
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "imagegen" / "flat-earth-dome"
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

CANVAS = 1800
CENTER = CANVAS / 2
OUTER_RADIUS = 810

POLARIS_RA_HOURS = 2.52975
POLARIS_DEC_DEG = 89.264109
POLARIS_MATCH_TOLERANCE = 0.02
OUTER_EASING_START = 0.70
OUTER_EASING_SPAN = 0.30
OUTER_EASING_AMOUNT = 0.06
SURFACE_PROJECTED_CONSTELLATIONS = {"Octans"}

BG_COLOR = "#07111f"
GRID_COLOR = "#90a5c4"
STAR_COLOR = "#dce8ff"
LINE_COLOR = "#ffffff"
LABEL_COLOR = "#f4f7ff"
POLARIS_COLOR = "#fff1c2"
DOME_FILL = "#0b1730"

FORCED_LABELS = {
    "Crux",
    "Carina",
    "Vela",
    "Puppis",
    "Musca",
    "Chamaeleon",
    "Apus",
    "Pavo",
    "Tucana",
    "Octans",
    "Centaurus",
    "Ursa Minor",
    "Cassiopeia",
    "Orion",
    "Scorpius",
}

OPTIONAL_LABELS = {
    "Ursa Major",
    "Draco",
    "Cepheus",
    "Camelopardalis",
    "Andromeda",
    "Perseus",
    "Auriga",
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
    "Sagittarius",
    "Aquarius",
    "Capricornus",
    "Pisces",
    "Virgo",
    "Leo",
    "Cancer",
    "Libra",
    "Ophiuchus",
}


@dataclass(frozen=True)
class DomePoint:
    x: float
    y: float
    radius_norm: float
    theta_rad: float


@dataclass(frozen=True)
class LabelPlacement:
    name: str
    x: float
    y: float
    text_anchor: str
    font_size: int


@dataclass(frozen=True)
class LabelCandidate:
    name: str
    x: float
    y: float
    radius_norm: float
    priority: int


def ensure_file(url: str, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        urllib.request.urlretrieve(url, path)
    return path


def is_polaris(ra_hours: float, dec_deg: float) -> bool:
    return (
        abs(ra_hours - POLARIS_RA_HOURS) <= POLARIS_MATCH_TOLERANCE
        and abs(dec_deg - POLARIS_DEC_DEG) <= POLARIS_MATCH_TOLERANCE
    )


def warp_radius(dec_deg: float) -> float:
    if dec_deg >= 0.0:
        radius = 0.62 * ((90.0 - dec_deg) / 90.0) ** 0.75
    else:
        radius = 0.62 + 0.38 * (abs(dec_deg) / 90.0) ** 0.9
    if radius > OUTER_EASING_START:
        t = (radius - OUTER_EASING_START) / OUTER_EASING_SPAN
        s = t * t * (3.0 - (2.0 * t))
        radius -= OUTER_EASING_AMOUNT * s
    return max(0.0, min(1.0, radius))


def project(ra_hours: float, dec_deg: float) -> DomePoint:
    theta = 2.0 * math.pi * (ra_hours / 24.0)
    radius_norm = 0.0 if is_polaris(ra_hours, dec_deg) else warp_radius(dec_deg)
    x = CENTER + OUTER_RADIUS * radius_norm * math.sin(theta)
    y = CENTER - OUTER_RADIUS * radius_norm * math.cos(theta)
    return DomePoint(x=x, y=y, radius_norm=radius_norm, theta_rad=theta)


def sample_projected_footprint(
    start_point: DomePoint,
    end_point: DomePoint,
) -> list[tuple[float, float]]:
    footprint_length = math.hypot(end_point.x - start_point.x, end_point.y - start_point.y)
    sample_count = max(6, math.ceil(footprint_length / max(OUTER_RADIUS * 0.08, 1e-6)))
    points: list[tuple[float, float]] = []

    for index in range(sample_count + 1):
        if index == 0:
            points.append((start_point.x, start_point.y))
            continue
        if index == sample_count:
            points.append((end_point.x, end_point.y))
            continue
        t = index / sample_count
        x = start_point.x + ((end_point.x - start_point.x) * t)
        y = start_point.y + ((end_point.y - start_point.y) * t)
        points.append((x, y))

    return points


def star_radius(mag: float) -> float:
    base = max(0.55, 3.6 - 0.42 * max(mag, -1.0))
    return min(base, 5.2)


def star_opacity(mag: float) -> float:
    return max(0.18, min(0.96, 0.92 - 0.085 * max(mag, 0.0)))


def circle_svg(cx: float, cy: float, r: float, stroke: str, opacity: float, width: float, dash: str | None = None) -> str:
    dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
    return (
        f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="none" '
        f'stroke="{stroke}" stroke-width="{width}" opacity="{opacity:.3f}"{dash_attr} />'
    )


def label_box(name: str, x: float, y: float, font_size: int, anchor: str) -> tuple[float, float, float, float]:
    width = max(font_size * 2.2, font_size * (0.56 * len(name) + 0.8))
    height = font_size * 1.15
    if anchor == "start":
        left = x
        right = x + width
    elif anchor == "end":
        left = x - width
        right = x
    else:
        left = x - width / 2.0
        right = x + width / 2.0
    top = y - height * 0.78
    bottom = y + height * 0.37
    return (left, top, right, bottom)


def boxes_overlap(a: tuple[float, float, float, float], b: tuple[float, float, float, float], padding: float = 10.0) -> bool:
    return not (
        a[2] + padding < b[0]
        or b[2] + padding < a[0]
        or a[3] + padding < b[1]
        or b[3] + padding < a[1]
    )


def box_inside_dome(box: tuple[float, float, float, float], margin: float = 8.0) -> bool:
    left, top, right, bottom = box
    corners = [
        (left, top),
        (right, top),
        (left, bottom),
        (right, bottom),
    ]
    radius = OUTER_RADIUS - margin
    for x, y in corners:
        if math.hypot(x - CENTER, y - CENTER) > radius:
            return False
    return True


def candidate_positions(anchor: LabelCandidate, font_size: int) -> list[tuple[float, float, str]]:
    if anchor.radius_norm < 0.08:
        return [
            (anchor.x + 22.0, anchor.y - 18.0, "start"),
            (anchor.x + 24.0, anchor.y + 4.0, "start"),
            (anchor.x - 22.0, anchor.y - 18.0, "end"),
        ]

    radial_dx = anchor.x - CENTER
    radial_dy = anchor.y - CENTER
    norm = math.hypot(radial_dx, radial_dy)
    if norm < 1e-6:
        ux, uy = (0.0, -1.0)
    else:
        ux, uy = (radial_dx / norm, radial_dy / norm)
    tx, ty = (-uy, ux)
    radial_offset = 18.0 + font_size * 0.12
    tangent_offset = 12.0 + font_size * 0.10
    anchor_side = "start" if ux >= 0 else "end"

    return [
        (anchor.x + ux * radial_offset, anchor.y + uy * radial_offset, anchor_side),
        (anchor.x + ux * radial_offset + tx * tangent_offset, anchor.y + uy * radial_offset + ty * tangent_offset, anchor_side),
        (anchor.x + ux * radial_offset - tx * tangent_offset, anchor.y + uy * radial_offset - ty * tangent_offset, anchor_side),
        (anchor.x + tx * (tangent_offset + 8.0), anchor.y + ty * (tangent_offset + 8.0), "middle"),
        (anchor.x - tx * (tangent_offset + 8.0), anchor.y - ty * (tangent_offset + 8.0), "middle"),
        (anchor.x - ux * (radial_offset * 0.75), anchor.y - uy * (radial_offset * 0.75), "middle"),
    ]


def choose_label_layout(candidates: list[LabelCandidate]) -> list[LabelPlacement]:
    placements: list[LabelPlacement] = []
    boxes: list[tuple[float, float, float, float]] = []

    candidates = sorted(
        candidates,
        key=lambda item: (
            item.priority,
            -item.radius_norm if item.priority == 0 else item.radius_norm,
            item.name,
        ),
    )

    for candidate in candidates:
        font_size = 25 if candidate.priority == 0 else 21
        placed: LabelPlacement | None = None
        candidate_box: tuple[float, float, float, float] | None = None
        for x, y, anchor in candidate_positions(candidate, font_size):
            box = label_box(candidate.name, x, y, font_size, anchor)
            if not box_inside_dome(box):
                continue
            if candidate.priority > 0 and any(boxes_overlap(box, other) for other in boxes):
                continue
            if candidate.priority == 0:
                if any(boxes_overlap(box, other) for other in boxes):
                    continue
            placed = LabelPlacement(candidate.name, x, y, anchor, font_size)
            candidate_box = box
            break

        if placed is None and candidate.priority == 0:
            x, y, anchor = candidate_positions(candidate, font_size)[0]
            candidate_box = label_box(candidate.name, x, y, font_size, anchor)
            placed = LabelPlacement(candidate.name, x, y, anchor, font_size)

        if placed is not None and candidate_box is not None:
            placements.append(placed)
            boxes.append(candidate_box)

    return placements


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
    return sorted(rows, key=lambda row: str(row["name"]))


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

            if row.get("proper") == "Polaris":
                polaris_row = {"ra": ra, "dec": dec, "mag": mag}

            if mag > 5.8:
                continue

            point = project(ra, dec)
            stars.append(
                {
                    "x": point.x,
                    "y": point.y,
                    "mag": mag,
                }
            )
    return stars, polaris_row


def label_anchor(ras: list[float], decs: list[float]) -> LabelCandidate:
    points = [project(ra, dec) for ra, dec in zip(ras, decs)]
    return LabelCandidate(
        name="",
        x=sum(point.x for point in points) / len(points),
        y=sum(point.y for point in points) / len(points),
        radius_norm=sum(point.radius_norm for point in points) / len(points),
        priority=1,
    )


def build_label_placements(asterisms: list[dict[str, object]]) -> list[LabelPlacement]:
    candidates: list[LabelCandidate] = []
    for row in asterisms:
        name = str(row["name"])
        if name not in FORCED_LABELS and name not in OPTIONAL_LABELS:
            continue
        anchor = label_anchor(row["ra"], row["dec"])
        priority = 0 if name in FORCED_LABELS else 1
        candidates.append(
            LabelCandidate(
                name=name,
                x=anchor.x,
                y=anchor.y,
                radius_norm=anchor.radius_norm,
                priority=priority,
            )
        )
    placements = choose_label_layout(candidates)
    placements.append(LabelPlacement("Polaris", CENTER + 22.0, CENTER - 18.0, "start", 25))
    return placements


def build_svg(
    asterisms: list[dict[str, object]],
    stars: list[dict[str, object]],
    polaris_row: dict[str, float] | None,
    *,
    labeled: bool,
) -> str:
    label_placements = build_label_placements(asterisms) if labeled else []
    parts: list[str] = []
    parts.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" '
        f'viewBox="0 0 {CANVAS} {CANVAS}">'
    )
    parts.append("<defs>")
    parts.append(
        f'<clipPath id="dome-clip"><circle cx="{CENTER}" cy="{CENTER}" r="{OUTER_RADIUS}" /></clipPath>'
    )
    parts.append("</defs>")
    parts.append(f'<rect width="{CANVAS}" height="{CANVAS}" fill="{BG_COLOR}" />')
    parts.append(
        f'<circle cx="{CENTER}" cy="{CENTER}" r="{OUTER_RADIUS}" fill="{DOME_FILL}" opacity="0.42" />'
    )

    for dec in (60, 30, 0, -30, -60, -90):
        radius = OUTER_RADIUS * warp_radius(float(dec))
        opacity = 0.20 if dec in (0, -60, -90) else 0.11
        dash = None if dec == -90 else "8 8"
        parts.append(circle_svg(CENTER, CENTER, radius, GRID_COLOR, opacity, 1.1, dash))

    for hour in range(0, 24, 2):
        outer = project(float(hour), -90.0)
        opacity = 0.18 if hour % 6 == 0 else 0.10
        parts.append(
            f'<line x1="{CENTER:.2f}" y1="{CENTER:.2f}" x2="{outer.x:.2f}" y2="{outer.y:.2f}" '
            f'stroke="{GRID_COLOR}" stroke-width="1" opacity="{opacity:.3f}" />'
        )

    parts.append('<g clip-path="url(#dome-clip)">')
    for star in stars:
        parts.append(
            f'<circle cx="{star["x"]:.2f}" cy="{star["y"]:.2f}" r="{star_radius(star["mag"]):.2f}" '
            f'fill="{STAR_COLOR}" opacity="{star_opacity(star["mag"]):.3f}" />'
        )

    for row in asterisms:
        ras = row["ra"]
        decs = row["dec"]
        for idx in range(0, len(ras), 2):
            if str(row["name"]) in SURFACE_PROJECTED_CONSTELLATIONS:
                start_point = project(ras[idx], decs[idx])
                end_point = project(ras[idx + 1], decs[idx + 1])
                sampled_points = sample_projected_footprint(start_point, end_point)
                path_data = " ".join(
                    f"{'M' if point_index == 0 else 'L'} {point[0]:.2f} {point[1]:.2f}"
                    for point_index, point in enumerate(sampled_points)
                )
                parts.append(
                    f'<path d="{path_data}" stroke="{LINE_COLOR}" stroke-width="2.15" '
                    f'stroke-linecap="round" stroke-linejoin="round" opacity="0.96" fill="none" />'
                )
            else:
                a = project(ras[idx], decs[idx])
                b = project(ras[idx + 1], decs[idx + 1])
                parts.append(
                    f'<line x1="{a.x:.2f}" y1="{a.y:.2f}" x2="{b.x:.2f}" y2="{b.y:.2f}" '
                    f'stroke="{LINE_COLOR}" stroke-width="2.15" stroke-linecap="round" '
                    f'stroke-linejoin="round" opacity="0.96" />'
                )

        for ra, dec in zip(ras, decs):
            point = project(ra, dec)
            parts.append(
                f'<circle cx="{point.x:.2f}" cy="{point.y:.2f}" r="3.15" fill="{LINE_COLOR}" opacity="0.98" />'
            )

    if polaris_row is not None:
        polaris = project(polaris_row["ra"], polaris_row["dec"])
        parts.append(
            f'<circle cx="{polaris.x:.2f}" cy="{polaris.y:.2f}" r="7.6" fill="{POLARIS_COLOR}" opacity="1" />'
        )
        parts.append(
            f'<circle cx="{polaris.x:.2f}" cy="{polaris.y:.2f}" r="14.0" fill="none" '
            f'stroke="{POLARIS_COLOR}" stroke-width="1.4" opacity="0.45" />'
        )
    parts.append("</g>")

    if labeled:
        parts.append(
            '<g font-family="Georgia, Times New Roman, serif" '
            f'fill="{LABEL_COLOR}" letter-spacing="0.35">'
        )
        for label in label_placements:
            parts.append(
                f'<text x="{label.x:.2f}" y="{label.y:.2f}" text-anchor="{label.text_anchor}" '
                f'font-size="{label.font_size}" paint-order="stroke" stroke="{BG_COLOR}" '
                f'stroke-width="6" stroke-linejoin="round">{label.name}</text>'
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

    label_placements = build_label_placements(asterisms) if labeled else []

    fig, ax = plt.subplots(figsize=(10, 10), dpi=220, facecolor=BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    ax.set_xlim(0, CANVAS)
    ax.set_ylim(CANVAS, 0)

    dome_fill = plt.Circle((CENTER, CENTER), OUTER_RADIUS, color=DOME_FILL, alpha=0.42, zorder=0)
    dome_clip = plt.Circle((CENTER, CENTER), OUTER_RADIUS, transform=ax.transData)
    ax.add_patch(dome_fill)

    for dec in (60, 30, 0, -30, -60, -90):
        radius = OUTER_RADIUS * warp_radius(float(dec))
        alpha = 0.20 if dec in (0, -60, -90) else 0.11
        circle = plt.Circle(
            (CENTER, CENTER),
            radius,
            fill=False,
            color=GRID_COLOR,
            alpha=alpha,
            lw=0.8,
            linestyle="-" if dec == -90 else (0, (6, 6)),
        )
        ax.add_patch(circle)

    for hour in range(0, 24, 2):
        outer = project(float(hour), -90.0)
        alpha = 0.18 if hour % 6 == 0 else 0.10
        ax.plot([CENTER, outer.x], [CENTER, outer.y], color=GRID_COLOR, lw=0.6, alpha=alpha, zorder=1)

    star_scatter = ax.scatter(
        [star["x"] for star in stars],
        [star["y"] for star in stars],
        s=[(star_radius(star["mag"]) * 2.4) ** 2 for star in stars],
        c=STAR_COLOR,
        alpha=[star_opacity(star["mag"]) for star in stars],
        linewidths=0,
        zorder=2,
    )
    star_scatter.set_clip_path(dome_clip)

    for row in asterisms:
        ras = row["ra"]
        decs = row["dec"]
        for idx in range(0, len(ras), 2):
            if str(row["name"]) in SURFACE_PROJECTED_CONSTELLATIONS:
                start_point = project(ras[idx], decs[idx])
                end_point = project(ras[idx + 1], decs[idx + 1])
                sampled_points = sample_projected_footprint(start_point, end_point)
                (line,) = ax.plot(
                    [point[0] for point in sampled_points],
                    [point[1] for point in sampled_points],
                    color=LINE_COLOR,
                    lw=1.35,
                    alpha=0.96,
                    solid_capstyle="round",
                    solid_joinstyle="round",
                    zorder=4,
                )
            else:
                a = project(ras[idx], decs[idx])
                b = project(ras[idx + 1], decs[idx + 1])
                (line,) = ax.plot(
                    [a.x, b.x],
                    [a.y, b.y],
                    color=LINE_COLOR,
                    lw=1.35,
                    alpha=0.96,
                    solid_capstyle="round",
                    solid_joinstyle="round",
                    zorder=4,
                )
            line.set_clip_path(dome_clip)

        vertices = [project(ra, dec) for ra, dec in zip(ras, decs)]
        vertex_scatter = ax.scatter(
            [point.x for point in vertices],
            [point.y for point in vertices],
            s=18,
            c=LINE_COLOR,
            alpha=0.98,
            linewidths=0,
            zorder=5,
        )
        vertex_scatter.set_clip_path(dome_clip)

    if polaris_row is not None:
        polaris = project(polaris_row["ra"], polaris_row["dec"])
        ax.scatter([polaris.x], [polaris.y], s=86, c=POLARIS_COLOR, linewidths=0, zorder=6)
        ring = plt.Circle((polaris.x, polaris.y), 14.0, fill=False, color=POLARIS_COLOR, alpha=0.45, lw=1.0)
        ax.add_patch(ring)

    if labeled:
        for label in label_placements:
            ax.text(
                label.x,
                label.y,
                label.name,
                color=LABEL_COLOR,
                fontsize=label.font_size * 0.42,
                ha={
                    "start": "left",
                    "end": "right",
                    "middle": "center",
                }[label.text_anchor],
                va="center",
                family="DejaVu Serif",
                bbox={"facecolor": BG_COLOR, "edgecolor": "none", "pad": 1.0, "alpha": 0.84},
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

    unlabeled_svg = build_svg(
        asterisms,
        stars,
        polaris_row,
        labeled=False,
    )
    labeled_svg = build_svg(
        asterisms,
        stars,
        polaris_row,
        labeled=True,
    )

    (OUT_DIR / "flat_earth_dome_constellations.svg").write_text(unlabeled_svg, encoding="utf-8")
    (OUT_DIR / "flat_earth_dome_constellations_labeled.svg").write_text(labeled_svg, encoding="utf-8")
    write_png(
        asterisms,
        stars,
        polaris_row,
        OUT_DIR / "flat_earth_dome_constellations.png",
        labeled=False,
    )
    write_png(
        asterisms,
        stars,
        polaris_row,
        OUT_DIR / "flat_earth_dome_constellations_labeled.png",
        labeled=True,
    )

    notes = (
        "Flat-earth illustrative dome constellation chart.\n"
        "Source data: Stellarium western asterisms + HYG visible stars.\n"
        "Projection is intentionally non-standard.\n"
        "Angular position is derived from right ascension only.\n"
        "Radial warp:\n"
        "  dec >= 0  : r = 0.62 * ((90 - dec) / 90) ^ 0.75\n"
        "  dec < 0   : r = 0.62 + 0.38 * (abs(dec) / 90) ^ 0.9\n"
        "  if r > 0.70: t = (r - 0.70) / 0.30, s = t^2 * (3 - 2t), r = r - 0.06 * s\n"
        "Polaris is pinned to the exact chart center.\n"
        "Octans edges are dome-surface lifted while preserving their existing projected footprint.\n"
        "This output is a conceptual flat-earth dome interpretation, not a standard astronomical projection.\n"
    )
    (OUT_DIR / "render_notes.txt").write_text(notes, encoding="utf-8")

    print(f"Wrote {(OUT_DIR / 'flat_earth_dome_constellations.svg')}")
    print(f"Wrote {(OUT_DIR / 'flat_earth_dome_constellations_labeled.svg')}")
    print(f"Wrote {(OUT_DIR / 'flat_earth_dome_constellations.png')}")
    print(f"Wrote {(OUT_DIR / 'flat_earth_dome_constellations_labeled.png')}")
    print(f"Wrote {(OUT_DIR / 'render_notes.txt')}")


if __name__ == "__main__":
    main()
