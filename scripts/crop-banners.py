"""Crop raw GPT banners per assets/banners/crop-manifest.json.
Usage: python3 -I scripts/crop-banners.py <source-dir>
"""
import io
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "banners"


def encode(img):
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def icon(src_dir, it, cap):
    """Transparent icon: trim to the alpha bounding box, pad to a square with a margin, resize."""
    im = Image.open(src_dir / it["src"]).convert("RGBA")
    box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    im = im.crop(box)
    side = round(max(im.size) * (1 + 2 * it.get("margin", 0.06)))
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    sq = sq.resize((it["width"], it["width"]), Image.LANCZOS)
    data = encode(sq)
    if len(data) > cap:
        sys.exit(f'{it["out"]}: {len(data)} bytes exceeds {cap}')
    out = OUT.parent / it["out"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    print(f'{it["out"]}: {it["width"]}x{it["width"]} {len(data)} bytes (alpha)')


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: crop-banners.py <source-dir>")
    src_dir = Path(sys.argv[1])
    m = json.loads((OUT / "crop-manifest.json").read_text())
    cap = m["max_bytes"]
    for it in m["images"]:
        if it.get("alpha"):
            icon(src_dir, it, cap)
            continue
        width = it.get("width", m["output_width"])
        im = Image.open(src_dir / it["src"]).convert("RGB")
        w, h = im.size
        rw, rh = it["ratio"]
        ch = round(w * rh / rw)
        if ch > h:  # source too short for full width: crop width instead
            ch = h
            cw = round(h * rw / rh)
        else:
            cw = w
        top = min(max(it["center_y"] - ch // 2, 0), h - ch)
        left = min(max(it.get("center_x", w // 2) - cw // 2, 0), w - cw)
        crop = im.crop((left, top, left + cw, top + ch))
        out_h = round(width * rh / rw)
        crop = crop.resize((width, out_h), Image.LANCZOS)
        data = encode(crop)
        note = ""
        if len(data) > cap:
            data = encode(crop.quantize(256))
            note = " (quantized)"
        (OUT / it["out"]).write_bytes(data)
        print(f'{it["out"]}: {width}x{out_h} {len(data)} bytes{note}')


main()
