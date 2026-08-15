from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source-assets" / "supplier" / "docked-cruise-d2"
OUTPUT = ROOT / "assets" / "images" / "product"

CANVAS = (1200, 800)
SMALL = (600, 400)

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

SOURCE_HASHES = {
    "supplier-photo-1-original.jpg": "F4C500929324FCC589A328BA24DB5B459D61502E219F88DC4AB3B6734A3D9FE7",
    "supplier-photo-2-original.jpg": "AFE310554ECD1EF4E85DFEED8381EF2F217056DFB442DC578CCB90F3DF44B70E",
    "supplier-photo-3-original.jpg": "72DDED0B06D1F916FCFF5A273258D441C3E7712602C0DDF8C931C276D3BB08CC",
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


def verify_source(path: Path) -> None:
    expected = SOURCE_HASHES[path.name]
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

    social_source_path = SOURCE / "supplier-photo-3-original.jpg"
    with Image.open(social_source_path) as source:
        social = compose(source.convert("RGB"), SPECS[0]["crop"])
    social = cover(social, (1200, 630))
    social.save(OUTPUT / "cruise-d2-social-1200.jpg", format="JPEG", quality=90, optimize=True, exif=b"")


if __name__ == "__main__":
    main()
