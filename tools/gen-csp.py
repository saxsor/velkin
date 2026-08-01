#!/usr/bin/env python3
"""Regenera la directiva script-src del .htaccess a partir de los HTML del sitio.

El sitio es HTML estático servido por LiteSpeed, así que no hay forma de firmar
los scripts inline con un nonce por request como en Sector y Content Hub: la
única manera de tener CSP en enforce es listar el hash sha256 de cada inline.

Hacerlo a mano es una trampa — al editar cualquier script el hash deja de
cuadrar y el script muere en silencio, sin error visible. De ahí este
generador: después de tocar cualquier <script> inline, correr

    python3 tools/gen-csp.py

y commitear el .htaccess que deja. Sin argumentos reescribe el archivo; con
--check sólo avisa si quedó desactualizado (útil antes de subir al hosting).
"""

import base64
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
START = "    # --- script-src generado por tools/gen-csp.py — no editar a mano ---"
END = "    # --- fin del bloque generado ---"

# Orígenes externos que sí cargan scripts: gtag y el pixel de Meta.
EXTERNAL = [
    "'self'",
    "https://www.googletagmanager.com",
    "https://connect.facebook.net",
]

# <script> sin src, con lo que haya dentro. El hash se calcula sobre el
# contenido exacto entre las etiquetas, que es lo que especifica la CSP.
INLINE_RE = re.compile(
    r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.DOTALL | re.IGNORECASE
)


def html_files():
    return sorted(
        p for p in ROOT.rglob("*.html") if ".git" not in p.parts
    )


def collect_hashes():
    hashes = {}
    for path in html_files():
        for body in INLINE_RE.findall(path.read_text(encoding="utf-8")):
            digest = base64.b64encode(hashlib.sha256(body.encode("utf-8")).digest())
            hashes.setdefault(f"'sha256-{digest.decode()}'", []).append(
                path.relative_to(ROOT).as_posix()
            )
    return hashes


def build_block(hashes):
    sources = EXTERNAL + sorted(hashes)
    joined = " ".join(sources)
    return f'{START}\n    Header always set Content-Security-Policy "default-src \'self\'; script-src {joined}; style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; img-src \'self\' data: https:; font-src \'self\' data: https://fonts.gstatic.com; connect-src \'self\' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com; object-src \'none\'; base-uri \'self\'; form-action \'self\'; frame-ancestors \'none\'"\n{END}'


def main():
    htaccess = ROOT / ".htaccess"
    current = htaccess.read_text(encoding="utf-8")
    hashes = collect_hashes()
    block = build_block(hashes)

    if START not in current:
        sys.exit(f"No encontré el marcador en {htaccess}. ¿Se editó a mano?")

    updated = re.sub(
        re.escape(START) + r".*?" + re.escape(END), block, current, flags=re.DOTALL
    )

    if "--check" in sys.argv:
        if updated != current:
            sys.exit(
                "El .htaccess está desactualizado: corré `python3 tools/gen-csp.py`."
            )
        print(f"OK — {len(hashes)} hashes, .htaccess al día.")
        return

    htaccess.write_text(updated, encoding="utf-8")
    print(f"{len(hashes)} scripts inline distintos en {len(html_files())} archivos:")
    for h, files in sorted(hashes.items(), key=lambda kv: -len(kv[1])):
        print(f"  {h[:26]}…  ×{len(files)}  ({files[0]}{' …' if len(files) > 1 else ''})")


if __name__ == "__main__":
    main()
