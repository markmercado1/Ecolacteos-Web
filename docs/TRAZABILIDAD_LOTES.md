# Trazabilidad por lote, proveedores de compra y documentos de ingreso

Rama `feature/trazabilidad-lotes-proveedores` (backend y web). Migraciones **V40 a V47**. Este documento resume lo que hay, las reglas y lo que
queda por decidir al desplegar.

## Invariantes (se prueban en cada paso)

- `insumo.stock = SUM(lote_insumo.cantidad_disponible) = SUM(movimiento_insumo.cantidad)` por insumo.
- Por lote: `cantidad_disponible = SUM(movimiento_insumo.cantidad)` de ese lote.
- Los movimientos son inmutables: toda corrección es un movimiento nuevo (conteo, anulación de ingreso, salida, transferencia entre lotes).
- La única excepción autorizada es la **fusión de insumos duplicados**, que reasigna `insumo_id` (auditada en `fusion_insumo`).

## Migraciones (todas aditivas, con reversa documentada en su cabecera)

| V | Qué hace |
|---|---|
| 40 | `movimiento_insumo.orden` (secuencia): orden estable del kardex de insumos. |
| 41 | Fusión de insumos: `norm_texto()`, `insumo.nombre_normalizado`, `insumo.fusionado_en_id`, `fusion_insumo`, índice único del nombre (se crea solo cuando no quedan duplicados: `asegurar_indice_unico_insumo()`). |
| 42 | Proveedores de compra: `categoria_proveedor` (LECHE, OTROS_INSUMOS), `proveedor_compra` (RUC único), categorías M:N e insumos habituales. **Distintos de los ganaderos** (`proveedor`). |
| 43 | Lotes: `lote_insumo`, `movimiento_insumo.lote_insumo_id`, lote **INICIAL** por insumo con el stock vigente (backfill verificado), índices únicos por lote. |
| 44 | `documento_ingreso` (cabecera) y `lote_insumo.proveedor_id / documento_ingreso_id`. Las líneas del documento son los lotes. |
| 45 | Motivos de salida (MERMA, DERRAME, DEVOLUCION_PROVEEDOR, CONSUMO_MANUAL), `origen_lote = INSUMO`, tipos `ANULACION_INGRESO` y `TRANSFERENCIA_LOTE`. |
| 46 | `adjunto` genérico (foto o PDF del recibo); `texto_extraido` nulo, reservado para OCR (no implementado). |
| 47 | `orden` estable en el kardex de leche y de producto terminado. |

## Reglas de negocio

- **FEFO**: el consumo sale primero del lote que vence antes; sin vencimiento, FIFO por fecha de ingreso. Un movimiento por lote usado.
- **Vencidos**: nunca se consumen en producción ni cuentan como stock disponible; solo salen con una **salida por vencimiento** (que toma primero los vencidos).
- **Estado del lote** (calculado): VIGENTE, POR_VENCER (≤ 15 días, `app.insumos.dias-alerta-vencimiento`), VENCIDO, AGOTADO.
- **Conteo físico por lote** (solo ADMIN): una cantidad contada por lote; la diferencia queda como ajuste en ese lote. Con un solo lote, atajo de una sola cantidad.
- **Anulación de ingreso** (solo ADMIN): reversa el lote completo si no se usó; si se usó, se corrige con un conteo.
- **Elegir lotes a mano** al iniciar una producción: la suma debe ser exacta y no se aceptan lotes vencidos.
- **Unicidad de insumos** sin mayúsculas, tildes ni espacios sobrantes; herramienta de **fusión** (Inventario > Insumos > «Insumos duplicados»).

## Pantallas

- Inventario > Insumos: «Kardex y lotes» (pestañas Kardex y Lotes, filtro por lote, Excel), «Registrar ingreso» (documento con líneas por lote, proveedor
  con «+ Nuevo proveedor», recibo opcional), «Registrar salida» (motivo y lote), «Conteo físico», alertas de vencimiento, importar ingresos y saldos iniciales.
- Proveedores y pagos > **Proveedores de compra** (solo ADMIN): categorías como chips, RUC único.
- Producción > **Trazabilidad** (PRODUCCION, CALIDAD, ADMIN): por código de lote de insumo (o del proveedor) o por id de un lote de producción.

## Importación y exportación Excel (mismo patrón que el resto)

- Exportar: `/api/exportaciones/kardex-insumo/{id}` (respeta fechas y lote) y `/api/exportaciones/lotes-insumo`.
- Importar `ingresos-insumo` y `saldos-iniciales` (solo ADMIN): vista previa por fila y columna, sin importación parcial salvo confirmación expresa,
  documentos agrupados, proveedor nuevo creado por RUC, archivo ya importado rechazado. **Saldos iniciales**: reemplazan el lote INICIAL por lotes reales;
  la suma por insumo debe ser exactamente su stock (no cambia el stock) y el traslado queda como dos movimientos `TRANSFERENCIA_LOTE`.

## Adjuntos

JPG, PNG, WEBP o PDF, máximo 10 MB; el tipo se valida por el contenido del archivo. Se guardan **fuera de la BD y del código**, en la carpeta indicada por la
variable de entorno `APP_ADJUNTOS_DIRECTORIO` (propiedad `app.adjuntos.directorio`, por defecto `uploads/adjuntos`). Acceso: PRODUCCION, CALIDAD y ADMIN
(adjuntar: PRODUCCION y ADMIN).

## Pendiente antes de producción

1. **Respaldo** de la base real y **prueba de la cadena V40 a V47 sobre datos reales** (ya probada sobre una copia del respaldo de desarrollo del 2026-10-29).
2. Definir la ubicación definitiva de los adjuntos y su respaldo (volumen persistente si el servidor es efímero).
3. Fusionar `azucar` y `Azúcar` (el índice único del nombre se crea solo al quedar sin duplicados).
4. El kardex de leche y de producto ya tiene orden estable (V47); no hay otros cambios en esos libros.
