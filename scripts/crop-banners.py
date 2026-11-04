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


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: crop-banners.py <source-dir>")
    src_dir = Path(sys.argv[1])
    m = json.loads((OUT / "crop-manifest.json").read_text())
    width, cap = m["output_width"], m["max_bytes"]
    for it in m["images"]:
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
        left = (w - cw) // 2
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
