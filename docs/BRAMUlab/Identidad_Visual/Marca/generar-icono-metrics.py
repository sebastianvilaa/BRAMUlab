#!/usr/bin/env python3
"""BRAMU Metrics — genera el ícono propio de la consola (velocímetro / indicador de rendimiento).

Uso (desde cualquier carpeta; requiere Pillow):
    python3 generar-icono-metrics.py

Produce:
  - BRAMUMetrics-IconoApp.svg                 master vectorial (esta carpeta)
  - bramulab/admin/metrics/icons/*.png        derivados que usa SOLO /admin/metrics/

Geometría única (un solo lugar): la define este archivo y se emite tanto al SVG como al raster, así no se desalinean.
Sin texto ni iniciales. No reutiliza el isotipo verde (Production) ni el azul (Staging).
"""
import math
import pathlib
from PIL import Image, ImageDraw, ImageFilter

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[3]
OUT = REPO / 'bramulab' / 'admin' / 'metrics' / 'icons'

# --- Paleta (tokens de metrics.css / Identidad_Visual) ---
BG_EDGE = (3, 7, 13)        # #03070D
BG_CENTER = (13, 27, 44)    # #0D1B2C  azul noche, apenas más claro al centro
LIME = (149, 255, 25)       # #95FF19
TRACK = (107, 127, 149)     # #6B7F95  gris azulado
WHITE = (255, 255, 255)

# --- Geometría en un lienzo de 1080 ---
S = 1080
CX, CY = 540, 612           # centro del velocímetro (el conjunto queda centrado verticalmente)
R = 340                     # radio de la línea media del arco
W = 104                     # grosor del arco
A0, A1 = -125.0, 125.0      # barrido total (grados desde la vertical, horario)
A_VAL = 42.0                # hasta dónde llega el arco lima; la aguja apunta ahí (arriba a la derecha)
NEEDLE_LEN, NEEDLE_W = 252, 52
HUB_R = 64


def pt(angle_deg, radius):
    a = math.radians(angle_deg)
    return CX + radius * math.sin(a), CY - radius * math.cos(a)


def svg_arc(a_from, a_to):
    x0, y0 = pt(a_from, R)
    x1, y1 = pt(a_to, R)
    large = 1 if (a_to - a_from) > 180 else 0
    return f'M{x0:.2f} {y0:.2f}A{R} {R} 0 {large} 1 {x1:.2f} {y1:.2f}'


def write_svg(path):
    nx, ny = pt(A_VAL, NEEDLE_LEN)
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" role="img" aria-label="BRAMU Metrics">
  <defs>
    <radialGradient id="bg" cx="50%" cy="46%" r="72%">
      <stop offset="0" stop-color="#0D1B2C"/>
      <stop offset="1" stop-color="#03070D"/>
    </radialGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter>
  </defs>
  <rect width="{S}" height="{S}" fill="url(#bg)"/>
  <path d="{svg_arc(A0, A1)}" fill="none" stroke="#6B7F95" stroke-width="{W}" stroke-linecap="round"/>
  <path d="{svg_arc(A0, A_VAL)}" fill="none" stroke="#95FF19" stroke-width="{W}" stroke-linecap="round" opacity=".55" filter="url(#glow)"/>
  <path d="{svg_arc(A0, A_VAL)}" fill="none" stroke="#95FF19" stroke-width="{W}" stroke-linecap="round"/>
  <line x1="{CX}" y1="{CY}" x2="{nx:.2f}" y2="{ny:.2f}" stroke="#FFFFFF" stroke-width="{NEEDLE_W}" stroke-linecap="round"/>
  <circle cx="{CX}" cy="{CY}" r="{HUB_R}" fill="#FFFFFF"/>
  <circle cx="{CX}" cy="{CY}" r="20" fill="#0D1B2C"/>
</svg>
'''
    path.write_text(svg, encoding='utf-8')


def render_master():
    k = 2  # supersampling
    N = S * k

    # fondo: degradado radial
    bg = Image.new('RGB', (N, N), BG_EDGE)
    px = bg.load()
    cx, cy = N * 0.5, N * 0.46
    rmax = N * 0.72
    for y in range(N):
        for x in range(N):
            d = min(1.0, math.hypot(x - cx, y - cy) / rmax)
            t = 1 - d
            px[x, y] = tuple(int(BG_EDGE[i] + (BG_CENTER[i] - BG_EDGE[i]) * t) for i in range(3))

    def stamp_arc(draw, a_from, a_to, color):
        steps = int(abs(a_to - a_from) * 8) + 1
        r = W * k / 2
        for s in range(steps + 1):
            a = a_from + (a_to - a_from) * s / steps
            x, y = pt(a, R)
            x, y = x * k, y * k
            draw.ellipse((x - r, y - r, x + r, y + r), fill=color)

    img = bg.convert('RGBA')
    track = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    stamp_arc(ImageDraw.Draw(track), A0, A1, TRACK + (255,))
    img.alpha_composite(track)

    lime = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    stamp_arc(ImageDraw.Draw(lime), A0, A_VAL, LIME + (255,))
    glow = lime.filter(ImageFilter.GaussianBlur(26 * k))
    glow.putalpha(glow.getchannel('A').point(lambda v: int(v * 0.55)))
    img.alpha_composite(glow)
    img.alpha_composite(lime)

    top = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(top)
    nx, ny = pt(A_VAL, NEEDLE_LEN)
    steps = 200
    r = NEEDLE_W * k / 2
    for s in range(steps + 1):
        x = (CX + (nx - CX) * s / steps) * k
        y = (CY + (ny - CY) * s / steps) * k
        d.ellipse((x - r, y - r, x + r, y + r), fill=WHITE + (255,))
    d.ellipse(((CX - HUB_R) * k, (CY - HUB_R) * k, (CX + HUB_R) * k, (CY + HUB_R) * k), fill=WHITE + (255,))
    d.ellipse(((CX - 20) * k, (CY - 20) * k, (CX + 20) * k, (CY + 20) * k), fill=BG_CENTER + (255,))
    img.alpha_composite(top)
    return img.convert('RGB').resize((S, S), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    write_svg(HERE / 'BRAMUMetrics-IconoApp.svg')
    master = render_master()
    for name, size in [('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512), ('favicon-64.png', 64), ('favicon-32.png', 32)]:
        master.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)  # opacos (iOS no admite transparencia)
    master.save(HERE / 'BRAMUMetrics-IconoApp-1080.png', optimize=True)
    print('ok ->', OUT)


if __name__ == '__main__':
    main()
