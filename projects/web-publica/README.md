# EcoLácteos Huata — web pública (Fase 6)

Aplicación Angular **independiente del panel interno**: catálogo con disponibilidad, reservas sin pago en línea y consulta de la reserva con código + teléfono. Vive en el mismo repositorio y workspace (`projects/web-publica`) para compartir `node_modules` y la configuración de TypeScript, pero se ejecuta, compila y prueba por separado y **no importa nada del panel** (`src/`): ni `Shell`, ni autenticación, ni el interceptor de tokens.

## Ejecutar

```bash
npm install                  # una vez
npm run start:publica        # http://localhost:4300  (proxy /api → http://localhost:8080)
npm run build:publica        # dist/web-publica/browser
npm run test:publica         # pruebas unitarias
```

- **Desarrollo:** `projects/web-publica/proxy.conf.js` redirige `/api` al backend (por defecto `http://localhost:8080`), así que no hace falta CORS (el proxy quita la cabecera `Origin`, que el navegador envía en los POST y que el backend rechazaría con 403 por no estar en `CORS_ALLOWED_ORIGINS`). Para otro backend: `ng serve web-publica --proxy-config otro.json`.
- **Producción:** `environment.ts` → `apiOrigin`. Vacío (por defecto) = mismo origen: sirve `dist/web-publica/browser` y reenvía `/api` al backend con un proxy inverso. Si el backend está en otro dominio, escribe su origen (p. ej. `https://api.midominio.pe`) y agrega el origen de la web a `CORS_ALLOWED_ORIGINS` del backend. **Ojo:** con un proxy inverso, el navegador también envía `Origin` en los POST; o el proxy la quita, o el origen de la web debe estar en `CORS_ALLOWED_ORIGINS`; de lo contrario las reservas fallan con 403. La web no tiene secretos ni credenciales.
- Es una SPA: el servidor debe devolver `index.html` para cualquier ruta que no sea un archivo (fallback SPA).
- El panel sigue con `npm start` / `npm run build` / `npm test` (ahora apuntan explícitamente a `ecolacteos-web`).

## Estructura

```
projects/web-publica/
  public/            logo, icono, favicon, robots.txt
  proxy.conf.js      proxy de desarrollo (quita la cabecera Origin)
  src/
    environments/    apiOrigin (desarrollo / producción)
    styles.css       tokens de diseño (paleta) y utilidades compartidas
    app/
      config/sitio.config.ts   ← CONTENIDO de la empresa (textos, contacto, redes)
      core/api/        modelos y clientes HTTP de los endpoints públicos, errores
      core/state/      catálogo y borrador de reserva (signals)
      shared/          tarjeta de producto, estados de carga/error, formato
      pages/           inicio, catálogo, producto, reservar, consultar, quiénes somos, contacto, FAQ
```

## Endpoints que consume (todos públicos, sin token)

| Uso | Endpoint |
|---|---|
| Catálogo, precios, disponibilidad, fotos | `GET /api/catalogo/productos` · `GET /api/catalogo/fotos/{archivo}` |
| Reglas de reserva (fechas válidas, máximo de unidades) | `GET /api/catalogo/reservas/reglas` *(añadido en esta fase, solo lectura)* |
| Crear una reserva (idempotente por `uuidCliente`) | `POST /api/catalogo/reservas` |
| Consultar la propia reserva | `POST /api/catalogo/reservas/consulta` |

Con pocas unidades el catálogo informa cuántas quedan (`unidadesDisponibles`); la web las muestra y limita las cantidades, pero el servidor valida siempre al reservar.

El backend es la fuente de verdad: la web no calcula disponibilidad, FEFO, vencimientos ni cobertura; no confirma reservas (muestra el estado que devuelve el servidor) y no cobra. Las fotos llegan como ruta relativa (`/api/catalogo/fotos/…`) y se resuelven contra `apiOrigin`.

## Completar el contenido real

Todo está en `src/app/config/sitio.config.ts`. **Un valor vacío (`''`) oculta su elemento**: no se muestra nada inventado.

| Dato | Campo | Si está vacío |
|---|---|---|
| WhatsApp (solo dígitos con país, p. ej. `51999999999`) | `contacto.whatsapp` | no hay botón flotante ni enlaces de WhatsApp |
| Teléfono, correo | `contacto.telefono`, `contacto.correo` | no se muestran |
| Dirección, referencia, horario | `contacto.direccion`, `contacto.referencia`, `contacto.horario` | no se muestran |
| Google Maps | `contacto.mapaUrl` | no hay botón «Cómo llegar» |
| Redes | `contacto.redes.*` | no aparecen en el pie |
| Textos de portada | `portada.*` | — |
| Quiénes somos | `quienesSomos.*` | texto **provisional** (neutral, solo afirma lo que el sistema hace); reemplázalo por el oficial |

Las **preguntas frecuentes** (`pages/faqs/faqs.ts`) describen el funcionamiento real de las reservas; no incluyen políticas de pago, entrega ni devolución porque aún no están definidas: agrégalas ahí cuando existan.

## Diseño

Paleta del encargo (verde bosque `#245C43`, crema `#F8F6EF`, blanco, salvia `#D9E8D8`, dorado `#D9AD58` solo como acento, carbón `#29332D`) ajustada al logo oficial (azul `#052F45` en títulos, pie y marca; verde pasto solo en la palabra «LÁCTEOS»). Títulos en **Inter Tight ExtraBold** (autoalojada en `public/fonts`, licencia SIL OFL, interlineado y espaciado ajustados); texto en la fuente del sistema. Para cambiar la tipografía basta con `--font-display` / `--font-body` y el `@font-face` de `styles.css`. Los contrastes calculados están en la cabecera de `styles.css`. Referencias: encabezado limpio y portada con fotografía (Conga), tarjetas de producto y pie de varias columnas (Bonle), catálogo con filtros, disponibilidad y precios visibles (Organa).

## Pruebas

Unitarias (Vitest vía `ng test web-publica`): almacenes, formularios, validaciones, idempotencia (clics repetidos y reintentos), errores del servidor, ausencia de credenciales en las peticiones y navegación. Verificado además en un navegador contra un backend de pruebas con base de datos temporal (ver `docs/REGISTRO.md`).
