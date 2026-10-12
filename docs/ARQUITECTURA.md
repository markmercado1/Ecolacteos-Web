# Arquitectura Angular

## Estado

Implementada en Fase 1 (2026-09-16). Versiones reales instaladas en este entorno:

- Node.js v22.16.0, npm 10.9.2.
- Angular CLI 21.2.24 / Angular 21.2.23 (elegido por ser la última LTS compatible con el Node instalado; Angular 22 exige Node ≥22.22.3/24.15/26 y no era instalable aquí).
- TypeScript ~5.9.2, RxJS ~7.8.
- @angular/cdk 21.2.14 (Overlay + Dialog, para foco/trampa de foco/Escape accesibles en los diálogos).
- Vitest 4.1.11 como test runner (elegido por el propio esquema de `ng new` en Angular 21; Karma sigue disponible pero ya no es el runner por defecto).
- Angular 21 genera aplicaciones **zoneless** por defecto (no se instaló `zone.js`; no hay `provideZoneChangeDetection` en `app.config.ts`). La reactividad de plantillas se apoya en signals (`input()`, `signal()`, `computed()`, `toSignal()`), confirmado con `ng build`/`ng test` reales, no supuesto.
- Instalación: `npm install --legacy-peer-deps`. Necesario porque `npm install` sin esa bandera falla con un bug conocido de npm/arborist (`Cannot read properties of null (reading 'edgesOut')`) al resolver los peer dependencies opcionales de Vitest 4; no es una relajación arbitraria de compatibilidad de Angular.

Comandos reales (`package.json`):
- `npm start` → `ng serve` (dev server, http://localhost:4200/ por defecto).
- `npm run build` → `ng build` (producción; hay build de `development` vía `ng build --configuration development`).
- `npm test` → `ng test` (Vitest, un solo run; no queda en modo watch).
- `npm run watch` → build en modo desarrollo con watch.

## Organización

- `src/app/core/auth`: identidad, tokens, renovación y guards.
- `src/app/core/http`: base URL, interceptores y traducción de errores.
- `src/app/core/layout`: shell y navegación.
- `src/app/shared/ui`: botones, campos, tablas, diálogos, estados, tarjetas y presentación de gráficos.
- `src/app/shared/models`: PaginaResponse/ErrorResponse y tipos comunes.
- `src/app/features/{auth,usuarios,acopiadores,unidades,proveedores,catalogos,rutas,comunicados,pagos,ventas,supervision,panel}`.
- Dentro de cada feature: `data-access` (API/modelos), `pages`, `ui`.
- `src/styles/theme.css`: única fuente de tokens; integrar la referencia inicial allí.
- `src/styles.css`: base, imports de tema y utilidades mínimas.
- `docs`: contratos, continuidad y evidencias.

Usar componentes standalone, rutas por feature con carga diferida y formularios reactivos tipados. Usar las capacidades de la versión instalada; no introducir store global pesado sin necesidad. HttpClient/observables para HTTP; estado local simple y mecanismos Angular coherentes con la versión elegida.

## Contratos

Interfaces request y response separadas. No reutilizar entidad de tabla como payload. UUID string; LocalDate string ISO sin conversión UTC; LocalDateTime sin offset no debe tratarse como UTC por defecto. Conservar decimales y aplicar redondeo explícito solo para presentación; total confirmado viene del servidor. No usar flotantes acumulados para contabilidad global.

Paginación: contenido, paginaActual, tamanoPagina, totalElementos, totalPaginas. page 0; size 20, 1–100. Lista simple no tiene esos campos.

Los inputs opcionales se omiten o usan null según contrato; no enviar fechas/UUID vacíos. Mantener uuidCliente al reintentar la misma escritura idempotente.

## Sesión y permisos

Authorization: Bearer. Roles reales de /auth/me; guards controlan navegación y backend decide permiso efectivo. ADMIN no se asume exento de reglas de propiedad de servicios.

**Decisión revisada el 2026-09-16** (ver docs/DECISIONES.md): la sesión se persiste en `localStorage` para sobrevivir a un F5 y a cerrar/reabrir el navegador, mientras el refreshToken siga vigente. Reemplaza el default anterior de "solo memoria" a pedido explícito del usuario tras probar el login real contra el backend. No hay cookies HttpOnly disponibles en el contrato (el backend devuelve los tokens en el cuerpo JSON de `LoginResponse`), así que no existe una alternativa que evite guardar el token en un storage legible por JavaScript sin cambiar el backend, algo fuera de alcance de esta fase. El riesgo asumido y mitigado es XSS: nunca se persiste la contraseña, solo token/refreshToken/datos de `/auth/me`; "Cerrar sesión" borra la entrada de inmediato; y la app no usa `innerHTML` con contenido dinámico en ningún componente (los íconos son SVG estático por `@switch`, no `innerHTML`).

Renovación única compartida, exclusión de login/refresh de reintentos, un reintento máximo del request original. 401 terminal lleva a login sin filtrar secretos. 403 muestra permiso insuficiente. Logout limpia sesión/cachés del usuario y cancela peticiones; no existe logout HTTP.

No repetir automáticamente POST no idempotentes como generar pago o crear usuario. Para ventas reusar uuidCliente.

Implementado en Fase 1 (`src/app/core/auth`): `TokenStoreService` guarda la sesión en un signal en memoria y, en paralelo, en `localStorage` (clave `ecolacteos.sesion.v1`); su constructor la restaura de forma síncrona al arrancar, así que los guards de la navegación inicial ya la ven resuelta (sin parpadeo hacia /login). `AuthService` hace login→/auth/me, expone `renovarSesion()` compartida vía `shareReplay(1)` (un solo POST /auth/refresh-token aunque varios llamantes la disparen a la vez), y programa una renovación proactiva al 80% del tiempo que quede hasta `expiraEn` (un timestamp absoluto, no un contador que se reinicia con cada carga de página). `AuthService.reanudarSesion()`, llamado una vez desde un `provideAppInitializer` en `app.config.ts`, reprograma ese temporizador para una sesión restaurada: si el token de acceso ya venció mientras la pestaña estaba cerrada, el margen calculado es 0 y renueva de inmediato; si el refreshToken también venció, `renovarSesion()` la rechaza y limpia la sesión igual que cualquier renovación fallida. `authInterceptor` adjunta el Bearer, excluye `/auth/login` y `/auth/refresh-token`, y ante un 401 reintenta la petición original una sola vez tras renovar. Si la renovación falla, `logout('expirada')` limpia la sesión (memoria y `localStorage`) y redirige a `/login?motivo=expirada`. "Cerrar sesión" (`logout()` sin motivo) hace exactamente lo mismo salvo por el mensaje: borra la entrada persistida, así que un F5 posterior sí vuelve a pedir login.

## UX de datos

Cada página contempla cargando, vacío, datos, error recuperable, permiso insuficiente y mutación en curso. Conservar filtros en URL donde ayude. Cancelar consultas obsoletas, reiniciar página al filtrar. No convertir error en éxito.

Pestañas de perfil cargadas bajo demanda para evitar N+1 masivos. Resolver nombres con catálogos reutilizables. Si el backend no devuelve dato histórico, no inferirlo de la asignación actual sin aclaración.

Fotos protegidas: GET autenticado a blob, liberar object URL. No poner JWT en query.

## Dependencias y ejecución

Elegir biblioteca de gráficos solo al implementar un caso real; comprobar licencia, accesibilidad y compatibilidad. No instalar simultáneamente varias bibliotecas de componentes. Conservar un diseño uniforme con estilos propios. Fase 1 no agrega ninguna biblioteca de gráficos (los gráficos autorizados por contrato son de Fase 4); tampoco se agrega ninguna librería de componentes UI de terceros: `shared/ui` es código propio sobre `theme.css`, salvo `@angular/cdk` (Overlay/Dialog) para accesibilidad de diálogos.

No hay script `lint` en `package.json` (el scaffold de `ng new` en Angular 21 no incluye ESLint por defecto y no se agregó en Fase 1 por no ser parte del pedido). Las comprobaciones de VALIDACION para Fase 1 usan `npm run build` y `npm test`, que sí existen y se ejecutaron.

