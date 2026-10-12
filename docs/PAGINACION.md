# Paginación real — auditoría y cambios (rama `feat/paginacion-pendiente`)

Fecha: 2026-10-06. Ramas: `feat/paginacion-pendiente` en `Ecolacteos-Web` y en `acopio-backend-fase2` (backend en `ecolacteos-backend/`).

"Paginación real" = `page`/`size` enviados al backend, consulta paginada en la BD (`LIMIT/OFFSET` + `count`), respuesta `PaginaResponse` y controles ‹ › en Angular. Nada se descarga completo para dividirse después.

## Criterios comunes

- **Backend**: `Paginacion.de(page, size)` (controller): `page < 0 → 0`, `size` acotado a `1..100` (mismo criterio que ya aplicaban inline los endpoints paginados; se sanea en vez de responder 400). Tamaño por defecto 20.
- **Orden estable**: todo listado paginado termina en una columna única (`id`). Se agregó también el desempate a Ventas, Recepción, Informes y Lotes, que ya paginaban sin él.
- **Búsqueda de texto**: en la BD, `LOWER(col) LIKE patrón` con comodines del usuario escapados (`BusquedaTexto`, `ESCAPE '!'`).
- **Contratos móviles intactos**: cuando un endpoint lo consume la app móvil (KMP), no se cambió su forma; se agregó una variante `/paginado`.
- **Frontend**: patrón de `ventas-page` (`pagina`, `totalPaginas`, `irAPagina`). Al cambiar filtros o búsqueda se vuelve a la página 0; la búsqueda usa debounce de 350 ms y cancela la petición anterior. `paginaCorregida()` (shared/util/paginacion.ts) vuelve a pedir la última página válida si la actual quedó vacía (p. ej. al desactivar el último registro con filtro "activos"). Listas sin `ui-data-table` usan `ui-paginador`.
- **Totales globales**: nunca se calculan con la página visible (precio vigente y gráfico de acopios por proveedor tienen endpoint propio).

## Implementado

| Módulo / vista | Endpoint web | Cambio de contrato |
|---|---|---|
| Pagos — `pagos-page` | `GET /api/pagos?page&size` | `List` → `PaginaResponse` (solo web). |
| Proveedor › pestaña Pagos | `GET /api/pagos/proveedor/{id}/paginado` | Nuevo. `/proveedor/{id}` sin cambios (app móvil). |
| Comunicados — `comunicados-page` | `GET /api/comunicados?page&size` | `List` → `PaginaResponse` (la app móvil usa `/zona/{id}`). Tras publicar se recarga la página 0. |
| Precios › Leche — `precios-page` | `GET /api/admin/precios-litro?page&size` + `GET /api/admin/precios-litro/vigente` | `List` → `PaginaResponse`; vigente nuevo (200 o 204). |
| Acopios › Por entrega | `GET /api/registros-acopio/paginado` (`fecha, zonaId, sinAnalisis, busqueda`) | Nuevo. |
| Acopios › Por jornada | `GET /api/registros-acopio/por-jornada` | Nuevo: agrupado en SQL sobre todo el filtro y luego paginado (antes se agrupaba en el navegador y se pedía `GET /jornadas/{id}` por fila). |
| Acopios › gráfico por proveedor | `GET /api/registros-acopio/resumen-por-proveedor` | Nuevo: totales globales del filtro. |
| Historial de entregas (diálogo) | `GET /api/registros-acopio/proveedor/{id}/paginado` | Nuevo. `/proveedor/{id}` sin cambios (app móvil). |
| Usuarios — `usuarios-page` | `GET /api/admin/usuarios/paginado` (`rol, activo, busqueda`) | Nuevo; filtros antes en el cliente. |
| Acopiadores — `acopiadores-page` | `GET /api/admin/usuarios/paginado?rol=ACOPIADOR` | Nuevo. El selector de responsable pide la lista completa solo al abrir el formulario. |
| Inventario › historial de ajustes | `GET /api/inventario/ajustes?presentacionId&page&size` | `List` → `PaginaResponse` (único consumidor: el diálogo). |
| Proveedores — búsqueda | `GET /api/proveedores?busqueda=` | Parámetro nuevo opcional; antes filtraba solo la página descargada. |

Sin cambios de contrato y conservados a propósito: `GET /api/registros-acopio` (app móvil y bandeja de Calidad), `GET /api/registros-acopio/proveedor/{id}`, `GET /api/pagos/proveedor/{id}`, `GET /api/admin/usuarios` (selectores).

## Revisados y dejados sin paginar

| Listado | Motivo |
|---|---|
| Catálogos: zonas, motivos, familias, productos/presentaciones, insumos, recetas, configuración, roles | Tablas maestras pequeñas y de crecimiento manual; además alimentan selectores que necesitan la lista completa. |
| Unidades (flota) | Catálogo pequeño; se usa completo en selectores y para cruzar unidades con acopiadores. |
| Calidad: bandeja del día, búsqueda por folio/registro | Acotados por fecha o por una búsqueda puntual. |
| Calidad / Acopios: pendientes de análisis (`GET /registros-acopio?sinAnalisis=true&fecha=`) | Acotado a un día; contrato compartido con la app móvil. |
| Alertas por zona | El backend ya limita a los últimos 30 días. |
| Jornadas: bandeja de recepción | Solo jornadas `REGRESANDO_A_PLANTA` (en curso), no histórico. |
| Rutas por zona | Una fila por proveedor de la zona; la pantalla reordena la ruta completa. |
| Confirmaciones de un comunicado | Acotado a los proveedores de las zonas destino. |
| Ajustes de un pago / ajustes pendientes por proveedor | Acotados por un pago o por los pendientes (se liquidan). |
| Historial de zonas de un proveedor, correcciones de un registro, acopios de una jornada | Acotados por una entidad y de pocas filas. |
| Historial de precios por presentación (diálogo de Productos) | Pocas filas (3 modalidades × cambios de precio esporádicos) y el diálogo deduce el estado de cada modalidad de la serie completa. |
| `GET /api/proveedores/operativo` | Selector de proveedores (Pagos, Calidad, Rutas) y contrato de la app móvil. **Riesgo**: crece con el padrón; si llega a miles conviene un autocompletado con búsqueda en el servidor. |

## Verificación

- Backend: `mvn -o test -Dtest='!*IntegrationTest'` → 384 pruebas, 0 fallos (incluye `PaginacionPendienteWebMvcTest`, `PaginacionPendienteServiceTest` y casos nuevos en `RegistroAcopioServiceTest`, `ProveedorServiceTest`, `AjusteInventarioServiceTest`).
- Frontend: `ng test --watch=false` → 76 archivos, 472 pruebas, 0 fallos; `ng build` OK.
- **No verificado (Docker apagado)**: `PaginacionPendienteIntegrationTest` (Testcontainers/PostgreSQL), que valida las queries nativas nuevas (casts, `ESCAPE '!'`, `ARRAY_AGG` y el `countQuery` de la agrupación por jornada, búsqueda de usuarios). Ejecutar con Docker: `mvn test -Dtest=PaginacionPendienteIntegrationTest`.
