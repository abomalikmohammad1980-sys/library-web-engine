"""Reproducible small-display derivatives; never overwrite the official masters."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
for kind in ('color', 'mono'):
    source = root / 'app' / 'public' / f'brand-logo-{kind}.png'
    target = root / 'app' / 'src' / 'assets' / f'brand-logo-{kind}-small.webp'
    original = Image.open(source).convert('RGBA')
    small = original.resize((128, round(original.height * 128 / original.width)), Image.Resampling.LANCZOS)
    small.save(target, 'WEBP', lossless=True, exact=True, method=6)
    assert Image.open(target).convert('RGBA').tobytes() == small.tobytes()
    print(f'{kind}: {original.size} -> {small.size}; {target.stat().st_size} bytes; master untouched')
