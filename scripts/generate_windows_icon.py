from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "src-tauri" / "icons"
INPUT_PATH = ICON_DIR / "icon-input.png"
SOURCE_PATH = ICON_DIR / "icon-source.png"
APP_ICON_PATH = ICON_DIR / "app-icon.png"
PNG_256_PATH = ICON_DIR / "icon-256.png"
PREVIEW_PATH = ICON_DIR / "icon-preview-sheet.png"


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    names = ["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]
    for name in names:
        path = Path("C:/Windows/Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def is_checker_pixel(pixel: tuple[int, int, int]) -> bool:
    red, green, blue = pixel
    average = (red + green + blue) / 3
    neutral = max(red, green, blue) - min(red, green, blue) <= 12
    return neutral and average >= 238


def fill_holes(mask: Image.Image) -> Image.Image:
    width, height = mask.size
    pixels = mask.load()
    seen = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        index = y * width + x
        if seen[index] or pixels[x, y] > 0:
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


def remove_checker_background(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    width, height = rgb.size
    source_pixels = rgb.load()
    mask = Image.new("L", (width, height), 255)
    mask_pixels = mask.load()

    for y in range(height):
        for x in range(width):
            if is_checker_pixel(source_pixels[x, y]):
                mask_pixels[x, y] = 0

    # The artwork contains white camera surfaces that are close to the
    # checkerboard color. Close the silhouette first, then fill enclosed holes.
    silhouette = mask.filter(ImageFilter.MaxFilter(23)).filter(ImageFilter.MinFilter(23))
    alpha = fill_holes(silhouette)
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.2)).point(lambda value: 0 if value < 10 else value)

    rgba = rgb.convert("RGBA")
    rgba.putalpha(alpha)
    pixels = rgba.load()
    alpha_pixels = alpha.load()
    for y in range(height):
        for x in range(width):
            if alpha_pixels[x, y] > 0 and is_checker_pixel(source_pixels[x, y]):
                pixels[x, y] = (248, 252, 255, alpha_pixels[x, y])

    bbox = alpha.getbbox()
    if not bbox:
        raise RuntimeError("Icon input appears empty after background removal.")

    left, top, right, bottom = bbox
    padding = round(max(right - left, bottom - top) * 0.035)
    crop = rgba.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(width, right + padding),
            min(height, bottom + padding),
        ),
    )
    return crop


def compose_square_icon(artwork: Image.Image, size: int = 1024) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    target = round(size * 0.9)
    fitted = ImageOps.contain(artwork, (target, target), method=Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.alpha_composite(fitted, (x, y))
    return canvas


def write_preview_sheet(source: Image.Image) -> None:
    sizes = [256, 128, 64, 48, 32, 24, 16]
    sheet = Image.new("RGBA", (760, 330), (235, 241, 247, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((18, 18), "Transparent source icon", fill=(13, 32, 58, 255), font=font(18, True))

    x = 18
    for icon_size in sizes:
        icon = source.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        if icon_size <= 64:
            icon = icon.filter(ImageFilter.UnsharpMask(radius=0.55, percent=130, threshold=2))
        y = 52 + (256 - icon_size) // 2
        sheet.alpha_composite(icon, (x, y))
        draw.text((x, 294), f"{icon_size}px", fill=(76, 88, 102, 255), font=font(12))
        x += icon_size + 24
    sheet.save(PREVIEW_PATH)


def main() -> None:
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Missing input icon: {INPUT_PATH}")

    ICON_DIR.mkdir(parents=True, exist_ok=True)
    artwork = remove_checker_background(Image.open(INPUT_PATH))
    source = compose_square_icon(artwork)
    source.save(SOURCE_PATH)
    source.save(APP_ICON_PATH)
    source.resize((256, 256), Image.Resampling.LANCZOS).save(PNG_256_PATH)
    write_preview_sheet(source)


if __name__ == "__main__":
    main()
