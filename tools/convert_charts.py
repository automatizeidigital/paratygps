"""Convert the supplied BSB/KAP sheets into lossless georeferenced chunks.

Usage: python3 tools/convert_charts.py /path/to/extracted/1633
Requires rasterio, numpy and Pillow. No chart pixels are resampled.
"""
import hashlib
import json
import math
import re
import sys
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image

root = Path(__file__).resolve().parents[1]
out = root / 'charts' / '1633'
out.mkdir(parents=True, exist_ok=True)
sheets = []
for chart_id in ('163301', '163302'):
    source = Path(sys.argv[1]) / f'{chart_id}.KAP'
    raw = source.read_bytes()
    header = raw.split(b'\x1a')[0].decode('latin1')
    refs = np.array([[float(v) for v in m] for m in re.findall(
        r'REF/\d+,(\d+),(\d+),([-\d.]+),([-\d.]+)', header)])
    # Leaflet uses spherical Mercator; derive its pixel transform directly
    # from every KAP reference rather than reusing the ellipsoidal GDAL CRS.
    merc_y = np.log(np.tan(np.pi / 4 + np.radians(refs[:, 2]) / 2))
    ax = np.polyfit(refs[:, 0], refs[:, 3], 1)
    ay = np.polyfit(refs[:, 1], merc_y, 1)
    residual = max(float(np.max(np.abs((np.polyval(ax, refs[:, 0]) - refs[:, 3]) / ax[0]))),
                   float(np.max(np.abs((np.polyval(ay, refs[:, 1]) - merc_y) / ay[0]))))
    assert len(refs) == 100 and residual < 0.1, (chart_id, residual)
    def point(x, y):
        return [math.degrees(2 * math.atan(math.exp(float(np.polyval(ay, y)))) - math.pi / 2),
                float(np.polyval(ax, x))]
    with rasterio.open(source) as ds:
        pixels = ds.read(1)
        palette = ds.colormap(1)
        height, width = pixels.shape
    sheet_dir = out / chart_id
    sheet_dir.mkdir(exist_ok=True)
    chunks = []
    for y in range(0, height, 2048):
        for x in range(0, width, 2048):
            right, bottom = min(x + 2048, width), min(y + 2048, height)
            im = Image.fromarray(pixels[y:bottom, x:right], mode='P')
            im.putpalette([c for i in range(256) for c in palette.get(i, (0, 0, 0, 255))[:3]])
            path = sheet_dir / f'{x}_{y}.webp'
            temporary = path.with_suffix('.tmp')
            im.convert('RGB').save(temporary, format='WEBP', lossless=True, method=6)
            temporary.replace(path)
            chunks.append({'url': './' + str(path.relative_to(root)),
                           'bounds': [point(x, bottom), point(right, y)],
                           'bytes': path.stat().st_size})
    ntm = re.search(r'NTM/NE=([^,]+),ND=([^\r\n]+)', header)
    sheet = {'id': chart_id, 'name': 'Ilha Grande — parte oeste' if chart_id == '163301' else 'Baía de Paraty e adjacências',
             'scale': int(re.search(r'KNP/SC=(\d+)', header)[1]),
             'correction': ntm[1], 'correctionDate': ntm[2],
             'bounds': [point(0, height), point(width, 0)],
             'referenceCount': len(refs), 'maxResidualPixels': residual,
             'sourceSha256': hashlib.sha256(raw).hexdigest(), 'chunks': chunks}
    sheets.append(sheet)
    print(chart_id, len(chunks), 'chunks; maximum fit residual:', residual, 'pixels')
manifest = {'version': '1633-2026-04-16-v1', 'source': '1633_0.zip supplied by the user; BSB/KAP headers',
            'sheets': sheets}
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
