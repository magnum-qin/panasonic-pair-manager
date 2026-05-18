from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "src-tauri" / "icons"
SOURCE_PATH = ICON_DIR / "icon-source.png"
APP_ICON_PATH = ICON_DIR / "app-icon.png"
PNG_256_PATH = ICON_DIR / "icon-256.png"
PREVIEW_PATH = ICON_DIR / "icon-preview-sheet.png"

BLUE = (0, 84, 166)
DEEP_BLUE = (0, 45, 124)
CYAN = (22, 196, 226)
LIGHT = (102, 214, 244)


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    names = ["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]
    for name in names:
        path = Path("C:/Windows/Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def gradient(size: tuple[int, int], start: tuple[int, int, int], end: tuple[int, int, int]) -> Image.Image:
    width, height = size
    image = Image.new("RGBA", size)
    px = image.load()
    for y in range(height):
        y_t = y / max(1, height - 1)
        for x in range(width):
            x_t = x / max(1, width - 1)
            t = x_t * 0.55 + y_t * 0.45
            glow = max(0, 1 - ((x_t - 0.18) ** 2 + (y_t - 0.08) ** 2) * 5)
            px[x, y] = (
                min(255, lerp(start[0], end[0], t) + round(24 * glow)),
                min(255, lerp(start[1], end[1], t) + round(30 * glow)),
                min(255, lerp(start[2], end[2], t) + round(34 * glow)),
                255,
            )
    return image


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def paste_round(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    fill: Image.Image | tuple[int, int, int, int],
) -> None:
    size = (box[2] - box[0], box[3] - box[1])
    layer = fill if isinstance(fill, Image.Image) else Image.new("RGBA", size, fill)
    layer.putalpha(rounded_mask(size, radius))
    canvas.alpha_composite(layer, (box[0], box[1]))


def draw_shadow(canvas: Image.Image, box: tuple[int, int, int, int], radius: int, alpha: int) -> None:
    size = (box[2] - box[0], box[3] - box[1])
    shadow = Image.new("RGBA", size, (0, 22, 58, 0))
    shadow.putalpha(rounded_mask(size, radius).filter(ImageFilter.GaussianBlur(28)).point(lambda p: p * alpha // 255))
    canvas.alpha_composite(shadow, (box[0], box[1] + 36))


def line_with_round_caps(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[int, int]],
    width: int,
    fill: tuple[int, int, int, int],
) -> None:
    draw.line(points, fill=fill, width=width, joint="curve")
    radius = width // 2
    for x, y in (points[0], points[-1]):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def draw_source_icon(size: int = 1024) -> Image.Image:
    scale = size / 1024

    def n(value: int) -> int:
        return round(value * scale)

    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image, "RGBA")

    # One clear launch mark: a soft rounded tile plus two interlocking strokes.
    # This keeps the metaphor to "pairing" while staying readable at taskbar size.
    tile = (n(100), n(100), n(924), n(924))
    radius = n(220)
    draw_shadow(image, tile, radius, 62)
    paste_round(image, tile, radius, gradient((tile[2] - tile[0], tile[3] - tile[1]), (245, 253, 255), (218, 237, 250)))
    draw.rounded_rectangle(tile, radius=radius, outline=(255, 255, 255, 170), width=n(8))

    stroke = n(132)
    left = [(n(270), n(606)), (n(362), n(490)), (n(510), n(490)), (n(604), n(606))]
    right = [(n(420), n(606)), (n(514), n(734)), (n(664), n(734)), (n(756), n(606))]

    line_with_round_caps(draw, left, stroke, (*CYAN, 255))
    line_with_round_caps(draw, right, stroke, (*BLUE, 255))

    # Cut a deliberate negative-space bridge through the overlap so the mark
    # reads as two paired items instead of a knot.
    draw.rounded_rectangle((n(430), n(552), n(594), n(660)), radius=n(54), fill=(241, 250, 255, 255))
    draw.rounded_rectangle((n(456), n(580), n(568), n(632)), radius=n(26), fill=(*DEEP_BLUE, 255))

    # Tiny inner highlight gives the same soft dimensionality as modern Windows
    # product icons without adding another semantic element.
    draw.arc((n(214), n(188), n(810), n(790)), 204, 302, fill=(255, 255, 255, 88), width=n(18))

    # A single abstract marker suggests "image set" without becoming a second
    # illustrated object.
    draw.circle((n(316), n(352)), n(34), fill=(*LIGHT, 255))
    return image


def write_preview_sheet(source: Image.Image) -> None:
    sizes = [256, 128, 64, 48, 32, 24, 16]
    sheet = Image.new("RGBA", (760, 330), (235, 241, 247, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((18, 18), "Simplified Fluent-style icon", fill=(13, 32, 58, 255), font=font(18, True))

    x = 18
    for icon_size in sizes:
        icon = source.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        if icon_size <= 64:
            icon = icon.filter(ImageFilter.UnsharpMask(radius=0.55, percent=135, threshold=2))
        y = 52 + (256 - icon_size) // 2
        sheet.alpha_composite(icon, (x, y))
        draw.text((x, 294), f"{icon_size}px", fill=(76, 88, 102, 255), font=font(12))
        x += icon_size + 24
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_PATH)


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    source = draw_source_icon()
    source.save(SOURCE_PATH)
    source.save(APP_ICON_PATH)
    source.resize((256, 256), Image.Resampling.LANCZOS).save(PNG_256_PATH)
    write_preview_sheet(source)


if __name__ == "__main__":
    main()
