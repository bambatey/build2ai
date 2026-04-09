"""Generate the StructAI Agent .ico from a vector-style script.

The web app uses three horizontal lines as its logo motif. We render the
same motif on a rounded square accent-green tile so the desktop agent and
the web app are visually paired.

Run once: ``python scripts/generate_icon.py``
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "structai_agent" / "assets" / "icon.ico"

# Tile background gradient stops (top -> bottom)
TOP = (12, 16, 14)
BOTTOM = (8, 12, 10)
ACCENT = (16, 185, 129)  # accent-green
ACCENT_DIM = (5, 150, 105)


def render(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background: rounded square with vertical gradient
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    radius = int(size * 0.22)
    bg_draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=TOP)
    # Cheap gradient: overlay a translucent darker strip on bottom half
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for y in range(size):
        t = y / (size - 1)
        r = int(TOP[0] * (1 - t) + BOTTOM[0] * t)
        g = int(TOP[1] * (1 - t) + BOTTOM[1] * t)
        b = int(TOP[2] * (1 - t) + BOTTOM[2] * t)
        od.line([(0, y), (size, y)], fill=(r, g, b, 255))
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    img.paste(overlay, (0, 0), mask=mask)

    # Subtle inner border (1px) for crispness on dark backgrounds
    border = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)
    bd.rounded_rectangle(
        (0, 0, size - 1, size - 1),
        radius=radius,
        outline=(255, 255, 255, 24),
        width=max(1, size // 64),
    )
    img.alpha_composite(border)

    # Three horizontal lines (the StructAI logo motif)
    # Geometry mirrors `M4 6h16 M4 12h16 M4 18h16` from a 24-unit canvas.
    pad_x = int(size * 0.22)
    line_w = max(2, int(size * 0.085))
    line_len = size - pad_x * 2
    centers = [int(size * 0.32), int(size * 0.50), int(size * 0.68)]
    for i, cy in enumerate(centers):
        # Slight gradient: middle bar uses dimmer accent so it reads as a stack.
        color = ACCENT if i != 1 else ACCENT_DIM
        x0 = pad_x
        x1 = pad_x + line_len
        y0 = cy - line_w // 2
        y1 = cy + line_w // 2
        draw.rounded_rectangle(
            (x0, y0, x1, y1),
            radius=line_w // 2,
            fill=(*color, 255),
        )

    return img


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sizes = [16, 24, 32, 48, 64, 128, 256]
    images = [render(s) for s in sizes]
    # Save the largest as ico with all sub-sizes embedded; Pillow handles this.
    images[-1].save(
        OUT,
        format="ICO",
        sizes=[(s, s) for s in sizes],
    )
    # Also drop a PNG next to it for the UI tray icon (Pillow Image directly).
    png_path = OUT.with_suffix(".png")
    images[-1].save(png_path, format="PNG")
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")
    print(f"Wrote {png_path} ({png_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
