#!/usr/bin/env python3
"""Regenera los iconos PWA de BRAMUlab a partir del asset aprobado
docs/identidad-visual/BRAMULab icono2.png (ÍCONO APP del Sistema Gráfico: isotipo B sobre fondo
oscuro). NO redibuja el isotipo: solo recorta/escala el asset aprobado.

Uso (desde la raíz del repo):  python3 docs/identidad-visual/generar-iconos-pwa.py
Requiere Pillow.
"""
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'docs/identidad-visual/BRAMULab icono2.png'
OUT = ROOT / 'bramulab/icons'

src = Image.open(SRC).convert('RGBA')
W = src.size[0]

def square_crop(cx, cy, side):
    half = side / 2
    return src.crop((round(cx - half), round(cy - half), round(cx + half), round(cy + half)))

# El asset trae esquinas redondeadas transparentes/negras: se recorta hacia adentro (11 %) para
# obtener un lienzo a sangre completa (iOS/Android aplican su propia máscara).
inset = round(W * 0.11)
full = src.crop((inset, inset, W - inset, W - inset))
# Recorte ajustado alrededor de la B para tamaños chicos (favicon).
tight = square_crop(635, 640, 900)

def save(img, name, size):
    out = img.resize((size, size), Image.LANCZOS).convert('RGBA')
    out.save(OUT / name, optimize=True)

save(full, 'apple-touch-icon.png', 180)
save(full, 'icon-192.png', 192)
save(full, 'icon-512.png', 512)
save(tight, 'favicon-64.png', 64)

# Maskable: la B debe quedar dentro del círculo de safe area (80 % del lado). Fondo = degradé radial
# oscuro con los colores del borde del asset aprobado (sin volver a difuminar la B); el recorte nítido
# se pega más chico, con borde suave para que no se vea el empalme.
S = 512
def avg(img, pts):
    px = [img.getpixel(p) for p in pts]
    return tuple(round(sum(c[i] for c in px) / len(px)) for i in range(3))
w = full.size[0]
edge = avg(full, [(6, w // 2), (w - 7, w // 2), (w // 2, 6), (w // 2, w - 7), (30, 30), (w - 31, 30), (30, w - 31), (w - 31, w - 31)])
center = tuple(min(255, round(c * 1.25) + 2) for c in edge)
grad = Image.radial_gradient('L').resize((S, S), Image.LANCZOS)  # 0 en el centro -> 255 en el borde
bg = Image.composite(Image.new('RGB', (S, S), edge), Image.new('RGB', (S, S), center), grad).convert('RGBA')
inner_side = round(S * 0.70)
inner = full.resize((inner_side, inner_side), Image.LANCZOS)
mask = Image.new('L', (inner_side, inner_side), 0)
feather = 18
mask.paste(255, (feather, feather, inner_side - feather, inner_side - feather))
mask = mask.filter(ImageFilter.GaussianBlur(feather / 1.5))
off = (S - inner_side) // 2
bg.paste(inner, (off, off), mask)
bg.save(OUT / 'icon-512-maskable.png', optimize=True)
print('ok')
