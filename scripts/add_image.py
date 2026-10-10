#!/usr/bin/env python3
"""Download a real article image (og:image or in-article) into assets/img/<issue>/ and resize it.

Usage: python3 scripts/add_image.py <image-url> <issue-date> <slug> [--lead]
Prints the site-relative path to paste into the issue JSON ("image.src").
Requires Pillow (pip install pillow).
"""
import sys, io, os, urllib.request
from PIL import Image

def main():
    if len(sys.argv) < 4:
        print(__doc__); sys.exit(1)
    url, issue, slug = sys.argv[1:4]
    lead = "--lead" in sys.argv
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129 Safari/537.36"})
    data = urllib.request.urlopen(req, timeout=30).read()
    im = Image.open(io.BytesIO(data))
    im = im.convert("RGB")
    max_w = 1400 if lead else 720
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    outdir = os.path.join(root, "assets", "img", issue)
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, f"{slug}.jpg")
    im.save(out, "JPEG", quality=80 if lead else 76, optimize=True, progressive=True)
    print(f"assets/img/{issue}/{slug}.jpg  {im.width}x{im.height}  {os.path.getsize(out)//1024} KB")

if __name__ == "__main__":
    main()
