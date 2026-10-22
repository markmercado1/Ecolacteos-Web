# Tablas: búsqueda, paginación y orden (estándar)

Rama `feature/tablas-busqueda-paginacion` (panel) + `feature/busqueda-paginacion` (backend, `ecolacteos-backend`).
Complementa `PAGINACION.md` (auditoría de la paginación real en el servidor).

## Piezas reutilizables

| Pieza | Para qué |
|---|---|
| `ui-data-table` | La tabla. Sin cambiar su diseño, ahora trae el buscador en su barra, el paginador en el pie y el resaltado de fila nueva. |
| `ui-buscador` | Caja de búsqueda: espera 350 ms al teclear; busca de inmediato con Enter, al vaciar o con ×; Escape limpia. |
| `ui-paginador` | «Mostrando 21–40 de 87 proveedores», ‹ Anterior, páginas numeradas con «…», Siguiente ›, y selector «Filas» (10/20/50). |
| `ListaLocal<T>` | Búsqueda + paginación + resaltado en el cliente para listas que el backend entrega completas. |
| `shared/util/texto.ts` | `normalizarTexto`/`contieneTexto`: minúsculas y sin acentos (misma tabla de letras que el backend). |

## Dos modos de usar `ui-data-table`

1. **Servidor** (tablas que crecen: proveedores, usuarios, acopios, pagos, ventas, lotes, recepción, informes, reservas,
   comunicados, precios, stock): la página mantiene `busqueda`, `pagina`, `tamano` y llama al API con
   `busqueda`, `page`, `size`. La tabla recibe `[buscable]`, `[pagina]`, `[totalPaginas]`, `[totalElementos]`,
   `[tamano]`, `[tamanos]`, `unidad` y emite `(buscar)`, `(cambiarPagina)`, `(cambiarTamano)`. Cambiar búsqueda o
   tamaño vuelve a la página 0 y cancela la petición anterior.
2. **Cliente** (`[lista]="miListaLocal"`): catálogos, unidades, insumos de inventario y bandeja de jornadas. Solo hay que
   dar `unidad` y los textos del buscador; la tabla toma de la lista filas, buscador, paginador y resaltado.

## Búsqueda

- Por texto contenido, sin distinguir mayúsculas ni acentos, sobre **todo** el conjunto (no solo la página visible).
- Servidor: `LOWER(TRANSLATE(col, 'áéíóúüñ…', 'aeiouun…')) LIKE :busqueda ESCAPE '!'` con el patrón ya plegado en Java
  (`BusquedaTexto.patronLike`); `% _ !` escritos por el usuario se escapan. No requiere extensiones de PostgreSQL.
  Parámetro opcional `busqueda` (si falta, el endpoint se comporta como antes: la app móvil no se ve afectada).

## Orden

- Tablas con fecha de creación: lo más reciente primero, con desempate estable (`creado_en DESC, id DESC`).
  Ventas ganó `creado_en` (migración V25) porque solo tenía la fecha del día y el desempate era un UUID aleatorio.
- Catálogos y unidades (sin fechas de creación; no se agregaron migraciones): orden alfabético sin distinguir
  mayúsculas (`OrdenCatalogo`), y el registro recién creado o editado se muestra en su página y se resalta 4 s
  (`ListaLocal.revelar(id)`).
- Bandeja de jornadas: orden de llegada (FIFO), el mismo que consume la app móvil; `GET /api/jornadas` no cambió.
