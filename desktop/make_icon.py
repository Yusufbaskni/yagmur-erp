#!/usr/bin/env python3
"""Draw a Yağmur ERP Dock icon and pack it as AppIcon.icns."""

from __future__ import annotations

import struct
import subprocess
import zlib
from pathlib import Path

SIZE = 1024
HERE = Path(__file__).resolve().parent
OUT = HERE / "AppIcon.icns"


def write_png(path: Path, width: int, height: int, rgba: bytearray) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(rgba[y * width * 4 : (y + 1) * width * 4]) for y in range(height))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def blend(buf: bytearray, x: int, y: int, color) -> None:
    if x < 0 or y < 0 or x >= SIZE or y >= SIZE:
        return
    i = (y * SIZE + x) * 4
    src_a = color[3] / 255
    if src_a <= 0:
        return
    dst_a = buf[i + 3] / 255
    out_a = src_a + dst_a * (1 - src_a)
    if out_a <= 0:
        return
    for c in range(3):
        src = color[c] / 255
        dst = buf[i + c] / 255
        buf[i + c] = int(255 * ((src * src_a + dst * dst_a * (1 - src_a)) / out_a))
    buf[i + 3] = int(255 * out_a)


def fill_round_rect(buf, x0, y0, x1, y1, radius, color):
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            dx = 0.0
            dy = 0.0
            if x < x0 + radius:
                dx = x0 + radius - x
            elif x > x1 - radius:
                dx = x - (x1 - radius)
            if y < y0 + radius:
                dy = y0 + radius - y
            elif y > y1 - radius:
                dy = y - (y1 - radius)
            if dx * dx + dy * dy <= radius * radius + radius:
                blend(buf, x, y, color)


def fill_circle(buf, cx, cy, radius, color):
    r2 = radius * radius
    for y in range(int(cy - radius), int(cy + radius) + 1):
        for x in range(int(cx - radius), int(cx + radius) + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                blend(buf, x, y, color)


def fill_rect(buf, x0, y0, x1, y1, color):
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            blend(buf, x, y, color)


def paint() -> bytearray:
    buf = bytearray(SIZE * SIZE * 4)
    top = (18, 72, 68)
    bottom = (34, 140, 110)
    cx = cy = SIZE / 2
    for y in range(SIZE):
        row = mix(top, bottom, y / (SIZE - 1))
        for x in range(SIZE):
            dx = (x - cx) / cx
            dy = (y - cy) / cy
            shade = max(0.0, 1 - 0.16 * (dx * dx + dy * dy))
            i = (y * SIZE + x) * 4
            buf[i] = int(row[0] * shade)
            buf[i + 1] = int(row[1] * shade)
            buf[i + 2] = int(row[2] * shade)
            buf[i + 3] = 255

    fill_circle(buf, 512, 500, 290, (255, 255, 255, 28))

    cream = (247, 244, 238, 255)
    cream_deep = (230, 222, 205, 255)
    accent = (255, 210, 120, 255)
    fill_round_rect(buf, 310, 430, 714, 560, 36, cream)
    fill_round_rect(buf, 350, 340, 674, 450, 32, cream_deep)
    fill_round_rect(buf, 390, 260, 634, 360, 28, cream)

    fill_circle(buf, 512, 300, 34, accent)
    for y in range(300, 360):
        t = (y - 300) / 60
        half = int(18 * (1 - t) + 4)
        fill_rect(buf, 512 - half, y, 512 + half, y, accent)

    fill_round_rect(buf, 280, 600, 744, 636, 16, (255, 255, 255, 210))
    for i, x0 in enumerate((320, 430, 540, 650)):
        shade = (255, 255, 255, 160 - i * 20)
        fill_round_rect(buf, x0, 656, x0 + 70, 676, 8, shade)

    return buf


def main() -> None:
    png = HERE / "AppIcon-1024.png"
    write_png(png, SIZE, SIZE, paint())
    iconset = HERE / "AppIcon.iconset"
    if iconset.exists():
        subprocess.run(["rm", "-rf", str(iconset)], check=True)
    iconset.mkdir()
    for size in (16, 32, 64, 128, 256, 512, 1024):
        subprocess.run(
            ["sips", "-z", str(size), str(size), str(png), "--out", str(iconset / f"icon_{size}x{size}.png")],
            check=True,
            stdout=subprocess.DEVNULL,
        )
    mapping = {
        "icon_16x16.png": 16,
        "icon_16x16@2x.png": 32,
        "icon_32x32.png": 32,
        "icon_32x32@2x.png": 64,
        "icon_128x128.png": 128,
        "icon_128x128@2x.png": 256,
        "icon_256x256.png": 256,
        "icon_256x256@2x.png": 512,
        "icon_512x512.png": 512,
        "icon_512x512@2x.png": 1024,
    }
    for name, size in mapping.items():
        src = iconset / f"icon_{size}x{size}.png"
        dest = iconset / name
        if src.resolve() != dest.resolve():
            subprocess.run(["cp", str(src), str(dest)], check=True)
    subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(OUT)], check=True)
    print(OUT)


if __name__ == "__main__":
    main()
