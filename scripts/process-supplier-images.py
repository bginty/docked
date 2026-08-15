from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageStat


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source-assets" / "supplier" / "docked-cruise-d2"
WEBSITE_IDEAS_SOURCE = ROOT / "source-assets" / "website-ideas-email-2026-08-16"
OUTPUT = ROOT / "assets" / "images" / "product"

CANVAS = (1200, 800)
SMALL = (600, 400)
FEATURE_BOARD_SIZE = (1536, 1536)

SPECS = (
    {
        "source": "supplier-photo-3-original.jpg",
        "crop": (180, 185, 940, 860),
        "name": "cruise-d2-pool",
    },
    {
        "source": "supplier-photo-2-original.jpg",
        "crop": (305, 125, 975, 1140),
        "name": "cruise-d2-overview",
    },
    {
        "source": "supplier-photo-1-original.jpg",
        "crop": (425, 180, 1050, 865),
        "name": "cruise-d2-controls",
    },
)

LIFESTYLE_SPECS = (
    {
        "source": "Man on Float.png",
        "crop": (0, 200, 960, 840),
        "name": "cruise-d2-lifestyle-man",
    },
    {
        "source": "Girl on Float.png",
        "crop": (500, 180, 1124, 596),
        "name": "cruise-d2-lifestyle-woman",
    },
)

SOURCE_HASHES = {
    "supplier-photo-1-original.jpg": "F4C500929324FCC589A328BA24DB5B459D61502E219F88DC4AB3B6734A3D9FE7",
    "supplier-photo-2-original.jpg": "AFE310554ECD1EF4E85DFEED8381EF2F217056DFB442DC578CCB90F3DF44B70E",
    "supplier-photo-3-original.jpg": "72DDED0B06D1F916FCFF5A273258D441C3E7712602C0DDF8C931C276D3BB08CC",
}

WEBSITE_IDEAS_SOURCE_HASHES = {
    "ChatGPT Image Aug 14, 2026, 02_32_27 PM.png": "C6B9CDC55D7A5921313EA4F28EF33A00E3FFB58F972ECEED698B5B0D04E73E86",
    "Man on Float.png": "DEAE3AEE4B7530E07BD47E9DB45B2C454EBB2E686E631722019F56BA28198CA9",
    "Girl on Float.png": "CAE11BD49147FE0DE4D49900B7CBBD55AD18CCD4F161EDDB9031F19C430E01AE",
}


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS)


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    result = image.copy()
    result.thumbnail(size, Image.Resampling.LANCZOS)
    return result


def compose(source: Image.Image, crop_box: tuple[int, int, int, int]) -> Image.Image:
    crop = source.crop(crop_box).convert("RGB")
    background = cover(crop, CANVAS)
    background = background.filter(ImageFilter.GaussianBlur(28))
    background = ImageEnhance.Brightness(background).enhance(0.72)

    foreground = contain(crop, (1110, 740))
    framed = Image.new("RGB", (foreground.width + 12, foreground.height + 12), "#ffffff")
    framed.paste(foreground, (6, 6))

    result = background.copy()
    x = (CANVAS[0] - framed.width) // 2
    y = (CANVAS[1] - framed.height) // 2
    result.paste(framed, (x, y))
    return result


def save_webp(image: Image.Image, path: Path) -> None:
    image.save(path, format="WEBP", quality=88, method=6, exif=b"")


def compose_feature_board(source: Image.Image) -> Image.Image:
    """Remove one unsupported sentence with a feathered clone of source water."""
    target = (930, 728, 1235, 850)
    donor_box = (610, 25, 915, 147)
    reference_box = (1235, 728, 1254, 850)
    feather_x, feather_y = (24, 12)

    donor = source.crop(donor_box).convert("RGB")
    reference = source.crop(reference_box).convert("RGB")
    donor_mean = ImageStat.Stat(donor).mean
    reference_mean = ImageStat.Stat(reference).mean

    adjusted_channels = []
    for channel, source_mean, target_mean in zip(
        donor.split(), donor_mean, reference_mean, strict=True
    ):
        delta = target_mean - source_mean
        adjusted_channels.append(
            channel.point(lambda pixel, shift=delta: max(0, min(255, round(pixel + shift))))
        )
    donor = Image.merge("RGB", adjusted_channels)

    layer = source.copy()
    layer.paste(donor, target[:2])
    mask = Image.new("L", source.size, 0)
    mask_pixels = mask.load()

    for y in range(target[1], target[3]):
        distance_y = min(y - target[1] + 1, target[3] - y)
        alpha_y = min(1.0, distance_y / feather_y)
        alpha_y = alpha_y * alpha_y * (3 - (2 * alpha_y))
        for x in range(target[0], target[2]):
            distance_x = min(x - target[0] + 1, target[2] - x)
            alpha_x = min(1.0, distance_x / feather_x)
            alpha_x = alpha_x * alpha_x * (3 - (2 * alpha_x))
            mask_pixels[x, y] = round(255 * alpha_x * alpha_y)

    result = Image.composite(layer, source, mask)
    return result.resize(FEATURE_BOARD_SIZE, Image.Resampling.LANCZOS)


def verify_source(path: Path, expected_hashes: dict[str, str] = SOURCE_HASHES) -> None:
    expected = expected_hashes[path.name]
    actual = hashlib.sha256(path.read_bytes()).hexdigest().upper()
    if actual != expected:
        raise ValueError(f"Unexpected supplier source bytes: {path.name}")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)

    for spec in SPECS:
        source_path = SOURCE / spec["source"]
        verify_source(source_path)
        with Image.open(source_path) as source:
            composition = compose(source.convert("RGB"), spec["crop"])
        save_webp(composition, OUTPUT / f"{spec['name']}-1200.webp")
        save_webp(composition.resize(SMALL, Image.Resampling.LANCZOS), OUTPUT / f"{spec['name']}-600.webp")

    for spec in LIFESTYLE_SPECS:
        source_path = WEBSITE_IDEAS_SOURCE / spec["source"]
        verify_source(source_path, WEBSITE_IDEAS_SOURCE_HASHES)
        with Image.open(source_path) as source:
            crop = source.crop(spec["crop"]).convert("RGB")
        composition = crop.resize(CANVAS, Image.Resampling.LANCZOS)
        save_webp(composition, OUTPUT / f"{spec['name']}-1200.webp")
        save_webp(composition.resize(SMALL, Image.Resampling.LANCZOS), OUTPUT / f"{spec['name']}-600.webp")

    feature_source_path = WEBSITE_IDEAS_SOURCE / "ChatGPT Image Aug 14, 2026, 02_32_27 PM.png"
    verify_source(feature_source_path, WEBSITE_IDEAS_SOURCE_HASHES)
    with Image.open(feature_source_path) as source:
        if source.size != (1254, 1254):
            raise ValueError(f"Unexpected feature-board dimensions: {source.size}")
        feature_board = compose_feature_board(source.convert("RGB"))
    feature_board.save(
        OUTPUT / "cruise-d2-features.jpg",
        format="JPEG",
        quality=94,
        optimize=True,
        progressive=False,
        exif=b"",
    )

    social_source_path = SOURCE / "supplier-photo-3-original.jpg"
    with Image.open(social_source_path) as source:
        social = compose(source.convert("RGB"), SPECS[0]["crop"])
    social = cover(social, (1200, 630))
    social.save(OUTPUT / "cruise-d2-social-1200.jpg", format="JPEG", quality=90, optimize=True, exif=b"")


if __name__ == "__main__":
    main()
