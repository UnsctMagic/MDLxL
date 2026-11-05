# Run with the same Pillow environment as scripts/build-file-icons.py.
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'public' / 'branding'
for style in ['page', 'dark-page', 'tile', 'tag', 'letters']:
    mdl = Image.open(root / f'file-mdl-{style}.ico')
    mdx = Image.open(root / f'file-mdx-{style}.ico')
    for size in [16, 24, 32, 48, 64, 128, 256]:
        def white_mask(icon):
            pixels = icon.ico.getimage((size, size)).convert('RGBA').tobytes()
            return tuple(pixels[i + 3] > 200 and min(pixels[i:i + 3]) > 230 for i in range(0, len(pixels), 4))
        assert white_mask(mdl) != white_mask(mdx), f'{style} {size}px: MDL and MDX must have different visible letter shapes, not only different colours'
print('PASS: all 35 MDL/MDX size/style pairs have distinct visible labels')
