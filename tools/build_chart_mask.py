#!/usr/bin/env python3
"""Build chart-mask.bin (navigation mask used by router.js) from the DHN raster chart 1633.

Usage:  python3 tools/build_chart_mask.py <folder with 163301.KAP and 163302.KAP> [output.bin]
Needs:  pip install rasterio numpy scipy pillow

The raster chart colours are turned into classes (land, drying, depth band) on a 10 m grid in the
same local projection router.js uses. Colours of the DHN charts:
  163301 (1:40 000):  cyan 0-5 m, light blue 5-10 m, white > 10 m
  163302 (1:20 000, Baía de Parati inset): cyan 0-2 m, light blue 2-5 m, white > 5 m
Both: buff = land, green = drying/intertidal. Black text, soundings, symbols and lines take the class
of the nearest coloured pixel. The inset (more detailed) overrides the main chart where it has data.

Classes (by the minimum depth guaranteed by the chart, reduced to mean low water springs):
  0 no data / not connected to the sea   1 land   2 drying
  3 depth >= 0 m   4 depth >= 2 m   5 depth >= 5 m   6 depth >= 10 m
Output: little-endian header  'PGM1' int32 minX, minY (m), uint16 cell (m), cols, rows,
then row-major run-length pairs (uint8 class, varint run length).
"""
import sys, struct, math, re
import numpy as np, rasterio
from scipy import ndimage

ORIGIN = (-23.2, -44.66)                       # must match router.js
KY = 110540.0
KX = 111320.0 * math.cos(math.radians(ORIGIN[0]))
CELL = 10

CHARTS = {  # palette index -> class
    '163301.KAP': {4: 1, 10: 2, 14: 3, 13: 5, 1: 6},
    '163302.KAP': {4: 1, 10: 2, 14: 3, 13: 4, 1: 5},
}


def refs(path):
    head = open(path, 'rb').read(200000).split(b'\x1a')[0].decode('latin-1').replace('\r', '')
    pts = [tuple(map(float, m.groups())) for m in re.finditer(r'REF/\d+,([\d.]+),([\d.]+),([-\d.]+),([-\d.]+)', head)]
    return np.array(pts)  # x, y, lat, lon


def merc(lat):
    return np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))


def georef(path):
    """Fit lon = a + b*x and mercator(lat) = c + d*y from the REF grid; report residuals."""
    r = refs(path)
    b, a = np.polyfit(r[:, 0], r[:, 3], 1)
    d, c = np.polyfit(r[:, 1], merc(r[:, 2]), 1)
    res_lon = np.abs(a + b * r[:, 0] - r[:, 3]).max() * KX
    lat_fit = np.degrees(2 * np.arctan(np.exp(c + d * r[:, 1])) - np.pi / 2)
    res_lat = np.abs(lat_fit - r[:, 2]).max() * KY
    print(f'{path}: {len(r)} REF points, max residual {res_lon:.2f} m E-W, {res_lat:.2f} m N-S')
    return a, b, c, d


def classify(path, mapping):
    with rasterio.open(path) as ds:
        idx = ds.read(1)
    cls = np.zeros(idx.shape, np.uint8)
    for k, v in mapping.items():
        cls[idx == k] = v
    known = cls > 0
    # every other colour (text, soundings, symbols, lines) takes the nearest known class
    iy, ix = ndimage.distance_transform_edt(~known, return_distances=False, return_indices=True)
    return cls[iy, ix], idx


def blank_corner(idx):
    """The inset has an empty white triangle (outside the survey) in its lower-right corner.
    Returns a boolean mask of it, fitted as a straight line through the start of the all-white run
    that reaches the right edge of each row."""
    h, w = idx.shape
    white = idx == 1
    rows, xs = [], []
    for y in range(int(h * .45), h):
        r = white[y][::-1]
        if r.all():
            continue
        start = w - int(np.argmin(r))
        if start < w - 5:
            rows.append(y); xs.append(start)
    rows, xs = np.array(rows, float), np.array(xs, float)
    keep = np.ones(len(rows), bool)
    for _ in range(4):
        m, q = np.polyfit(rows[keep], xs[keep], 1)
        keep = np.abs(m * rows + q - xs) < 25
    print(f'  blank corner: x = {m:.4f}*y + {q:.1f} ({keep.sum()} rows)')
    yy, xx = np.mgrid[0:h, 0:w]
    return xx > (m * yy + q - 15)


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else '.'
    out = sys.argv[2] if len(sys.argv) > 2 else 'chart-mask.bin'
    layers = []
    for name, mapping in CHARTS.items():
        path = f'{folder}/{name}'
        a, b, c, d = georef(path)
        cls, idx = classify(path, mapping)
        if name == '163302.KAP':
            cls[blank_corner(idx)] = 0
        layers.append((cls, a, b, c, d))

    base = layers[0]
    h, w = base[0].shape
    lon0, lon1 = base[1], base[1] + base[2] * w
    lat_at = lambda c, d, y: np.degrees(2 * np.arctan(np.exp(c + d * y)) - np.pi / 2)
    lat0, lat1 = lat_at(base[3], base[4], h), lat_at(base[3], base[4], 0)
    minX = math.floor((lon0 - ORIGIN[1]) * KX); maxX = math.ceil((lon1 - ORIGIN[1]) * KX)
    minY = math.floor((lat0 - ORIGIN[0]) * KY); maxY = math.ceil((lat1 - ORIGIN[0]) * KY)
    cols, rows = (maxX - minX) // CELL + 1, (maxY - minY) // CELL + 1
    print(f'grid {cols}x{rows} cells of {CELL} m, X {minX}..{maxX}, Y {minY}..{maxY}')

    gx = minX + (np.arange(cols) + .5) * CELL
    gy = minY + (np.arange(rows) + .5) * CELL
    lon = ORIGIN[1] + gx / KX
    lat = ORIGIN[0] + gy / KY
    def sample(cls, a, b, c, d):
        px = np.floor((lon - a) / b).astype(int)
        py = np.floor((merc(lat) - c) / d).astype(int)
        okx = (px >= 0) & (px < cls.shape[1]); oky = (py >= 0) & (py < cls.shape[0])
        sub = cls[np.clip(py, 0, cls.shape[0] - 1)][:, np.clip(px, 0, cls.shape[1] - 1)]
        return np.where(oky[:, None] & okx[None, :], sub, 0).astype(np.uint8)

    main, inset = sample(*layers[0]), sample(*layers[1])
    # Depth interval [lo, hi) each chart gives for its water classes.
    LO = {'main': {3: 0, 5: 5, 6: 10}, 'inset': {3: 0, 4: 2, 5: 5}}
    HI = {'main': {3: 5, 5: 10, 6: 1e9}, 'inset': {3: 2, 4: 5, 5: 1e9}}
    CLASS_OF_LO = {0: 3, 2: 4, 5: 5, 10: 6}
    mask = main.copy()
    has = inset > 0
    mask[has] = inset[has]                      # inset (more detailed) wins for land, drying, and by default
    both = has & (inset >= 3) & (main >= 3)
    for ci, lo_i in LO['inset'].items():
        for cm, lo_m in LO['main'].items():
            sel = both & (inset == ci) & (main == cm)
            if not sel.any():
                continue
            lo, hi = max(lo_i, lo_m), min(HI['inset'][ci], HI['main'][cm])
            # both charts agree on a depth range: use what both guarantee; if they disagree, the shallower
            mask[sel] = CLASS_OF_LO[lo] if lo < hi else CLASS_OF_LO[min(lo_i, lo_m)]

    # keep only water connected to the main sea (drops white boxes on land such as the tide table)
    water = mask >= 3
    lab, n = ndimage.label(water, structure=np.ones((3, 3)))
    sizes = ndimage.sum(water, lab, range(1, n + 1))
    main_id = int(np.argmax(sizes)) + 1
    dropped = water & (lab != main_id)
    print(f'water components: {n}, kept the largest ({int(sizes.max())} cells), dropped {int(dropped.sum())} cells')
    mask[dropped] = 0

    for k, name in enumerate(['sem dados', 'terra', 'seca', '>=0 m', '>=2 m', '>=5 m', '>=10 m']):
        print(f'  class {k} {name:9s} {100 * (mask == k).mean():5.1f}%')

    buf = bytearray(b'PGM1' + struct.pack('<iiHHH', minX, minY, CELL, cols, rows))
    flat = mask.ravel()
    change = np.flatnonzero(np.diff(flat)) + 1
    starts = np.concatenate([[0], change]); ends = np.concatenate([change, [flat.size]])
    for s, e in zip(starts, ends):
        buf.append(int(flat[s]))
        run = int(e - s)
        while run >= 0x80:
            buf.append((run & 0x7f) | 0x80); run >>= 7
        buf.append(run)
    open(out, 'wb').write(buf)
    print(f'wrote {out}: {len(buf) / 1024:.0f} KiB, {len(starts)} runs')
    np.save(out + '.npy', mask) if '--npy' in sys.argv else None


if __name__ == '__main__':
    main()
