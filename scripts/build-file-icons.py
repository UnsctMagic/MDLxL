# Builds the MDL/MDX file icon variations (file-mdl-*.ico, file-mdx-*.ico) from the
# existing MDLxL branding icons. Needs Python with Pillow and Segoe UI Bold:
#   python scripts/build-file-icons.py public/branding public/branding
import sys, os
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
FONT = 'C:/Windows/Fonts/segoeuib.ttf'
SIZES = [16, 24, 32, 48, 64, 128, 256]
KINDS = {'mdl': (47, 143, 208), 'mdx': (194, 59, 46)}   # MDL blue (text), MDX red (binary)

def frames(name):
    im = Image.open(os.path.join(src, name + '.ico')); res = {}
    for s in SIZES:
        im.size = (s, s); im.load(); res[s] = im.convert('RGBA').copy()
    return res

def bbox(im): return im.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()

def text_band(im, kind, box, radius):
    s = im.size[0]; d = ImageDraw.Draw(im); col = KINDS[kind]
    x0, y0, x1, y1 = box
    d.rounded_rectangle(box, radius=radius, fill=col + (255,), outline=(255, 255, 255, 255) if s >= 48 else None, width=max(1, s // 96))
    if s >= 32:
        h = y1 - y0; size = int(h * .78); f = ImageFont.truetype(FONT, size)
        t = kind.upper(); tb = d.textbbox((0, 0), t, font=f)
        while tb[2] - tb[0] > (x1 - x0) * .86: size -= 1; f = ImageFont.truetype(FONT, size); tb = d.textbbox((0, 0), t, font=f)
        d.text(((x0 + x1 - (tb[2] - tb[0])) / 2 - tb[0], (y0 + y1 - (tb[3] - tb[1])) / 2 - tb[1]), t, font=f, fill=(255, 255, 255, 255))

def page_band(base, kind):
    res = {}
    for s, im in base.items():
        im = im.copy(); x0, y0, x1, y1 = bbox(im); w = x1 - x0
        h = max(4, round(s * .2)) if s >= 32 else max(3, round(s * .25))
        m = max(1, round(w * .02)) if s >= 32 else 0
        text_band(im, kind, (x0 - m, y1 - h - round(s * .06), x1 - 1 + m, y1 - 1 - round(s * .06)), max(1, s // 32))
        res[s] = im
    return res

def tag(base, kind):
    res = {}
    for s, im in base.items():
        im = im.copy(); x0, y0, x1, y1 = bbox(im)
        w, h = round(s * .62), max(5, round(s * .27))
        text_band(im, kind, (s - w, s - h, s - 1, s - 1), max(1, s // 14))
        res[s] = im
    return res

def letters(kind):
    # Big format letters on the dark tile, helmet reduced to a corner mark.
    res = {}; tile = frames('file-tile'); helm = frames('MDLxL')
    for s in SIZES:
        im = tile[s].copy(); d = ImageDraw.Draw(im); x0, y0, x1, y1 = bbox(im); col = KINDS[kind]
        inner = max(1, round(s * .07))
        d.rounded_rectangle((x0 + inner, y0 + inner, x1 - 1 - inner, y1 - 1 - inner), radius=max(1, s // 10), fill=col + (255,))
        if s >= 32:
            t = kind.upper(); size = int(s * .36); f = ImageFont.truetype(FONT, size); tb = d.textbbox((0, 0), t, font=f)
            while tb[2] - tb[0] > (x1 - x0) * .74: size -= 1; f = ImageFont.truetype(FONT, size); tb = d.textbbox((0, 0), t, font=f)
            d.text(((s - (tb[2] - tb[0])) / 2 - tb[0], s * .66 - (tb[3] - tb[1]) / 2 - tb[1]), t, font=f, fill=(255, 255, 255, 255))
            hs = round(s * .46); h = helm[256].resize((hs, hs), Image.LANCZOS); im.alpha_composite(h, ((s - hs) // 2, round(s * .08)))
        else:
            hs = round(s * .7); h = helm[256].resize((hs, hs), Image.LANCZOS); im.alpha_composite(h, ((s - hs) // 2, (s - hs) // 2))
        res[s] = im
    return res

def save(res, name):
    big = res[256]; big.save(os.path.join(out, name + '.ico'), sizes=[(s, s) for s in SIZES], append_images=[res[s] for s in SIZES if s != 256])
    return name

made = []
for kind in KINDS:
    for style in ['page', 'dark-page', 'tile']:
        made.append(save(page_band(frames('file-' + style), kind), f'file-{kind}-{style}'))
    made.append(save(tag(frames('MDLxL'), kind), f'file-{kind}-tag'))
    made.append(save(letters(kind), f'file-{kind}-letters'))
print('\n'.join(made))
