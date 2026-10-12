# EcoLácteos Web

Panel administrativo Angular para EcoLácteos. Fase 1 (base, tema y acceso) está implementada; ver docs/ESTADO.md para el detalle de qué falta.

## Ejecutar en desarrollo

Requisitos comprobados en este entorno: Node.js v22.16.0 y npm 10.9.2 (Angular 21 exige Node `^20.19.0 || ^22.12.0 || >=24.0.0`).

```bash
npm install --legacy-peer-deps   # necesario: ver docs/ARQUITECTURA.md sobre el bug de npm/arborist con Vitest 4
npm start                        # ng serve, sirve en http://localhost:4200/
```

Antes de iniciar sesión de verdad, edita `src/environments/environment.development.ts` con la URL real del backend de desarrollo (`apiBaseUrl`); por defecto apunta a `http://localhost:8080/api`, un marcador sin confirmar (ver "Faltantes externos" en docs/ESTADO.md).

Otros comandos reales de `package.json`:

```bash
npm run build      # ng build (producción)
npm test           # ng test (Vitest, una sola corrida)
npm run watch      # build de desarrollo en modo watch
```

## Inicio

Lee AGENTS.md → docs/REGLAS.md → docs/ESTADO.md → docs/DECISIONES.md → docs/FASES.md.

Para retomar sin historial, usa el texto de `CONTINUAR.md`.

## Documentación

| Archivo | Propósito |
|---|---|
| docs/REGLAS.md | Trabajo, fuentes, protección de cambios y cierre de sesión |
| docs/ESTADO.md | Fase activa, evidencias, bloqueos y siguiente paso |
| docs/FASES.md | Cinco fases con alcance y criterios de aceptación |
| docs/DECISIONES.md | Decisiones aceptadas y ampliaciones condicionadas |
| docs/ARQUITECTURA.md | Organización Angular y acceso a datos |
| docs/DISENO.md | Identidad visual, tokens, componentes y gráficos reales |
| docs/ALCANCE.md | Pantallas, límites del backend y propuestas |
| docs/ENDPOINTS.md | Inventario de 98 operaciones HTTP |
| docs/CONTRATOS.md | 28 DTOs de entrada y respuestas exactas |
| docs/VALIDACION.md | Comprobaciones por flujo y criterio de finalización |
| docs/REGISTRO.md | Historial de sesiones, inicialmente solo preparación |
| docs/referencia/EcoLacteos_Web_Admin.html | Copia del diseño proporcionado |
| docs/referencia/theme.css | Base de tokens para integrar en Fase 1 |
| docs/referencia/fuentes-sha256.json | Huellas de las fuentes al preparar estos contratos |

## Fuentes locales

Backend canónico: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend`.

Móvil de referencia: `C:\EcoLacteosProyect\acopio-backend-fase2\acopio-mobile\Ecolacteos-Frontend`.

No utilizar la copia de backend que existe dentro del móvil como fuente de contratos. El diseño no sustituye a los controladores, DTOs, servicios y permisos.

La URL efectiva del servidor y las credenciales de prueba todavía no se han proporcionado. No guardar contraseñas, JWT ni refresh tokens en esta documentación.

