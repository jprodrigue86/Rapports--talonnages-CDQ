#!/usr/bin/env python3
import struct, zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps-script-manager'

BG = (7, 17, 31)
PANEL = (14, 34, 59)
BLUE = (79, 163, 255)
WHITE = (244, 248, 255)


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)


def save_png(path: Path, size: int):
    px = [list(BG) for _ in range(size * size)]

    def setpx(x, y, c):
        if 0 <= x < size and 0 <= y < size:
            px[y * size + x] = list(c)

    def rect(x0, y0, x1, y1, c):
        x0=max(0,x0); y0=max(0,y0); x1=min(size-1,x1); y1=min(size-1,y1)
        for y in range(y0, y1 + 1):
            base = y * size
            for x in range(x0, x1 + 1):
                px[base + x] = list(c)

    p = int(size * .09)
    rect(p, p, size-p-1, size-p-1, PANEL)
    b = max(3, int(size * .018))
    rect(p, p, size-p-1, p+b, BLUE)
    rect(p, size-p-1-b, size-p-1, size-p-1, BLUE)
    rect(p, p, p+b, size-p-1, BLUE)
    rect(size-p-1-b, p, size-p-1, size-p-1, BLUE)

    y0, y1 = int(size*.38), int(size*.60)
    bar = max(4, int(size*.035))
    gap = int(size*.035)
    cw = int(size*.13)
    x = int(size*.24)

    # C
    rect(x,y0,x+bar,y1,WHITE); rect(x,y0,x+cw,y0+bar,WHITE); rect(x,y1-bar,x+cw,y1,WHITE)
    x += cw + gap
    # D
    rect(x,y0,x+bar,y1,WHITE); rect(x,y0,x+cw-bar,y0+bar,WHITE); rect(x,y1-bar,x+cw-bar,y1,WHITE); rect(x+cw-bar,y0+bar,x+cw,y1-bar,WHITE)
    x += cw + gap
    # Q
    rect(x,y0,x+bar,y1-bar,WHITE); rect(x,y0,x+cw,y0+bar,WHITE); rect(x+cw-bar,y0,x+cw,y1,WHITE); rect(x,y1-bar,x+cw,y1,WHITE); rect(x+cw-bar,y1-bar,x+cw+bar,y1+bar,WHITE)

    rect(int(size*.32), int(size*.71), int(size*.68), int(size*.73), BLUE)

    raw = bytearray()
    for y in range(size):
        raw.append(0)  # PNG filter: none
        for x in range(size):
            raw.extend(px[y*size+x])

    data = b'\x89PNG\r\n\x1a\n'
    data += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    data += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    data += chunk(b'IEND', b'')
    path.write_bytes(data)


for n in (192, 512):
    save_png(OUT / f'icon-{n}.png', n)
    print(f'generated icon-{n}.png')
