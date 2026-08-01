# Velkin Data Studios — sitio

Sitio público de la agencia: [velkindatastudios.com](https://velkindatastudios.com). Bilingüe, estático, sin build.

Es una superficie de **marca**, no un producto. Su trabajo es que un dueño de negocio escéptico decida en los primeros segundos que esto se ve serio, y de ahí pase al catálogo de servicios o a los sistemas propios (Sector, Content Hub, Racing Hub). El posicionamiento y a quién le habla están en [`PRODUCT.md`](PRODUCT.md); el sistema visual, en `brand-guidelines.html`.

---

## Estructura

```
index.html               portada
servicios.html           catálogo de servicios
packages.html            paquetes y precios
contacto.html            formulario (envía a Google Apps Script)
portafolio-*.html        un caso por cliente
brand-guidelines.html    sistema de identidad de Velkin
llms.txt                 resumen del sitio para modelos de lenguaje
en/                      ↑ lo mismo, en inglés
assets/                  imágenes y tipografías
tools/
├── gen-csp.py           regenera los hashes de CSP del .htaccess
└── gen-og.py            genera las imágenes 1200×630 de vista previa
gas-contacto.js          código del Apps Script que recibe el formulario
.htaccess                headers de seguridad y CSP (lo sirve LiteSpeed)
```

No hay bundler, ni Node, ni framework. Se editan los HTML y se suben.

---

## Reglas de la casa

**Todo cambio de contenido se replica en `en/` en la misma sesión.** No como pendiente para después: si se toca `servicios.html` y no `en/servicios.html`, el sitio queda con dos versiones distintas de la verdad y nadie se acuerda una semana más tarde.

**Después de tocar cualquier `<script>` inline, correr el generador de CSP:**

```bash
python3 tools/gen-csp.py          # reescribe .htaccess
python3 tools/gen-csp.py --check  # solo avisa si quedó desfasado
```

El sitio es estático sobre LiteSpeed, así que no hay nonce por request como en Sector o Content Hub: la CSP en enforce funciona listando el hash sha256 de cada script inline. Si el hash no cuadra, **el script muere en silencio, sin error en consola**. Es la clase de falla que se descubre tarde y mal.

**Los datos que se publiquen sobre un producto propio se verifican en su repo.** Antes de escribir copy sobre Sector, Content Hub o Racing Hub, leer su README o su código — no confiar en la memoria de lo que hacía hace tres meses.

---

## Vista previa al compartir

`tools/gen-og.py` genera las imágenes 1200×630 de los productos (Sector, la landing de Racing Hub, la app de KCM, la demo de Racing Hub y Content Hub).

```bash
python3 tools/gen-og.py
```

La etiqueta `og:image` **debe apuntar a una URL absoluta** o WhatsApp no muestra nada en la vista previa.

---

## Formulario de contacto

`contacto.html` envía a un Google Apps Script cuyo código está versionado aquí en `gas-contacto.js`. Es una copia de referencia: la que corre es la que está pegada en el proyecto de Apps Script. Si se cambia una, hay que cambiar la otra.

---

## Despliegue

Hosting compartido con LiteSpeed. Se suben los archivos tal cual, incluido el `.htaccess`, que es el que aplica los headers de seguridad y la CSP.

> El repo `velora-site` es la versión anterior de este sitio, de cuando la agencia se llamaba Velora Labs. Quedó como archivo histórico; **este es el vigente**.
