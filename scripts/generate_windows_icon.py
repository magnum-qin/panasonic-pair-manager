from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "src-tauri" / "icons"
SOURCE_PATH = ICON_DIR / "icon-source.png"
ICO_PATH = ICON_DIR / "icon.ico"
PNG_PATH = ICON_DIR / "icon-256.png"
SHEET_PATH = ICON_DIR / "icon-preview-sheet.png"
SVG_PATH = ICON_DIR / "icon.svg"

ICON_SIZES = [16, 24, 32, 48, 64, 128, 256]


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    names = ["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]
    for name in names:
        path = Path("C:/Windows/Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def is_checker_background(pixel: tuple[int, int, int]) -> bool:
    red, green, blue = pixel
    average = (red + green + blue) / 3
    neutral = max(red, green, blue) - min(red, green, blue) <= 10
    return neutral and average >= 238


def fill_mask_holes(mask: Image.Image) -> Image.Image:
    width, height = mask.size
    mask_pixels = mask.load()
    seen = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        index = y * width + x
        if seen[index] or mask_pixels[x, y] > 0:
            return
        seen[index] = 1
        queue.append((x, y))

    for x in range(width):
        push(x, 0)
        push(x, height - 1)
    for y in range(height):
        push(0, y)
        push(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x > 0:
            push(x - 1, y)
        if x < width - 1:
            push(x + 1, y)
        if y > 0:
            push(x, y - 1)
        if y < height - 1:
            push(x, y + 1)

    filled = Image.new("L", (width, height), 255)
    filled_pixels = filled.load()
    for y in range(height):
        offset = y * width
        for x in range(width):
            if seen[offset + x]:
                filled_pixels[x, y] = 0
    return filled


def artwork_alpha_mask(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    mask = Image.new("L", (width, height), 255)
    mask_pixels = mask.load()
    for y in range(height):
        for x in range(width):
            if is_checker_background(pixels[x, y]):
                mask_pixels[x, y] = 0

    draw = ImageDraw.Draw(mask)

    def sx(value: int) -> int:
        return round(value * width / 1254)

    def sy(value: int) -> int:
        return round(value * height / 1254)

    # The source artwork is a generated raster with a baked checkerboard
    # background. Preserve the bright document surfaces explicitly; their color
    # is intentionally close to the checkerboard and cannot be separated by
    # thresholding alone.
    draw.rounded_rectangle(
        (sx(742), sy(354), sx(1026), sy(856)),
        radius=sx(45),
        fill=255,
    )
    draw.rounded_rectangle(
        (sx(236), sy(275), sx(876), sy(838)),
        radius=sx(42),
        fill=255,
    )
    draw.polygon(
        [
            (sx(742), sy(275)),
            (sx(876), sy(410)),
            (sx(876), sy(838)),
            (sx(236), sy(838)),
            (sx(236), sy(336)),
            (sx(276), sy(275)),
        ],
        fill=255,
    )

    # Close small checkerboard gaps around the white document, then fill the
    # enclosed interior so bright paper remains part of the icon.
    closed = mask.filter(ImageFilter.MaxFilter(17)).filter(ImageFilter.MinFilter(17))
    filled = fill_mask_holes(closed)
    return filled.filter(ImageFilter.GaussianBlur(1.1)).point(lambda value: 0 if value < 10 else value)


def extract_artwork(source: Image.Image) -> Image.Image:
    rgba = source.convert("RGBA")
    alpha = artwork_alpha_mask(source)
    rgba.putalpha(alpha)
    rgb_pixels = rgba.load()
    alpha_pixels = alpha.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            if alpha_pixels[x, y] > 0 and is_checker_background(rgb_pixels[x, y][:3]):
                rgb_pixels[x, y] = (248, 252, 255, alpha_pixels[x, y])

    bbox = alpha.getbbox()
    if not bbox:
        raise RuntimeError("Source icon appears to be empty after background removal.")

    left, top, right, bottom = bbox
    padding = round(max(right - left, bottom - top) * 0.06)
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(rgba.width, right + padding)
    bottom = min(rgba.height, bottom + padding)
    return rgba.crop((left, top, right, bottom))


def compose_icon(artwork: Image.Image, size: int) -> Image.Image:
    supersample = 4 if size <= 64 else 2 if size < 256 else 1
    canvas_size = size * supersample
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    inset_ratio = 0.08 if size >= 64 else 0.04
    target = round(canvas_size * (1 - inset_ratio * 2))
    fitted = ImageOps.contain(artwork, (target, target), method=Image.Resampling.LANCZOS)
    x = (canvas_size - fitted.width) // 2
    y = (canvas_size - fitted.height) // 2
    canvas.alpha_composite(fitted, (x, y))

    if supersample > 1:
        canvas = canvas.resize((size, size), Image.Resampling.LANCZOS)

    if size <= 32:
        canvas = canvas.filter(ImageFilter.UnsharpMask(radius=0.65, percent=190, threshold=2))
    elif size <= 64:
        canvas = canvas.filter(ImageFilter.UnsharpMask(radius=0.8, percent=145, threshold=2))
    else:
        canvas = canvas.filter(ImageFilter.UnsharpMask(radius=0.6, percent=90, threshold=3))
    return canvas


def write_preview_sheet(images: dict[int, Image.Image]) -> None:
    sizes = [256, 128, 64, 48, 32, 24, 16]
    width = 18 + sum(size + 24 for size in sizes)
    sheet = Image.new("RGBA", (width, 330), (235, 241, 247, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((18, 16), "Windows icon sizes", fill=(38, 50, 64, 255), font=font(18, True))

    x = 18
    baseline = 290
    for size in sizes:
        icon = images[size]
        y = 42 + (256 - size) // 2
        sheet.alpha_composite(icon, (x, y))
        draw.text((x, baseline), f"{size}px", fill=(76, 88, 102, 255), font=font(12))
        x += size + 22
    sheet.save(SHEET_PATH)


def write_svg() -> None:
    SVG_PATH.write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <image href="icon-256.png" width="256" height="256" preserveAspectRatio="xMidYMid meet"/>
</svg>
""",
        encoding="utf-8",
    )


def main() -> None:
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(f"Missing source artwork: {SOURCE_PATH}")

    ICON_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE_PATH)
    artwork = extract_artwork(source)
    images = {size: compose_icon(artwork, size) for size in ICON_SIZES}

    images[256].save(PNG_PATH)
    images[256].save(ICO_PATH, format="ICO", sizes=[(size, size) for size in ICON_SIZES])
    write_preview_sheet(images)
    write_svg()


if __name__ == "__main__":
    main()
