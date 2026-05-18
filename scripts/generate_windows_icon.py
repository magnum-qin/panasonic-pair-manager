from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "src-tauri" / "icons"
SOURCE_PATH = ICON_DIR / "icon-source.png"
APP_ICON_PATH = ICON_DIR / "app-icon.png"
PNG_256_PATH = ICON_DIR / "icon-256.png"
PREVIEW_PATH = ICON_DIR / "icon-preview-sheet.png"

PANASONIC_BLUE = (0, 84, 166)
DEEP_BLUE = (0, 42, 110)
SKY = (30, 198, 230)
INK = (11, 30, 58)


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    names = ["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]
    for name in names:
        path = Path("C:/Windows/Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def gradient_rect(
    size: tuple[int, int],
    top_left: tuple[int, int, int],
    bottom_right: tuple[int, int, int],
) -> Image.Image:
    width, height = size
    image = Image.new("RGBA", size)
    px = image.load()
    for y in range(height):
        y_t = y / max(1, height - 1)
        for x in range(width):
            x_t = x / max(1, width - 1)
            t = (x_t * 0.52) + (y_t * 0.48)
            glow = max(0, 1 - ((x_t - 0.2) ** 2 + (y_t - 0.08) ** 2) * 4)
            px[x, y] = (
                min(255, lerp(top_left[0], bottom_right[0], t) + round(22 * glow)),
                min(255, lerp(top_left[1], bottom_right[1], t) + round(26 * glow)),
                min(255, lerp(top_left[2], bottom_right[2], t) + round(28 * glow)),
                255,
            )
    return image


def paste_rounded(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    fill: Image.Image | tuple[int, int, int, int],
) -> None:
    width = box[2] - box[0]
    height = box[3] - box[1]
    mask = rounded_mask((width, height), radius)
    layer = fill if isinstance(fill, Image.Image) else Image.new("RGBA", (width, height), fill)
    layer.putalpha(mask)
    canvas.alpha_composite(layer, (box[0], box[1]))


def drop_shadow(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    offset: tuple[int, int],
    blur: int,
    alpha: int,
) -> None:
    width = box[2] - box[0]
    height = box[3] - box[1]
    mask = rounded_mask((width, height), radius)
    shadow = Image.new("RGBA", (width, height), (0, 25, 64, 0))
    shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(blur)).point(lambda value: value * alpha // 255))
    canvas.alpha_composite(shadow, (box[0] + offset[0], box[1] + offset[1]))


def draw_source_icon(size: int = 1024) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image, "RGBA")
    scale = size / 1024

    def n(value: int) -> int:
        return round(value * scale)

    plate = (n(72), n(72), n(952), n(952))
    radius = n(210)
    drop_shadow(image, plate, radius, (0, n(38)), n(42), 82)
    drop_shadow(image, plate, radius, (0, n(10)), n(12), 26)
    paste_rounded(
        image,
        plate,
        radius,
        gradient_rect((plate[2] - plate[0], plate[3] - plate[1]), (245, 253, 255), (208, 232, 246)),
    )
    draw.rounded_rectangle(plate, radius=radius, outline=(255, 255, 255, 178), width=n(8))

    # A restrained Fluent-style base accent anchors the icon on Windows taskbars.
    accent = (plate[0] + n(74), plate[3] - n(130), plate[2] - n(74), plate[3] - n(66))
    draw.rounded_rectangle(accent, radius=n(32), fill=(*PANASONIC_BLUE, 235))
    draw.rounded_rectangle(
        (accent[0], accent[1], accent[0] + n(270), accent[3]),
        radius=n(32),
        fill=(*SKY, 255),
    )

    # Two abstract photo/file planes: simple enough to stay legible at 24-32px.
    back = (n(364), n(248), n(708), n(666))
    front = (n(236), n(312), n(642), n(732))
    drop_shadow(image, back, n(58), (n(20), n(26)), n(24), 38)
    paste_rounded(image, back, n(58), (220, 236, 251, 245))
    draw.polygon(
        [(back[2] - n(104), back[1]), (back[2], back[1] + n(104)), (back[2] - n(104), back[1] + n(104))],
        fill=(180, 207, 237, 255),
    )

    drop_shadow(image, front, n(62), (0, n(24)), n(26), 56)
    paste_rounded(image, front, n(62), (250, 253, 255, 252))
    draw.rounded_rectangle(front, radius=n(62), outline=(255, 255, 255, 180), width=n(7))
    draw.circle((n(318), n(398)), n(46), fill=(0, 122, 229, 255))
    draw.polygon(
        [(n(268), n(642)), (n(400), n(494)), (n(512), n(642))],
        fill=(*SKY, 255),
    )
    draw.polygon(
        [(n(398), n(642)), (n(548), n(454)), (n(638), n(642))],
        fill=(*PANASONIC_BLUE, 255),
    )

    # Abstract pairing mark, deliberately thick for small sizes.
    link_color = (255, 255, 255, 246)
    outline = (*PANASONIC_BLUE, 255)
    draw.rounded_rectangle((n(254), n(678), n(492), n(812)), radius=n(67), fill=outline)
    draw.rounded_rectangle((n(532), n(678), n(770), n(812)), radius=n(67), fill=outline)
    draw.rounded_rectangle((n(302), n(724), n(444), n(766)), radius=n(21), fill=link_color)
    draw.rounded_rectangle((n(580), n(724), n(722), n(766)), radius=n(21), fill=link_color)
    draw.rounded_rectangle((n(420), n(724), n(604), n(766)), radius=n(21), fill=outline)
    draw.rounded_rectangle((n(450), n(734), n(574), n(756)), radius=n(11), fill=link_color)

    # A compact SD-card cue in the lower-right, more symbolic than literal.
    card = (n(642), n(560), n(830), n(808))
    drop_shadow(image, card, n(36), (n(10), n(18)), n(18), 64)
    paste_rounded(image, card, n(36), gradient_rect((card[2] - card[0], card[3] - card[1]), (0, 93, 180), DEEP_BLUE))
    draw.rounded_rectangle((n(692), n(604), n(800), n(636)), radius=n(9), fill=(228, 244, 255, 236))
    draw.rounded_rectangle((n(678), n(656), n(800), n(688)), radius=n(9), fill=(228, 244, 255, 224))
    draw.polygon([(n(736), n(728)), (n(772), n(768)), (n(700), n(768))], fill=(57, 171, 255, 255))

    return image


def write_preview_sheet(source: Image.Image) -> None:
    sizes = [256, 128, 64, 48, 32, 24, 16]
    sheet = Image.new("RGBA", (760, 330), (235, 241, 247, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((18, 18), "Abstract Windows icon source", fill=(*INK, 255), font=font(18, True))

    x = 18
    for icon_size in sizes:
        icon = source.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        if icon_size <= 64:
            icon = icon.filter(ImageFilter.UnsharpMask(radius=0.6, percent=135, threshold=2))
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
