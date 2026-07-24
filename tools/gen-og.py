#!/usr/bin/env python3
"""Genera las imágenes Open Graph (1200x630) de los productos Velkin.

Misma familia visual que /home/jal/velkin/assets/og/og-image.jpg:
logo arriba-izquierda, titular editorial Archivo 800 con la última línea en
el acento de la marca, dominio abajo-izquierda y tags mono abajo-derecha.
Se renderiza a 2x y se reduce con LANCZOS para curvas limpias.
"""
import os
import urllib.request

from PIL import Image, ImageDraw, ImageFont

S = 2  # supersampling
W, H = 1200 * S, 630 * S
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".fonts")

# Las fuentes de marca no están instaladas en el sistema; se cachean aquí a la
# primera corrida (OFL, se descargan del repo google/fonts).
_GF = "https://raw.githubusercontent.com/google/fonts/main/ofl"
_SOURCES = {
    "Archivo-VF.ttf": f"{_GF}/archivo/Archivo%5Bwdth,wght%5D.ttf",
    "BarlowCondensed-Black.ttf": f"{_GF}/barlowcondensed/BarlowCondensed-Black.ttf",
    "IBMPlexMono-SemiBold.ttf": f"{_GF}/ibmplexmono/IBMPlexMono-SemiBold.ttf",
    "JetBrainsMono-VF.ttf": f"{_GF}/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf",
}

os.makedirs(FONTS, exist_ok=True)
for _name, _url in _SOURCES.items():
    _dest = os.path.join(FONTS, _name)
    if not os.path.exists(_dest):
        print("descargando", _name)
        urllib.request.urlretrieve(_url, _dest)


def archivo(size, wght=800):
    f = ImageFont.truetype(f"{FONTS}/Archivo-VF.ttf", size)
    f.set_variation_by_axes([wght, 100])  # ejes: Weight, Width
    return f


def barlow(size):
    return ImageFont.truetype(f"{FONTS}/BarlowCondensed-Black.ttf", size)


def plex(size):
    return ImageFont.truetype(f"{FONTS}/IBMPlexMono-SemiBold.ttf", size)


def jbmono(size, wght=700):
    f = ImageFont.truetype(f"{FONTS}/JetBrainsMono-VF.ttf", size)
    f.set_variation_by_axes([wght])
    return f


def tracked(draw, xy, text, font, fill, track=0):
    """Dibuja texto con letter-spacing manual. Devuelve el ancho total."""
    x, y = xy
    for ch in text:
        if draw:
            draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + track
    return x - xy[0] - track


def glow(img, center, radius, color, alpha):
    """Resplandor radial suave sobre la imagen base."""
    g = Image.radial_gradient("L").resize((radius * 2, radius * 2), Image.LANCZOS)
    # el degradado de PIL normaliza al vértice del cuadro: se reescala para que
    # caiga a 0 en el círculo inscrito, si no el recuadro deja una costura recta
    g = g.point(lambda v: int(max(0, 255 - v * 1.4143) * alpha))
    layer = Image.new("RGB", (radius * 2, radius * 2), color)
    img.paste(layer, (center[0] - radius, center[1] - radius), g)


def fit(lines, max_w, start, font_factory):
    """Baja el tamaño hasta que la línea más larga entre en max_w."""
    size = start
    while size > 20:
        f = font_factory(size)
        probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
        if max(probe.textlength(l, font=f) for l in lines) <= max_w:
            return f, size
        size -= 2
    return font_factory(size), size


def base(bg, glows):
    img = Image.new("RGB", (W, H), bg)
    for c, r, col, a in glows:
        glow(img, c, r, col, a)
    return img


def footer(d, domain, tags, dom_col, tag_col):
    fd = plex(17 * S)
    d.text((80 * S, 536 * S), domain, font=fd, fill=dom_col)
    ft = plex(13 * S)
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    total = sum(probe.textlength(ch, font=ft) + 3.2 * S for ch in tags) - 3.2 * S
    tracked(d, (W - 80 * S - total, 540 * S), tags, ft, tag_col, track=3.2 * S)


# ─────────────────────────── SECTOR ───────────────────────────
def sector():
    INK, SNOW, PINE, AMBER, MIST, DIM = "#0A0E13", "#E7E6DD", "#7FD1B8", "#F3B23C", "#9A9A8E", "#5C5B50"
    img = base(INK, [((980 * S, 200 * S), 640 * S, "#16463B", 0.40),
                     ((300 * S, 620 * S), 540 * S, "#171C24", 0.45)])
    d = ImageDraw.Draw(img, "RGBA")

    # ── marca: cuadro con la cinta de pista ámbar (favicon.svg de Sector)
    MK, MX, MY = 58 * S, 80 * S, 56 * S
    k = MK / 100  # escala desde el viewBox 0..100 del favicon
    ribbon = Image.new("RGBA", (MK, MK), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ribbon)
    r = 14 * k  # radio del pincel = mitad del stroke-width (28)
    # M 35 -2 L 35 40 Q 35 68 63 68 L 102 68 — trazo con pincel redondo
    pts = [(35, -6 + i * (46 / 24)) for i in range(25)]
    for t in [i / 60 for i in range(61)]:  # bezier cuadrática (35,40)->(35,68)->(63,68)
        u = 1 - t
        pts.append((u * u * 35 + 2 * u * t * 35 + t * t * 63,
                    u * u * 40 + 2 * u * t * 68 + t * t * 68))
    pts += [(63 + i * (43 / 24), 68) for i in range(25)]
    for px, py in pts:
        rd.ellipse([px * k - r, py * k - r, px * k + r, py * k + r], fill=AMBER)
    rd.ellipse([(49 - 6) * k, (54 - 6) * k, (49 + 6) * k, (54 + 6) * k], fill="#121317")
    mask = Image.new("L", (MK, MK), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, MK - 1, MK - 1], radius=int(15 * k), fill=255)
    plate = Image.new("RGBA", (MK, MK), (0, 0, 0, 0))
    ImageDraw.Draw(plate).rounded_rectangle([0, 0, MK - 1, MK - 1], radius=int(15 * k), fill="#0D0F13")
    plate.alpha_composite(Image.composite(ribbon, Image.new("RGBA", (MK, MK), (0, 0, 0, 0)), mask))
    ImageDraw.Draw(plate).rounded_rectangle([0, 0, MK - 1, MK - 1], radius=int(15 * k),
                                            outline=(243, 178, 60, 70), width=max(1, int(1.5 * S)))
    img.paste(plate, (MX, MY), plate)

    tx = MX + MK + 18 * S
    d.text((tx, MY - 5 * S), "SECTOR", font=barlow(46 * S), fill=SNOW)
    tracked(d, (tx + 2 * S, MY + 42 * S), "POWERED BY VELKIN DATA STUDIOS", plex(10 * S), DIM, track=1.9 * S)

    # ── titular
    lines = ["Cada décima", "tiene un lugar."]
    f, size = fit(lines, 1010 * S, 86 * S, archivo)
    y = 218 * S
    for i, l in enumerate(lines):
        d.text((80 * S, y), l, font=f, fill=SNOW if i == 0 else PINE)
        y += int(size * 1.06)

    footer(d, "sector.velkindatastudios.com", "TELEMETRÍA · COACHING · KARTING", MIST, DIM)
    return img


# ───────────────────────── RACING HUB ─────────────────────────
def racing_hub(demo=False):
    INK, SNOW, RUST, AMBER, MIST, DIM = "#0A0E13", "#E7E6DD", "#D2532F", "#F5B342", "#9A9A8E", "#5C5B50"
    img = base(INK, [((1010 * S, 170 * S), 620 * S, "#3A1D12", 0.50),
                     ((260 * S, 640 * S), 540 * S, "#1E1815", 0.45)])
    d = ImageDraw.Draw(img, "RGBA")

    # ── marca: aro con cruceta (favicon del landing)
    MK, MX, MY = 60 * S, 80 * S, 54 * S
    k = MK / 100
    mark = Image.new("RGBA", (MK, MK), (0, 0, 0, 0))
    md = ImageDraw.Draw(mark)
    md.ellipse([(50 - 38) * k, (50 - 38) * k, (50 + 38) * k, (50 + 38) * k],
               outline=RUST, width=max(2, int(11 * k)))
    sw = max(2, int(8 * k))
    for (x1, y1, x2, y2), col in [((50, 63, 50, 82), RUST), ((63, 50, 82, 50), RUST),
                                  ((37, 50, 18, 50), RUST), ((50, 37, 50, 18), AMBER)]:
        md.line([(x1 * k, y1 * k), (x2 * k, y2 * k)], fill=col, width=sw)
    md.ellipse([(50 - 13) * k, (50 - 13) * k, (50 + 13) * k, (50 + 13) * k], fill=AMBER)
    img.paste(mark, (MX, MY), mark)

    tx = MX + MK + 18 * S
    d.text((tx, MY + 2 * S), "Velkin Racing Hub", font=archivo(30 * S, 700), fill=SNOW)
    tracked(d, (tx + 2 * S, MY + 44 * S), "SOFTWARE DE CARRERAS WHITE-LABEL", jbmono(10 * S, 600), DIM, track=1.9 * S)

    # ── semáforo de salida (mismo motivo que el hero del landing)
    ly, lr = 170 * S, 8 * S
    for i in range(5):
        cx = 80 * S + lr + i * 30 * S
        d.ellipse([cx - lr, ly - lr, cx + lr, ly + lr], fill=RUST)
        d.ellipse([cx - lr - 4 * S, ly - lr - 4 * S, cx + lr + 4 * S, ly + lr + 4 * S],
                  outline=(210, 83, 47, 55), width=max(1, int(1 * S)))

    # ── titular
    lines = ["Deja las hojas de cálculo.", "Arranca tu campeonato."]
    f, size = fit(lines, 1010 * S, 76 * S, archivo)
    y = 228 * S
    for i, l in enumerate(lines):
        d.text((80 * S, y), l, font=f, fill=SNOW if i == 0 else AMBER)
        y += int(size * 1.10)

    dom = "racinghub-demo.velkindatastudios.com" if demo else "racinghub.velkindatastudios.com"
    tags = "DEMO ABIERTA · ENTRA Y PRUÉBALA" if demo else "INSCRIPCIONES · RESULTADOS · CAMPEONATO"
    footer(d, dom, tags, MIST, DIM)
    return img


# ─────────── KARTING CLUB MÉXICO (instancia de producción) ───────────
def kcm():
    """Marca del cliente: el logo maestro se pega tal cual (raster cromado),
    nunca se redibuja. Oro #f5c400 sobre asfalto + Barlow Condensed."""
    ASPHALT, GOLD, SNOW, DIM = "#0E0F12", "#F5C400", "#EDEDEA", "#6B6C70"
    img = base(ASPHALT, [((600 * S, 120 * S), 640 * S, "#3A2F08", 0.38),
                         ((600 * S, 660 * S), 620 * S, "#17181C", 0.55)])
    d = ImageDraw.Draw(img, "RGBA")

    logo = Image.open("/home/jal/racing-hub/frontend/public/karting_club_logo.png").convert("RGBA")
    lw = 620 * S
    lh = int(logo.height * lw / logo.width)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    img.paste(logo, ((W - lw) // 2, 104 * S), logo)

    # regla de oro + claim
    ry = 104 * S + lh + 56 * S
    d.line([(W // 2 - 44 * S, ry), (W // 2 + 44 * S, ry)], fill=GOLD, width=max(2, int(3 * S)))
    claim = "RESULTADOS · PARRILLA · CAMPEONATO EN VIVO"
    fc = barlow(40 * S)
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    total = sum(probe.textlength(ch, font=fc) + 3 * S for ch in claim) - 3 * S
    tracked(d, ((W - total) / 2, ry + 30 * S), claim, fc, SNOW, track=3 * S)

    fd = plex(15 * S)
    dom = "kartingclubmexico.velkindatastudios.com"
    d.text(((W - probe.textlength(dom, font=fd)) / 2, ry + 102 * S), dom, font=fd, fill=DIM)
    return img


for name, fn, out in [("kcm", kcm, "/home/jal/racing-hub/frontend/public/og.png"),
                      ("racing-hub-demo", lambda: racing_hub(demo=True),
                       "/home/jal/racing-hub/frontend/public/og-racinghub.png"),
                      ("sector", sector, "/home/jal/sector/public/og.png"),
                      ("racing-hub", racing_hub, "/home/jal/racing-hub/landing/og.png")]:
    im = fn().resize((1200, 630), Image.LANCZOS)
    im.save(out, "PNG", optimize=True)
    print(name, "→", out)
