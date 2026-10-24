# Exportar e importar Excel

Rama `feature/excel-import-export` (panel) + `feature/excel-import-export` (backend `ecolacteos-backend`). Complementa `TABLAS.md`
(búsqueda, paginación y orden) y `ENDPOINTS.md`.

## Decisiones (del usuario, 2026-10-22)

1. **Importar solo datos maestros** (hoy: proveedores e insumos). Nunca movimientos operativos (acopios, pagos, ventas, reservas,
   lotes, recepción, calidad, kardex, jornadas, informes): tienen reglas (FEFO, precio vigente, conciliación, `uuid_cliente`, auditoría)
   que un Excel se saltaría.
2. **DNI duplicado: se omite y se reporta.** La importación solo **crea**; nunca actualiza lo que ya existe.
3. **Filas con error: se importan solo las válidas**, después de una vista previa y una confirmación explícita. Las inválidas se omiten y
   quedan en un reporte descargable. Un error inesperado al confirmar revierte **todo** (sin registros parciales).

## Exportar

Botón **«Exportar a Excel»** (`ui-exportar-excel`) en el espacio `[toolbar]` de cada tabla. Pide `GET /api/exportaciones/{recurso}` con
los **mismos filtros y la misma búsqueda** que muestra la tabla y **sin page/size**: el archivo trae todas las filas que corresponden,
no las 20 visibles. El archivo se genera en el backend (Apache POI, streaming) y se descarga con el nombre que sugiere el servidor
(`proveedores-20261022-1030.xlsx`).

| Recurso | Roles (igual que el listado de su pantalla) | Filtros |
|---|---|---|
| `proveedores` | ADMIN | `zonaId`, `activo`, `busqueda` |
| `acopios` | ACOPIADOR, ADMIN, CALIDAD, PRODUCCION | `fecha`, `zonaId`, `sinAnalisis`, `busqueda` (una fila por entrega) |
| `pagos` | ADMIN, RECEPCION | `busqueda` |
| `ventas` | VENTAS, ADMIN | `fecha`, `tipoCliente`, `busqueda` (una fila por línea; el total de la venta solo en la primera) |
| `reservas` | VENTAS, ADMIN | `estado`, `fechaRetiro`, `telefono`, `codigo`, `busqueda` |
| `recepciones` | RECEPCION, ADMIN | `unidadId`, `fecha`, `busqueda` |
| `lotes` | PRODUCCION, ADMIN | `fecha`, `productoId`, `estado`, `busqueda` |
| `informes-produccion` | PRODUCCION, ADMIN | `desde`, `hasta`, `busqueda` |
| `stock` | PRODUCCION, VENTAS, ADMIN | `familiaId`, `busqueda` |
| `inventario-insumos` | PRODUCCION, ADMIN | `busqueda` |
| `calidad-analizados` | CALIDAD, ADMIN | `fecha` (sin fecha, hoy), `busqueda` |
| `alertas-anomalia` | CALIDAD, ADMIN | `zonaId` (obligatoria), `busqueda` |
| `jornadas` | RECEPCION, ADMIN | `busqueda` |
| `usuarios` | ADMIN | `rol`, `activo`, `busqueda` (nunca contraseñas) |
| `precios-litro` | ADMIN | — |
| `precios-presentacion` | ADMIN | `familiaId`, `busqueda` |
| `zonas`, `motivos-observacion`, `familias`, `productos`, `insumos`, `configuracion`, `unidades` | ADMIN | `busqueda` |
| `recetas` | PRODUCCION, ADMIN | `incluirInactivas` (por defecto true), `busqueda` |

- **Permisos:** `@PreAuthorize` en el backend (`ExportacionController`, `ExportacionAdminController`). El archivo solo usa campos del DTO
  de la tabla: DNI y teléfono de proveedores solo salen para ADMIN. Un rol rechazado no llega a consultar datos (prueba de matriz
  24 rutas × 6 roles).
- **Catálogos y listas que el backend entrega completas:** aceptan `busqueda` y filtran con el criterio de las tablas (contiene, sin
  mayúsculas ni acentos) sobre las columnas exportadas.
- **Fórmulas:** un texto que empieza con `=`, `+`, `-` o `@` (o tabulador / retorno de carro) se escribe con una comilla simple delante y
  siempre como celda de texto; nunca se escribe una fórmula. Un número o teléfono con signo (`+51 987 654 321`) no se toca.
- **Tope:** `app.excel.exportacion.max-filas` (50 000). Una consulta mayor se rechaza con 400 pidiendo filtros (se comprueba antes de
  armar el archivo; si fallara a mitad, la respuesta es un error JSON normal, nunca un xlsx a medias).
- **Memoria:** las filas se piden en lotes de `app.excel.exportacion.lote` (500) y el libro se arma en streaming (SXSSF, 100 filas en
  memoria) hacia un archivo temporal que se borra al leerse. Los temporales abandonados de más de 1 h se barren en la siguiente
  exportación.
- **Consistencia:** el recorrido por páginas es una «foto casi consistente»: si alguien crea registros mientras se exporta, pueden correrse
  las páginas. Es aceptable para reportes de gestión.

## Importar

Solo **ADMIN** (validado en el backend). Dos botones: **Proveedores → «Importar desde Excel»** y **Catálogos → Insumos → «Importar desde
Excel»**.

Flujo (`ImportarExcelDialog`):

1. **Plantilla oficial.** `GET /api/admin/importaciones/{tipo}/plantilla` (`proveedores`, `insumos`): hoja «Instrucciones» (reglas,
   formato y ejemplo de cada columna), hoja «Datos» (encabezados; los obligatorios llevan « *»), listas desplegables (zonas reales; unidades
   sugeridas) y la identidad de la plantilla (marca, tipo y versión) en una hoja **muy oculta** `_plantilla`. DNI y teléfono vienen
   formateados como **texto**.
2. **Vista previa.** `POST /api/admin/importaciones/{tipo}/previsualizar` (multipart `archivo`). Valida y devuelve las filas con su estado:
   `VALIDA`, `INVALIDA`, `DUPLICADA` (ya existe, o repetida en el archivo) y el conteo de filas en blanco (`omitidas`). **No crea ningún dato
   de negocio**: solo guarda la vista previa en `importacion_excel` (V26) con las filas ya validadas por el servidor.
3. **Confirmación.** `POST /api/admin/importaciones/{id}/confirmar`: crea exactamente lo que se vio, en **una transacción**, llamando a los
   servicios de negocio. Vigencia de la vista previa: 30 min (`app.excel.importacion.vigencia-minutos`).
4. **Reporte.** `GET /api/admin/importaciones/{id}/reporte`: `.xlsx` con fila, resultado, motivo y los valores de las filas no importadas
   (también se puede bajar antes de confirmar). `DELETE /api/admin/importaciones/{id}` descarta una vista previa.

### Qué se valida

| Tipo | Columnas | Reglas |
|---|---|---|
| Proveedores (plantilla **v2**, Fase G) | Tipo de persona, Nombre completo, DNI, RUC, Razón social, Teléfono, Zona | **Tipo** «Persona natural» (por defecto) o «Empresa». Persona natural: nombre (≤ 150) y **DNI de 8 dígitos** obligatorios (si Excel lo guardó como número se completa con ceros a la izquierda), RUC opcional = 10 + DNI + verificador, sin razón social. Empresa: **RUC 20…** (11 dígitos con verificador) y razón social obligatorios, sin DNI; nombre opcional (por defecto, la razón social). Mismas reglas que la pantalla. Teléfono opcional: celular peruano, se guarda como `+519XXXXXXXX`. Zona opcional: una zona **activa** existente, nunca se crea. DNI **o RUC** existente (activo o inactivo) o repetido en el archivo → duplicada. Una plantilla v1 se rechaza. |
| Insumos | Nombre del insumo *, Unidad de medida *, Stock inicial | Nombre ≤ 60, único sin mayúsculas ni acentos (también contra desactivados). Unidad ≤ 20 (la lista solo sugiere). Stock ≥ 0, hasta 2 decimales, coma o punto; vacío = 0. |

Cualquier celda con **fórmula** o **error de Excel** invalida la fila (nunca se evalúa ni se importa su resultado).

### Cómo se crea

- **Proveedores:** `ProveedorService.crear` (QR, historial de zona abierto, aparece en `GET /api/sync/cambios` para la app móvil).
- **Insumos:** `InsumoService.crear`: el stock inicial es el `SALDO_INICIAL` del kardex del insumo (sin stock, sin movimiento). La importación
  **no cambia** el stock de insumos existentes.
- Ninguna importación inserta directamente en la base ni crea un camino de negocio paralelo.

### Garantías

- **Atomicidad:** todas las filas válidas se crean en una transacción; un fallo (regla de negocio, violación de unicidad, error inesperado)
  revierte todo y deja la vista previa intacta para reintentar. El usuario ve un mensaje claro (`No se creó ningún registro…`) sin detalles internos.
- **Idempotencia y concurrencia:** la confirmación toma la importación con `SELECT … FOR UPDATE`. Un doble clic, un reintento o dos pestañas
  esperan y reciben el resultado ya guardado (`yaConfirmada: true`) sin crear nada otra vez. Dos administradores que suben el mismo archivo a
  la vez nunca duplican un DNI: la segunda confirmación omite lo que ya existe o se revierte completa con 409.
- **Cambios entre la vista previa y la confirmación:** si un DNI/nombre se registró o una zona se desactivó entretanto, esa fila se **omite**
  (estado `OMITIDA`) y se informa; el resto se importa.
- **Solo quien subió el archivo** puede confirmarlo, descartarlo o bajar su reporte (403 al resto).

### Seguridad de los archivos (`LectorExcelSeguro`)

Solo `.xlsx` (no `.xls`/`.xlsm`/`.csv`); tamaño máximo `app.excel.importacion.max-bytes` (2 MB); firma de zip; máximo
`…max-entradas-zip` (100) componentes y `…max-bytes-descomprimidos` (25 MB) descomprimidos (zip bombs); sin rutas `../`; **sin macros VBA,
controles ActiveX, objetos OLE/incrustados, vínculos externos ni personalizaciones de cinta**; máximo `…max-filas` (2 000) filas con datos y
`…max-filas-fisicas` (10 000) recorridas. Cualquier fallo de POI se informa como «archivo no válido». Plantilla de otro tipo, versión vieja o
nueva, encabezados cambiados/duplicados/extra, o sin la marca oficial → rechazado antes de leer una sola fila. Un archivo rechazado no deja
rastro (ni datos ni vista previa).

### Agregar un tipo nuevo (precios, productos, presentaciones…)

Crear un bean `TipoImportacion<C>` (`codigo`, `titulo`, `version`, `columnas`, `validar`, `claveUnica`, `conflictoAlConfirmar`, `crear`):
plantilla, lectura segura, vista previa, confirmación transaccional, reporte y endpoints funcionan solos. `crear` debe llamar al servicio de
negocio existente. En el panel, abrir `ImportarExcelDialog` con `{ tipo, nombre }` y agregar el tipo a `TipoImportacion`. **No** se debe
agregar un tipo de movimiento operativo.

## Configuración (`application.yml`, opcional)

`app.excel.exportacion.max-filas` (50000) · `…exportacion.lote` (500) · `…importacion.max-bytes` (2097152) · `…importacion.max-filas` (2000) ·
`…importacion.max-filas-fisicas` (10000) · `…importacion.max-entradas-zip` (100) · `…importacion.max-bytes-descomprimidos` (26214400) ·
`…importacion.vigencia-minutos` (30).

## Pruebas

- Backend unitarias/WebMvc: `mvn test "-Dtest=!com.planta.acopio.integration.**"`.
- Integración en PostgreSQL real: `mvn test "-Dtest=com.planta.acopio.integration.**"` (Testcontainers, requiere Docker). **Sin Docker:**
  levantar un PostgreSQL temporal (`initdb` + `pg_ctl`, `max_connections` alto porque cada clase tiene su base y su contexto de Spring) y
  definir `ECO_TEST_PG_ADMIN_URL=jdbc:postgresql://127.0.0.1:55432/postgres` (y, si hace falta, `ECO_TEST_PG_USER` / `ECO_TEST_PG_PASSWORD`):
  `PostgresDePrueba` crea una base nueva por clase. Las pruebas de integración **existentes** siguen usando Testcontainers; para correrlas sin
  Docker hay que redirigir su datasource a `PostgresDePrueba` (se hizo con un parche temporal, no versionado).
- Panel: `npm test` y `npm run build`.

## Limitaciones conocidas

- Solo proveedores e insumos se importan; precios, productos y presentaciones quedan preparados (nuevo `TipoImportacion`) pero **sin implementar**.
- No hay actualización masiva: un registro existente se omite.
- La exportación de **Comunicados**, el **panel económico**, la búsqueda por folio de Calidad y los historiales de los diálogos no tienen Excel.
- Los motivos de rechazo se muestran en español; el reporte reproduce los valores tal como venían (las fórmulas escritas como texto se neutralizan).
- El límite de 2 000 filas por archivo es deliberado: para cargas mayores, dividir en varios archivos.
