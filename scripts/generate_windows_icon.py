from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "src-tauri" / "icons"
ICO_PATH = ICON_DIR / "icon.ico"
PNG_PATH = ICON_DIR / "icon-256.png"
SHEET_PATH = ICON_DIR / "icon-preview-sheet.png"
SVG_PATH = ICON_DIR / "icon.svg"

PANASONIC_BLUE = (0, 84, 166)
CYAN = (34, 205, 218)


def n(value: float, scale: float) -> int:
    return round(value * scale)


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    names = ["arialbd.ttf", "segoeuib.ttf"] if bold else ["arial.ttf", "segoeui.ttf"]
    for name in names:
        path = Path("C:/Windows/Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    width, height = size
    image = Image.new("RGBA", size)
    px = image.load()
    for y in range(height):
        t = y / max(1, height - 1)
        for x in range(width):
            light = 1 - abs(x / max(1, width - 1) - 0.28) * 0.35
            px[x, y] = (
                min(255, lerp(top[0], bottom[0], t) + round(7 * light)),
                min(255, lerp(top[1], bottom[1], t) + round(8 * light)),
                min(255, lerp(top[2], bottom[2], t) + round(8 * light)),
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
) -> Image.Image:
    size = (box[2] - box[0], box[3] - box[1])
    mask = rounded_mask(size, radius)
    layer = fill if isinstance(fill, Image.Image) else Image.new("RGBA", size, fill)
    layer.putalpha(mask)
    canvas.alpha_composite(layer, (box[0], box[1]))
    return mask


def shadow(canvas: Image.Image, mask: Image.Image, xy: tuple[int, int], blur: int, alpha: int) -> None:
    layer = Image.new("RGBA", mask.size, (0, 24, 54, 0))
    layer.putalpha(mask.filter(ImageFilter.GaussianBlur(max(1, blur))).point(lambda v: v * alpha // 255))
    canvas.alpha_composite(layer, xy)


def centered_text(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    text_font: ImageFont.ImageFont,
    fill: tuple[int, int, int, int],
) -> None:
    bounds = draw.textbbox((0, 0), text, font=text_font)
    x = box[0] + (box[2] - box[0] - (bounds[2] - bounds[0])) / 2 - bounds[0]
    y = box[1] + (box[3] - box[1] - (bounds[3] - bounds[1])) / 2 - bounds[1]
    draw.text((x, y), text, font=text_font, fill=fill)


def draw_large_icon(size: int) -> Image.Image:
    scale = size / 1024
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image, "RGBA")

    body = (n(128, scale), n(116, scale), n(896, scale), n(888, scale))
    body_size = (body[2] - body[0], body[3] - body[1])
    body_radius = n(164, scale)
    body_mask = rounded_mask(body_size, body_radius)
    shadow(image, body_mask, (body[0], body[1] + n(35, scale)), n(28, scale), 74)
    shadow(image, body_mask, (body[0], body[1] + n(6, scale)), n(8, scale), 22)
    paste_round(image, body, body_radius, gradient(body_size, (57, 210, 224), PANASONIC_BLUE))
    draw.rounded_rectangle(body, radius=body_radius, outline=(255, 255, 255, 86), width=max(1, n(10, scale)))

    mark = (n(260, scale), n(172, scale), n(764, scale), n(270, scale))
    paste_round(image, mark, n(28, scale), (255, 255, 255, 242))
    label = "PANASONIC" if size >= 128 else "P"
    centered_text(draw, mark, label, font(n(42 if label == "PANASONIC" else 58, scale), True), (*PANASONIC_BLUE, 255))

    photo = (n(246, scale), n(332, scale), n(778, scale), n(704, scale))
    photo_size = (photo[2] - photo[0], photo[3] - photo[1])
    photo_mask = rounded_mask(photo_size, n(60, scale))
    shadow(image, photo_mask, (photo[0], photo[1] + n(20, scale)), n(18, scale), 52)
    paste_round(image, photo, n(60, scale), (244, 252, 255, 242))
    draw.rounded_rectangle(photo, radius=n(60, scale), outline=(255, 255, 255, 165), width=max(1, n(8, scale)))

    scene = (n(306, scale), n(404, scale), n(718, scale), n(624, scale))
    draw.rounded_rectangle(scene, radius=n(30, scale), fill=(197, 231, 243, 255))
    draw.polygon(
        [(scene[0], scene[3]), (n(462, scale), n(470, scale)), (n(554, scale), scene[3])],
        fill=(0, 168, 204, 255),
    )
    draw.polygon(
        [(n(438, scale), scene[3]), (n(614, scale), n(458, scale)), (scene[2], scene[3])],
        fill=(0, 104, 190, 255),
    )
    draw.ellipse((n(604, scale), n(424, scale), n(674, scale), n(494, scale)), fill=(*CYAN, 255))

    lens = (n(382, scale), n(354, scale), n(642, scale), n(614, scale))
    draw.ellipse(lens, fill=(0, 60, 132, 238))
    draw.ellipse((n(422, scale), n(394, scale), n(602, scale), n(574, scale)), fill=(0, 114, 198, 255))
    draw.ellipse((n(456, scale), n(428, scale), n(568, scale), n(540, scale)), fill=(*CYAN, 255))
    draw.ellipse((n(474, scale), n(446, scale), n(518, scale), n(490, scale)), fill=(255, 255, 255, 130))

    raw = (n(326, scale), n(676, scale), n(510, scale), n(806, scale))
    jpg = (n(514, scale), n(676, scale), n(698, scale), n(806, scale))
    paste_round(image, raw, n(34, scale), (*PANASONIC_BLUE, 255))
    paste_round(image, jpg, n(34, scale), (*CYAN, 255))
    link = (255, 255, 255, 242)
    w = max(2, n(26, scale))
    draw.arc((n(420, scale), n(706, scale), n(586, scale), n(784, scale)), 92, 268, fill=link, width=w)
    draw.arc((n(522, scale), n(706, scale), n(688, scale), n(784, scale)), -88, 88, fill=link, width=w)
    draw.line((n(500, scale), n(745, scale), n(608, scale), n(745, scale)), fill=link, width=max(2, n(18, scale)))

    return image


def draw_small_icon(size: int) -> Image.Image:
    scale = size / 1024
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image, "RGBA")
    body = (n(136, scale), n(136, scale), n(888, scale), n(888, scale))
    radius = n(170, scale)
    mask = rounded_mask((body[2] - body[0], body[3] - body[1]), radius)
    shadow(image, mask, (body[0], body[1] + max(1, n(22, scale))), max(1, n(18, scale)), 66)
    paste_round(image, body, radius, gradient((body[2] - body[0], body[3] - body[1]), (54, 210, 224), PANASONIC_BLUE))
    draw.rounded_rectangle(body, radius=radius, outline=(255, 255, 255, 118), width=max(1, n(14, scale)))

    photo = (n(270, scale), n(312, scale), n(752, scale), n(706, scale))
    paste_round(image, photo, n(76, scale), (246, 253, 255, 238))
    draw.rounded_rectangle(photo, radius=n(76, scale), outline=(255, 255, 255, 180), width=max(1, n(14, scale)))
    draw.polygon(
        [(n(316, scale), n(642, scale)), (n(488, scale), n(466, scale)), (n(602, scale), n(642, scale))],
        fill=(0, 161, 204, 255),
    )
    draw.polygon(
        [(n(488, scale), n(642, scale)), (n(646, scale), n(474, scale)), (n(734, scale), n(642, scale))],
        fill=(0, 91, 177, 255),
    )
    draw.ellipse((n(572, scale), n(366, scale), n(704, scale), n(498, scale)), fill=(*CYAN, 255))

    badge = (n(300, scale), n(700, scale), n(724, scale), n(842, scale))
    paste_round(image, badge, n(70, scale), (255, 255, 255, 238))
    draw.rounded_rectangle((n(330, scale), n(728, scale), n(500, scale), n(812, scale)), radius=n(42, scale), fill=(*PANASONIC_BLUE, 255))
    draw.rounded_rectangle((n(524, scale), n(728, scale), n(694, scale), n(812, scale)), radius=n(42, scale), fill=(*CYAN, 255))
    draw.line((n(448, scale), n(770, scale), n(576, scale), n(770, scale)), fill=(255, 255, 255, 255), width=max(1, n(36, scale)))

    p_box = (n(238, scale), n(178, scale), n(420, scale), n(300, scale))
    paste_round(image, p_box, n(48, scale), (255, 255, 255, 236))
    centered_text(draw, p_box, "P", font(max(7, n(78, scale)), True), (*PANASONIC_BLUE, 255))
    return image


def draw_icon(size: int) -> Image.Image:
    supersample = 4 if size <= 64 else 2 if size < 256 else 1
    working_size = size * supersample
    icon = draw_small_icon(working_size) if size <= 64 else draw_large_icon(working_size)
    if supersample == 1:
        return icon
    return icon.resize((size, size), Image.Resampling.LANCZOS)


def write_svg() -> None:
    SVG_PATH.write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#39d2e0"/>
      <stop offset="1" stop-color="#0054a6"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="28" stdDeviation="22" flood-color="#001832" flood-opacity="0.28"/>
    </filter>
  </defs>
  <rect x="128" y="116" width="768" height="772" rx="164" fill="url(#body)" filter="url(#shadow)"/>
  <rect x="128" y="116" width="768" height="772" rx="164" fill="none" stroke="#fff" stroke-opacity=".34" stroke-width="10"/>
  <rect x="260" y="172" width="504" height="98" rx="28" fill="#fff" fill-opacity=".95"/>
  <text x="512" y="235" text-anchor="middle" font-family="Arial, Segoe UI, sans-serif" font-weight="700" font-size="42" fill="#0054a6">PANASONIC</text>
  <rect x="246" y="332" width="532" height="372" rx="60" fill="#f4fcff" fill-opacity=".95"/>
  <rect x="306" y="404" width="412" height="220" rx="30" fill="#c5e7f3"/>
  <path d="M306 624 462 470 554 624Z" fill="#00a8cc"/>
  <path d="M438 624 614 458 718 624Z" fill="#0068be"/>
  <circle cx="639" cy="459" r="35" fill="#22cdda"/>
  <circle cx="512" cy="484" r="130" fill="#003c84" fill-opacity=".94"/>
  <circle cx="512" cy="484" r="90" fill="#0072c6"/>
  <circle cx="512" cy="484" r="56" fill="#22cdda"/>
  <circle cx="496" cy="468" r="22" fill="#fff" fill-opacity=".52"/>
  <rect x="326" y="676" width="184" height="130" rx="34" fill="#0054a6"/>
  <rect x="514" y="676" width="184" height="130" rx="34" fill="#22cdda"/>
  <path d="M503 745H608" stroke="#fff" stroke-width="18" stroke-linecap="round"/>
</svg>
""",
        encoding="utf-8",
    )


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    write_svg()
    sizes = [16, 24, 32, 48, 64, 128, 256]
    images = [draw_icon(size) for size in sizes]
    images[-1].save(PNG_PATH)
    images[-1].save(ICO_PATH, format="ICO", sizes=[(size, size) for size in sizes])

    sheet = Image.new("RGBA", (560, 310), (232, 240, 246, 255))
    sheet_draw = ImageDraw.Draw(sheet)
    x = 18
    for size in [256, 128, 64, 48, 32, 24, 16]:
        icon = draw_icon(size)
        sheet.alpha_composite(icon, (x, 20 + (256 - size) // 2))
        sheet_draw.text((x, 274), str(size), fill=(58, 70, 82, 255), font=font(11))
        x += size + 20
    sheet.save(SHEET_PATH)


if __name__ == "__main__":
    main()
