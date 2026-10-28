## Actualización 2026-10-27 — limpieza de módulos (rama sin integrar)

Nuevos POST `/api/inventario/presentaciones/{id}/salidas` y `/api/inventario/insumos/{id}/salidas`, solo ADMIN, HTTP 200 e idempotencia por UUID. Request/response, validaciones, Kardex y V36 detallados en [REORGANIZACION.md](REORGANIZACION.md). Se retiran los endpoints de informes de producción diaria y revisiones de documentos/zonas, incluida su exportación exclusiva. Las referencias anteriores a esos endpoints en este documento son históricas y quedan sustituidas por esta actualización. Pagos e insumos conservan sus contratos previos.

# Contratos exactos del backend

## Ampliación 2026-10-24 (rama `feature/clientes-compradores`, sin integrar): clientes y comprador (Fase H, V33)

- `CrearVentaCarritoRequest` agrega `comprador?: {tipo: 'CLIENTE'|'PROVEEDOR', id}`. `VentaResumenResponse` agrega `comprador: {tipo|null, id|null,
  nombre|null, ruc|null} | null`, `reservaId|null`, `reservaCodigo|null`. `VentaRequest`/`VentaResponse` (móvil) **sin cambios**.
- `ReservaResponse` agrega `comprador` (mismo formato); `CrearReservaRequest` agrega `avisoPrivacidadVersion?`; eventos nuevos
  `COMPRADOR_VINCULADO` y `COMPRADOR_DESVINCULADO`.
- `ClienteResponse {id, tipoPersona, nombre, razonSocial, dni, ruc, correo, telefonos[], mayorista, activo, fusionadoEnId, creadoEn, datosCompletos,
  registro: EstadoAutorizacion, comunicaciones: EstadoAutorizacion}`; `EstadoAutorizacion {vigente, estado, medios[], forma, desde, avisoVersion,
  avisoCompleto}`. `ClienteRequest`, `ComercialRequest`, `CompradorSugerencia`, `HistorialClienteResponse {compras: ComprasResumen, reservas[]}`,
  `CompraResponse` y `AvisoPrivacidadResponse`: ver `ClienteDtos.java` y `cliente.models.ts`.
- `HistorialResumenResponse` agrega `compras: ComprasResumen | null` (solo ADMIN) y la sección `COMPRAS`.

## Ampliación vigente 2026-10-24: documentos del proveedor e IGV configurable (Fase G, V31–V32)

- `ProveedorRequest {nombre, dni|null, telefono|null, zonaActualId|null, tipoPersona?: 'NATURAL'|'EMPRESA' (NATURAL por defecto), ruc?|null, razonSocial?|null}`;
  `ProveedorUpdateRequest {nombre, dni|null, telefono|null, tipoPersona?|null (conserva el actual), ruc?|null, razonSocial?|null}`. Natural: nombre y DNI (8 dígitos) obligatorios, RUC opcional
  = 10 + DNI + verificador, sin razón social. Empresa: RUC 20… y razón social obligatorios, sin DNI, nombre opcional. 400 por forma, 409 por DNI o RUC repetido.
- `ProveedorAdminResponse` agrega `tipoPersona`, `ruc|null`, `razonSocial|null`; `dni` es null en una empresa. `ProveedorPublicoResponse` (móvil) **sin cambios**.
- `GET /api/admin/proveedores/revision-documentos` → `{totalProveedores, proveedoresConObservaciones, observaciones: [{proveedorId, nombre, tipoPersona, dni|null, ruc|null, activo, codigo, detalle}]}`;
  `codigo` ∈ `DNI_FORMATO | DNI_PARECE_RUC | DNI_DUPLICADO_PROBABLE | RUC_INVALIDO | RUC_NO_COINCIDE_DNI | POSIBLE_MISMA_PERSONA`.
- `/api/admin/tributario`: `GET /estado` → `{calculoHabilitado, estado: 'PENDIENTE'|'ACTIVO', tasaVigente|null, tasaProgramada|null, presentacionesActivas, sinDefinir, gravadas, exoneradas,
  inafectas, avisos: string[], ultimoCambio: {habilitado, motivo, usuarioNombre|null, creadoEn}|null}`; `PUT /calculo` `{habilitado, motivo}` → el mismo estado (409 si ya está así);
  `POST /afectaciones/lote` `{afectacion: GRAVADO|EXONERADO|INAFECTO, vigenteDesde, motivo, soloSinDefinir?}` → `{aplicadas, omitidas}`; `GET|POST /tasas-igv` (`{tasa, vigenteDesde, motivo}` → `{id, tasa, vigenteDesde, motivo, usuarioNombre|null, creadoEn}`); `GET /afectaciones?busqueda&page&size` →
  `PaginaResponse<{presentacionId, presentacionNombre, productoId, productoNombre, familiaNombre|null, afectacionVigente, vigenteDesde|null, afectacionProgramada|null, programadaDesde|null}>`;
  `GET|POST /presentaciones/{id}/afectaciones` (`{afectacion: 'GRAVADO'|'EXONERADO'|'INAFECTO'|'SIN_DEFINIR', vigenteDesde, motivo}` → `{id, presentacionId, afectacion, vigenteDesde, motivo,
  usuarioNombre|null, creadoEn}`). 400 por valores fuera de rango o sin motivo; 409 por fecha repetida; 404 presentación inexistente.
- `DetalleVentaResponse` agrega `afectacionIgv|null`, `tasaIgv|null`, `valorVenta|null`, `igv|null` (todo null = sin determinar). `VentaResumenResponse` agrega `igv: {estado: 'SIN_DETERMINAR'|
  'DETERMINADO'|'PARCIAL', incluyeIgv, operacionesGravadas, operacionesExoneradas, operacionesInafectas, igvTotal, montoSinDeterminar}`. `VentaRequest`/`VentaResponse` (móvil) **sin cambios**.
- `GET /api/catalogo/productos`: cada presentación agrega `incluyeIgv: boolean`.
- Plantilla de importación de proveedores **v2**: columnas «Tipo de persona», «Nombre completo», «DNI», «RUC», «Razón social», «Teléfono», «Zona» (ninguna con asterisco: lo obligatorio
  depende del tipo). Una plantilla v1 se rechaza pidiendo descargar la actual.

## Ampliación vigente 2026-10-11: cantidad disponible con pocas unidades (catálogo público)

`GET /api/catalogo/productos`: cada presentación gana `unidadesDisponibles: int | null`. **Solo es un número cuando `disponibilidad = POCAS_UNIDADES`** (unidades que se pueden reservar para la primera fecha de retiro posible, ya descontadas las reservas vigentes); en `DISPONIBLE` y `AGOTADO` es `null`. Cambio aditivo; el resto del contrato de la Fase 3 no cambia.

## Ampliación vigente 2026-10-01: kardex por cantidades (V19)

- `KardexResponse {tipoItem: 'LECHE'|'INSUMO'|'PRESENTACION', itemId|null, itemNombre, unidadMedida, desde|null, hasta|null, saldoInicial, totalEntradas, totalSalidas, saldoFinal, movimientos: PaginaResponse<MovimientoKardexResponse>}`. Totales del rango completo; `saldoFinal = saldoInicial + totalEntradas − totalSalidas`.
- `MovimientoKardexResponse {id, fecha (registro), tipoMovimiento, entrada|null, salida|null (ambas positivas), saldo (acumulado real), documentoTipo: RECEPCION|LOTE|VENTA|AJUSTE|INGRESO|SALDO_INICIAL, documentoId|null, documentoFecha|null, referencia|null, usuarioNombre|null, motivo|null}`. Sin precios ni costos.
- `IngresoInsumoRequest {cantidad (>0, 10+2), referencia? (≤100), observacion? (≤500)}`; `AjusteInsumoRequest {cantidadFisica (≥0, 10+2), motivo (≤500, obligatorio)}`; `MovimientoInsumoResponse {id, insumoId, insumoNombre, unidadMedida, tipoMovimiento, cantidad (con signo), saldoAnterior, saldoResultante, referencia, motivo, usuarioNombre, creadoEn}`.
- `InsumoRequest.stock`: al crear = saldo inicial del kardex; al editar debe omitirse o ser igual al actual (si no, 400).
- Persistencia: `V19__kardex_insumo.sql` (tabla `movimiento_insumo`, append-only, con `SALDO_INICIAL` por cada insumo con stock > 0 al migrar). Leche y producto terminado reutilizan sus libros mayores existentes.

## Ampliación vigente 2026-09-30: recetas y producción planificada/real (V18)

- `RecetaRequest {nombre (≤100), productoId, presentacionId, litrosBase (>0, 7+2), rendimientoBase (>0, 9+3), insumos: RecetaInsumoRequest[] (puede ser vacía)}`; `RecetaInsumoRequest {insumoId, cantidad (>0, 9+3)}`. Cantidades por `litrosBase` de leche, en la unidad del insumo.
- `RecetaResponse {id, nombre, productoId, productoNombre, presentacionId, presentacionNombre, unidadConteo, litrosBase, rendimientoBase, activo, insumos: {insumoId, insumoNombre, unidadMedida, cantidad, insumoActivo}[]}`.
- `DisponibilidadProduccionResponse {litrosSolicitados, factor|null, leche: Linea, insumos: Linea[], cantidadEsperada|null, presentacionNombre|null, unidadConteo|null, todoDisponible, litrosMaximos|null, cantidadEsperadaMaxima|null}`; `Linea {insumoId|null (null = leche), nombre, unidadMedida, requerido, disponible, faltante, suficiente}`.
- `PlanificarLoteRequest {uuidCliente, fecha, recetaId, litros (>0, 7+2)}`; `FinalizarLoteRequest {detalles: DetalleSalidaRequest[], motivoRendimiento? (≤500)}`.
- `LoteProduccionResponse` agrega (aditivo, el móvil los ignora): `estado` (`PLANIFICADA|EN_PRODUCCION|FINALIZADA|CANCELADA`), `recetaId`, `recetaNombre`, `cantidadEsperada`, `presentacionEsperadaId`, `presentacionEsperadaNombre`, `diferencia` (obtenido − esperado, solo FINALIZADA con receta), `iniciadoEn`, `finalizadoEn`, `canceladoEn`. `insumos` = planificados en PLANIFICADA, consumidos desde EN_PRODUCCION.
- `CrearLoteRequest` sin cambios de forma; comportamiento nuevo: los `insumos` enviados se descuentan del stock y se rechaza (400) si no alcanza. El móvil no envía insumos: sin impacto.
- `InsumoRequest.stock` sin cambios; la web lo envía al editar solo si el usuario lo modificó.
- Persistencia: `V18__receta_produccion.sql` (tablas `receta`, `receta_insumo`; columnas `estado`, `receta_id`, `cantidad_esperada`, `iniciado_en`, `finalizado_en`, `cancelado_en` en `lote_produccion`; lotes existentes = FINALIZADA).

## Ampliación vigente 2026-10-11: web pública (Fase 6; un endpoint público de solo lectura)

La web pública (`projects/web-publica`) consume los contratos públicos de las Fases 3 y 4 sin cambiarlos. Se añade:

- **`GET /api/catalogo/reservas/reglas`** (sin token) → `ReglasReservaPublicaResponse { fechasDisponibles: LocalDate[], maxUnidades: int, horasPendiente: int }`. `fechasDisponibles` son, en orden, las fechas de retiro que `ReservaParametros.errorDeFecha` aceptaría **en este momento** (hora de Lima): plazo, días de atención, feriados y hora de cierre ya aplicados. `maxUnidades` = `RESERVA_MAX_UNIDADES`; `horasPendiente` = `RESERVA_HORAS_PENDIENTE`. Respuesta `Cache-Control: no-store`. Informativo: la validación autoritativa sigue ocurriendo en `POST /api/catalogo/reservas`.
- **Fotos:** `fotoUrl` del catálogo es una **ruta relativa** (`/api/catalogo/fotos/{archivo}`); el cliente la resuelve contra el origen de la API. El catálogo **no** incluye descripciones de producto y la consulta pública **no** incluye el motivo de un rechazo o cancelación.

## Ampliación vigente 2026-10-11: panel de reservas (Fase 5; cambios aditivos de solo lectura en el backend)

El panel Angular (`/reservas`, ADMIN y VENTAS) consume los endpoints de la Fase 4 sin cambiarlos; solo se añadieron campos y un filtro que no rompen a ningún consumidor (el móvil no usa estos endpoints).

- **`GET /api/reservas`**: parámetro opcional `codigo` (código de seguimiento exacto; se normaliza a mayúsculas; no coincide → página vacía). `ReservaResumenResponse` gana `sinCobertura: boolean` (mismo criterio que el detalle: solo si la reserva aún compromete unidades —pendiente vigente o confirmada— y sus lotes vendibles ya no la respaldan; la más antigua tiene prioridad).
- **`GET /api/inventario/stock/presentaciones`**: `FilaStockResponse` gana `stockComprometido: int` (unidades separadas por reservas vigentes; 0 si el producto no controla vencimiento) y `stockLibre: int` (máximo que una venta directa puede tomar hoy sin dejar sin cobertura a las reservas; igual a `stock` si el producto no controla vencimiento). `stock` = físico; `stockVendible` = físico menos vencido y sin trazabilidad; ninguno de los dos cambia. Calculados por el backend con `CoberturaReservas` (mismo criterio que valida la venta); el panel solo los muestra.
- **Pantallas:** detalle de reserva con las acciones de la Fase 4; el retiro llama a `POST /api/reservas/{id}/retirar` con una `uuidCliente` estable por apertura del detalle.

## Ampliación vigente 2026-10-11: reservas (Fase 4, SOLO backend)

Sin cambios en el panel Angular (el panel de reservas es la Fase 5; la pantalla Catálogos → Configuración ya lista y edita las claves nuevas) ni en contratos compartidos con el móvil (`VentaRequest`/`VentaResponse`, `ProductoResponse`, etc.). `CrearVentaCarritoRequest` (solo web) gana `reservaId` opcional.

**Qué es una reserva.** Compromete unidades de una presentación para una fecha de retiro **sin reducir el stock físico y sin crear una venta ni un movimiento de kardex**. Solo se pueden reservar presentaciones activas de productos activos que **controlan vencimiento** (las que publica el catálogo).

**Estados** (`EstadoReserva`):
| Estado | Cómo se llega | ¿Retiene unidades? |
|---|---|---|
| `PENDIENTE` | El cliente crea la reserva | Sí, hasta `expiraEn` (`RESERVA_HORAS_PENDIENTE`, 24 h) |
| `CONFIRMADA` | VENTAS/ADMIN confirma una pendiente vigente | Sí, hasta el fin de `fechaRetiro` |
| `RECHAZADA` | VENTAS/ADMIN rechaza una pendiente (motivo obligatorio) | No |
| `CANCELADA` | VENTAS/ADMIN cancela una pendiente o confirmada (motivo obligatorio) | No |
| `VENCIDA` | Una pendiente llegó a `expiraEn`, o una confirmada pasó su `fechaRetiro` sin retirarse | No |
| `RETIRADA` | Se retiró: venta real asociada (`ventaId`) | No |
Transiciones permitidas: PENDIENTE→CONFIRMADA/RECHAZADA/CANCELADA; CONFIRMADA→RETIRADA/CANCELADA. Cualquier otra → 409. **`VENCIDA` no se escribe: se calcula** (`Reserva.estadoEfectivo`), sin proceso programado; las consultas de compromiso (`ReservaDetalleRepository.compromisosActivos`) aplican el mismo criterio, de modo que **una reserva vencida deja de comprometer stock aunque nadie la haya consultado**. Todos los estados que se informan (detalle, listado, consulta pública) son el efectivo.

**Cobertura (la regla de integridad).** Una reserva solo se respalda con lotes **vendibles** (vigentes; nunca vencidos ni "sin trazabilidad") cuyo vencimiento (último día válido, inclusive) llegue a su `fechaRetiro`: un lote que vence antes no la respalda. Para cada fecha de retiro `t` debe cumplirse `unidades reservadas con retiro ≥ t ≤ unidades vendibles con vencimiento ≥ t` (condición de Hall; `CoberturaReservas`, funciones puras). FEFO es óptimo para esto: si una venta FEFO rompe la cobertura, ninguna otra elección de lotes la salvaría. Nunca se compromete más que lo disponible.
- **Crear / confirmar:** se calcula bajo el bloqueo de la presentación; confirmar vuelve a comprobar precio, aceptación y cobertura.
- **Venta directa** (`POST /api/ventas`, `/api/ventas/carrito`): la validación de stock también comprueba la cobertura; una venta que dejaría sin cobertura a reservas vigentes se rechaza con 400 `Stock comprometido por reservas de X: vendibles V, reservadas R, solicitadas Q`. Lo no reservado sigue vendiéndose normalmente.
- **Ajuste por pérdida física real:** nunca se bloquea. Si deja reservas sin cobertura se registra una **incidencia** (`incidencia_cobertura`: presentación, ajuste, unidades faltantes) y `GET /api/reservas/{id}` marca `sinCobertura = true` (la reserva más antigua tiene prioridad); se resuelve rechazando/cancelando reservas. Confirmar una reserva sin cobertura → 409.
- **Producción, regularización y recepción** solo suman oferta: no pueden romper la cobertura.

**Orden de bloqueos** (sin interbloqueos): teléfono (advisory lock por teléfono normalizado, para el límite de pendientes) → fila de la reserva → presentaciones en orden de id (los mismos que usan ventas, ajustes y producción).

**Reglas de la solicitud** (todas se validan en el servidor con la configuración vigente):
- **Teléfono peruano:** 9 dígitos que empiezan con 9, con o sin `51`/`+51`, con espacios, guiones o paréntesis; se guarda normalizado `+519XXXXXXXX`. El límite por teléfono usa el valor normalizado: no se elude cambiando el formato.
- **Fecha de retiro:** entre hoy y hoy + `RESERVA_PLAZO_DIAS` (3) inclusive, en hora de **America/Lima**; solo días de atención (`RESERVA_DIAS_ATENCION`, 1=lunes…7=domingo, inicial lunes a sábado) que no estén en `RESERVA_DIAS_NO_LABORABLES` (fechas `yyyy-MM-dd` o `NINGUNO`); el retiro **del mismo día** solo antes de `RESERVA_HORA_CIERRE` (18:00). La fecha máxima se guarda al crear (`fechaMaximaRetiro`): cambiar la configuración no mueve las reservas existentes.
- **Unidades:** máx. `RESERVA_MAX_UNIDADES` (20) por reserva, sumando todas las líneas de **unidades discretas** (botella, unidad, pieza…); las presentaciones contadas en **kg, g, L o ml** no se suman con las unidades ni entre unidades distintas: se limitan por separado, por unidad. No se convierte ninguna medida. Cantidades enteras ≥ 1.
- **Pendientes por teléfono:** máx. `RESERVA_MAX_PENDIENTES_TELEFONO` (2) vigentes (las vencidas no cuentan); protegido ante solicitudes simultáneas.
- Máx. 10 líneas; sin presentaciones repetidas.

**Precio.** Cada línea cotiza el precio **PUBLICO vigente hoy**; si no hay, `precioUnitario = null` («Precio a confirmar») y **`total = null` mientras alguna línea no tenga precio** (nunca se inventa un importe). Una reserva con precio por definir (o recotizada con otro importe) tiene `requiereAceptacion = true` y **no puede confirmarse hasta que**: todas las líneas tengan precio, el precio de cada línea coincida con el vigente hoy y exista la **aceptación del cliente** (`POST /api/reservas/{id}/aceptacion-precio`) por el importe actual (queda con usuario, fecha, medio, nota e importe aceptado; si el importe cambia después, `recotizar` la invalida).

**Retiro = venta real.** El retiro es una venta por el flujo normal (FEFO, kardex, movimiento por línea) asociada a la reserva en la **misma transacción**: `POST /api/reservas/{id}/retirar {uuidCliente}` (todas las líneas) o `POST /api/ventas/carrito` con `reservaId` (retiro parcial: líneas de la reserva con cantidad ≤ reservada; lo no retirado se libera). Exige canal `PUBLICO`. Orden dentro de la transacción: se bloquea la reserva, se pasa a `RETIRADA` (sus unidades dejan de estar comprometidas y la venta se valida contra las **demás** reservas), se valida/registra la venta y el precio de cada línea debe ser el cotizado (si no, 409), y se enlaza `ventaId`. **Si la venta falla, todo se revierte y la reserva sigue `CONFIRMADA`** (verificado). Idempotente por `uuidCliente` de la venta. Confirmar **nunca** cobra ni vende.

**Endpoints públicos (sin token):**
- `POST /api/catalogo/reservas` — body `{uuidCliente, nombreCliente, telefono, correo?, fechaRetiro, nota?, lineas:[{presentacionId, cantidad}]}`. 201 `ReservaPublicaResponse` = `{codigo, estado, fechaRetiro, fechaMaximaRetiro, expiraEn, precioAConfirmar, total, lineas:[{presentacionId, producto, presentacion, unidadConteo, cantidad, precioUnitario, subtotal}]}` · 400 (datos, plazo, límite, sin disponibilidad) · 404 · 409 (límite de pendientes por teléfono; `uuidCliente` repetido con otros datos) · 422 (presentación no disponible). Idempotente por `uuidCliente`: repetirla devuelve la misma reserva.
- `POST /api/catalogo/reservas/consulta` — body `{codigo, telefono}` (POST para que el teléfono no viaje en la URL). 200 `ReservaPublicaResponse` · 404 igual para código inexistente o teléfono distinto. El público **no** cambia estados ni ve datos de otros clientes ni notas internas.

**Endpoints del personal (VENTAS o ADMIN):** `GET /api/reservas?estado=&fechaRetiro=&telefono=&page=&size=` (estado efectivo; paginado, más recientes primero) · `GET /api/reservas/{id}` (líneas, aceptación, `sinCobertura`, historial) · `PUT .../recotizar` · `POST .../aceptacion-precio {medio: TELEFONO|WHATSAPP|PRESENCIAL|OTRO, nota?}` · `PUT .../confirmar` · `PUT .../rechazar {motivo}` · `PUT .../cancelar {motivo}` · `POST .../retirar {uuidCliente}`. Otros roles → 403; sin token → 401.

**Catálogo público (cambia la Fase 3):** las presentaciones **sin precio PUBLICO vigente SÍ se listan**, con `precio: null` y `precioAConfirmar: true` («Precio a confirmar») y se pueden reservar. `disponibilidad` ahora es el stock vendible **menos lo comprometido por reservas vigentes**, medido para la primera fecha de retiro posible (hoy si todavía se atiende; si no, el siguiente día de atención dentro del plazo); la comprobación exacta para la fecha elegida ocurre al reservar.

**Configuración** (`configuracion_sistema`, editable solo por ADMIN en Catálogos → Configuración; `PUT /api/admin/configuracion/{clave}`): `RESERVA_PLAZO_DIAS=3`, `RESERVA_MAX_UNIDADES=20`, `RESERVA_MAX_PENDIENTES_TELEFONO=2`, `RESERVA_HORAS_PENDIENTE=24`, `RESERVA_DIAS_ATENCION=1,2,3,4,5,6`, `RESERVA_HORA_CIERRE=18:00`, `RESERVA_DIAS_NO_LABORABLES=NINGUNO`. Los valores se **validan al guardar** (rangos y formatos; 400 y no se guarda) y cada cambio queda con `actualizado_por` y `actualizado_en`. Un valor ilegible en la base no tumba las reservas: se usa el valor por defecto de esa clave y se registra un aviso. Los cambios rigen para las reservas nuevas.

**Persistencia:** `V23__reservas.sql` — `reserva`, `reserva_detalle`, `reserva_evento` (historial append-only con usuario, fecha y motivo), `incidencia_cobertura`, columna `configuracion_sistema.actualizado_por` y las 7 claves. **No toca `movimiento_inventario`, el kardex ni el reparto por lote.** Las horas se guardan en hora de Lima.

**No incluido (fuera de alcance autorizado):** panel de reservas (Fase 5), web pública (Fase 6), límite por IP/CAPTCHA del endpoint público (Fase 7), cancelación por el propio cliente, modificación de la fecha de una reserva existente.

## Ampliación vigente 2026-10-11: catálogo público (Fase 3, SOLO backend)

Sin cambios en el panel Angular ni en contratos compartidos con el móvil. La web pública (Fase 6) consumirá este endpoint.

- `GET /api/catalogo/productos` — **PÚBLICO (sin token)**, solo lectura. 200 `CatalogoPublicoResponse` = `{productos: [{id, nombre, familia, fotoUrl, presentaciones: [{id, nombre, contenidoCantidad, contenidoUnidad, unidadConteo, fotoUrl, precio, disponibilidad}]}]}`. Cualquier otro método o subruta bajo `/api/catalogo/` (salvo `/fotos/**`) sigue exigiendo token (401).
- **Qué se publica:** solo productos **activos que controlan vencimiento**, con sus presentaciones **activas**; el precio es el de modalidad PUBLICO vigente hoy (el de `vigente_desde` más reciente ≤ hoy; uno programado a futuro, o solo MAYORISTA/PROVEEDOR, no cuenta). ~~Una presentación sin precio PUBLICO no se lista~~ **(reemplazado en la Fase 4, opción B: se lista con `precio: null` y `precioAConfirmar: true`)**. Orden: familia, producto, presentación.
- **`disponibilidad`** (estado, nunca cantidad): `DISPONIBLE` = stock vendible > umbral; `POCAS_UNIDADES` = stock vendible entre 1 y el umbral (inclusive); `AGOTADO` = sin stock vendible (la presentación sigue listada). Umbral: `app.catalogo.umbral-pocas-unidades` (env `CATALOGO_UMBRAL_POCAS_UNIDADES`, **por defecto 5**).
- **Fuente única:** el stock vendible sale de `InventarioService.calcularExistencias`, la misma función que decide si una venta puede salir (solo lotes vigentes; excluye vencidos y sin trazabilidad; nunca el stock físico). El estado se calcula una sola vez en el servidor (`DisponibilidadPublica`); el frontend solo lo muestra. Existencias que no cuadran con el libro → la presentación se publica `AGOTADO` (falla cerrada), se registra el error y el resto del catálogo no se ve afectado.
- **No se expone:** cantidades de stock, lotes, fechas de vencimiento, saldos, costos ni datos de usuarios (la prueba de integración lo verifica contra la respuesta real y fija el conjunto exacto de campos de una presentación). `fotoUrl` de la presentación, o la del producto si no tiene; `/api/catalogo/fotos/{nombre}` ya era público.
- **Carga y frescura:** al ser un endpoint sin autenticación, el resultado se conserva en memoria `app.catalogo.cache-segundos` (env `CATALOGO_CACHE_SEGUNDOS`, por defecto 30; 0 = sin caché) y la respuesta lleva `Cache-Control: public, max-age=10`. Lo publicado puede estar hasta ~40 s desactualizado; es solo informativo: la comprobación autoritativa de stock ocurrirá, bajo bloqueo, al reservar (Fase 4). El cálculo usa una instantánea consistente (REPEATABLE READ, solo lectura) y una consulta de precios por lote de presentaciones, no una por presentación.
- Sin migración. No toca `movimiento_inventario`, el kardex ni ningún contrato compartido (`ProductoResponse` sigue intacto).

## Ampliación vigente 2026-10-11: FEFO, vencidos, stock vendible y regularización (Fase 2)

Contratos compartidos con el móvil **sin cambios de forma**: `VentaRequest`/`VentaResponse` (`POST /api/ventas`), `CrearLoteRequest`, `DetalleSalidaRequest`, `ProductoResponse`/`PresentacionResponse` (los usa `/sync/cambios`), `LoteProduccionResponse`. Internamente, una venta móvil de un producto controlado ahora también sale en FEFO (antes se rechazaba); un producto no controlado se comporta exactamente igual que antes (prueba de caracterización).

- **Reglas.** El día de vencimiento es **inclusive**: un lote que vence el 12 se vende hasta el 12 y está vencido desde el 13. "Hoy" es el reloj del **servidor** en la zona `app.vencimiento.zona-horaria` (env `VENCIMIENTO_ZONA_HORARIA`, por defecto `America/Lima`), nunca la `fecha` que manda el cliente en una venta (una venta capturada hace diez días no puede vender un lote que ya venció).
- **Desglose de existencias** de una presentación controlada: `físico = vendible + vencido + sin trazabilidad`. *Vendible* = lotes con saldo y vencimiento ≥ hoy. *Vencido* = lotes con saldo y vencimiento < hoy. *Sin trazabilidad* = existencias anteriores a la activación (o halladas en un conteo) cuya fecha se desconoce. **Solo lo vendible se vende.**
- **Venta (FEFO).** `POST /api/ventas` y `/api/ventas/carrito`: para una presentación controlada se valida contra el stock **vendible** (no el físico) y el movimiento se reparte entre los lotes vigentes, primero el que vence antes (desempate: fecha del lote, luego id). Un movimiento por línea, como siempre; el reparto queda en `movimiento_inventario_lote` (una fila por lote usado). Sin vendible suficiente → 400 `Stock vendible insuficiente de X: vendibles N, solicitadas M (en inventario hay F; no vendibles: V vencidas y S sin trazabilidad)`, sin escribir nada (el carrito completo se revierte).
- **Ajuste de stock** (`POST /api/inventario/ajustes`, ADMIN; `cantidadFisica` sigue siendo el conteo total): un ajuste **positivo** entra como *sin trazabilidad* (no vendible hasta regularizarlo); uno **negativo** descuenta primero lo **vencido**, luego lo **sin trazabilidad** y al final los lotes vigentes en FEFO (se da de baja antes lo que ya no se puede vender).
- **Entrada por el camino legado** (`POST /api/lotes-produccion`, un paso) de un producto controlado sigue rechazada (400); se produce por el flujo planificado con fecha de vencimiento (Fase 1).
- `GET /api/inventario/presentaciones/{presentacionId}/existencias` (PRODUCCION, VENTAS, ADMIN; **solo web**): `ExistenciasPresentacionResponse` = `presentacionId`, `controlaVencimiento`, `stockFisico`, `stockVendible`, `stockVencido`, `stockSinTrazabilidad`, `fechaReferencia` (hoy según el servidor), `lotes[{origen LOTE|REGULARIZACION, id, loteProduccionId?, fechaLote, fechaVencimiento, saldo, vencido, diasParaVencer}]` en orden FEFO (`diasParaVencer` 0 = vence hoy, aún vendible; negativo = vencido). Sin control: `stockVendible = stockFisico`, resto en 0, `lotes` vacío. Lectura consistente (instantánea REPEATABLE READ), sin bloqueo: la autoridad es la validación de la venta. 404 si no existe la presentación.
- `GET /api/inventario/stock/presentaciones` (solo web): `FilaStockResponse` agrega **`controlaVencimiento`** y **`stockVendible`** (igual a `stock` si no controla). `stock` sigue siendo el físico.
- `GET /api/control-vencimiento/productos` (PRODUCCION, VENTAS, ADMIN; solo web): `{productoIds: [...]}` de los productos que controlan vencimiento. Existe aparte porque `ProductoResponse` lo comparte la sincronización móvil y no se amplió.
- `POST /api/admin/presentaciones/{presentacionId}/regularizaciones` (**ADMIN**): `{cantidad ≥ 1, fechaVencimiento, motivo}` (motivo obligatorio, máx. 300; la fecha la lee una persona de la etiqueta; una fecha pasada es válida y deja esas unidades como vencidas). **Reclasifica** `cantidad` unidades del saldo *sin trazabilidad* a un lote con esa fecha; `cantidad` no puede superar lo que sigue sin trazabilidad. 201 `RegularizacionResponse` (`id`, `presentacionId`, `cantidad`, `fechaVencimiento`, `vencido`, `motivo`, `creadoEn`, `sinTrazabilidadRestante`) · 400 (producto sin control, cantidad excesiva, datos inválidos) · 404. **No escribe en `movimiento_inventario` ni en el kardex**: el stock total no cambia, solo cambia de "cajón". Append-only (sin edición ni borrado).
- **Concurrencia.** Ventas, ajustes, entradas, activación/desactivación, corrección y regularización toman el mismo bloqueo de fila de `presentacion` (en orden de id) y leen las existencias **después** de bloquear y **antes** de crear el movimiento. Cada lectura verifica la invariante (`libro = sin trazabilidad + Σ lotes`, ningún cajón negativo) y **falla cerrada** (`IllegalStateException`, nada se escribe) si no cuadra.
- **Persistencia:** `V22__fefo_regularizacion.sql` — tabla `regularizacion_trazabilidad`; `movimiento_inventario_lote.regularizacion_id` (+ `CHECK` de un solo origen: lote **o** regularización **o** ninguno = sin trazabilidad; el índice único "sin lote" ahora exige ambos nulos). Solo toca tablas de la Fase 1 (sin datos reales: la activación sigue deshabilitada). **No toca `movimiento_inventario`** (huella idéntica, verificada por la prueba de caracterización) ni el kardex.
- **La activación del control sigue deshabilitada por defecto** (`app.vencimiento.activacion-habilitada=false`): no activar productos reales hasta que el usuario valide esta fase.

## Ampliación vigente 2026-10-11: control de vencimiento (Fase 1, SOLO backend)

Sin cambios en el panel Angular ni en contratos compartidos con otros clientes (`CrearLoteRequest`, `DetalleSalidaRequest`, `VentaRequest`, `ProductoResponse`, `PresentacionResponse`, `LoteProduccionResponse`, `DetalleSalidaResponse`). La web aún no usa estos endpoints (llegan con la Fase 2).

- **Qué es:** un producto puede "controlar vencimiento" (apagado por defecto; ningún producto actual cambia). Al activarlo, el stock que cada presentación tiene en ese instante queda declarado **sin trazabilidad** (`presentacion.saldo_sin_trazabilidad_inicial`): no se le atribuye ningún lote ni fecha. Desde entonces cada entrada de producción se asigna a su lote en `movimiento_inventario_lote`. Invariante por presentación controlada: `stock del libro = saldo_sin_trazabilidad_inicial + SUM(movimiento_inventario_lote.cantidad)`.
- **Activación deshabilitada por defecto** en todo entorno real: `app.vencimiento.activacion-habilitada` (env `VENCIMIENTO_ACTIVACION_HABILITADA`, por defecto `false`) hasta que la Fase 2 (FEFO y bloqueo de vencidos) esté implementada y validada. Solo las pruebas la habilitan. Una prueba (`ConfiguracionVencimientoTest`) falla si alguien cambia ese valor por defecto.
- **Falla cerrada (reemplazada por la Fase 2: ventas y ajustes ya se reparten por lote; solo la entrada de un paso sigue rechazada):** para una presentación de un producto controlado, una **venta**, un **ajuste** o una **entrada de producción por el camino de un solo paso** (`POST /api/lotes-produccion`) se rechazan con 400 sin escribir nada, porque aún no saben repartir el movimiento entre lotes. El `POST /api/lotes-produccion` rechaza el producto controlado antes de tocar leche o insumos; un producto controlado se produce por el flujo planificado.
- `PUT /api/admin/productos/{id}/control-vencimiento` (ADMIN): activa. 200 `ControlVencimientoResponse` (`productoId`, `controlaVencimiento`, `presentaciones[{presentacionId, nombre, saldoSinTrazabilidadInicial}]`) · 404 · **409 si la activación está deshabilitada en el entorno**. Idempotente: repetirla no recaptura el saldo.
- `DELETE /api/admin/productos/{id}/control-vencimiento` (ADMIN): desactiva. Solo si **no existe ninguna asignación** en el producto y el stock de cada presentación sigue igual a su saldo inicial (el libro es idéntico al de la activación); si no, 409. Siempre permitida aunque la activación esté deshabilitada (camino de reversa). No toca el libro ni los saldos.
- `POST /api/lotes-produccion/{id}/finalizar`: `FinalizarLoteRequest` agrega `vencimientos?: [{presentacionId, fechaVencimiento}]` (solo web). Producto **controlado**: una fecha por cada salida (obligatoria, sin repetir, solo de presentaciones que son salida del lote, **≥ fecha del lote**, sin tope superior); falta o fecha inválida → 400 sin escribir nada. Producto **no controlado**: no se admiten fechas (400); sin ellas todo sigue exactamente igual.
- `PATCH /api/lotes-produccion/detalles/{detalleId}/vencimiento` (PRODUCCION o ADMIN): `{fechaVencimiento, motivo}` (motivo obligatorio, máx. 300). Corrige una fecha digitada incorrectamente **solo mientras el lote no se haya usado** (ninguna salida asignada → si no, 409). Conserva `fecha_vencimiento_original` (la primera vez) y de la última corrección quién, cuándo y por qué. 400 si el producto no controla vencimiento, la salida no tiene fecha (existencias sin trazabilidad), la fecha es anterior a la del lote o igual a la actual.
- **Concurrencia:** activar, desactivar, corregir y las entradas de producción (más ventas y ajustes) toman el mismo bloqueo de fila de `presentacion`, en orden de id, y después leen el indicador con una consulta escalar. `LoteProduccionService.registrarSalidas` bloquea todas sus presentaciones en orden de id antes de escribir (evita interbloqueos con ventas).
- **Persistencia aditiva:** `V21__control_vencimiento.sql` (`producto.controla_vencimiento`, `presentacion.saldo_sin_trazabilidad_inicial`, columnas de vencimiento en `lote_produccion_detalle`, tabla `movimiento_inventario_lote`). **No toca `movimiento_inventario`** (columnas, índices, restricciones y tipos idénticos) ni el kardex.

## Ampliación vigente 2026-10-10: validación de productos y fotos de catálogo

- `ProductoRequest`: `nombre` ≤ 60 caracteres (se recorta; único sin importar mayúsculas, **incluye productos desactivados**), `rendimientoEsperadoPct` entre 0 y 999,99 (2 decimales), `cicloCapital` solo `RAPIDO`/`MADURACION`. Valores fuera de límite responden 400 con mensaje claro (antes llegaban a Postgres y daban 500).
- `PresentacionRequest`: `nombre` ≤ 60 y `unidadConteo` ≤ 30 (se recortan), `contenidoCantidad` > 0 hasta 7 enteros/3 decimales, `contenidoUnidad` solo `ML`/`L`/`G`/`KG`. **`contenidoCantidad` y `contenidoUnidad` van juntos o ninguno** (400 si falta uno).
- Errores: nombre de producto repetido → **409** (antes 500); JSON ilegible, UUID o enum inválido → **400**; falta la parte `file` → 400; cuerpo que no es multipart en una subida → 415. Los 500 ahora quedan en el log del servidor.
- `ProductoResponse.fotoUrl` y `PresentacionResponse.fotoUrl`: ruta relativa (`/api/catalogo/fotos/{uuid}.jpg|png|webp`) o `null`. Si una presentación no tiene foto propia, el catálogo público usa la del producto (la API no lo resuelve: devuelve solo la propia). El sync móvil (`/api/sync/cambios`) también las incluye; el móvil ignora campos desconocidos.
- Subir/reemplazar: `PUT /api/admin/productos/{id}/foto` y `PUT /api/admin/productos/{productoId}/presentaciones/{presentacionId}/foto` (ADMIN, `multipart/form-data`, campo `file`; JPEG/PNG/WebP, máx. 5 MB, máx. 8000 px por lado; el servidor valida la firma real del archivo, no el `Content-Type`). Quitar: `DELETE` sobre las mismas rutas. Devuelven el producto/presentación actualizado. Reemplazar o quitar borra el archivo anterior del disco tras confirmar la transacción.
- Lectura pública: `GET /api/catalogo/fotos/{nombre}` **sin autenticación** (solo GET), `Cache-Control` de un año `immutable` y `X-Content-Type-Options: nosniff`. Directorio propio (`app.fotos.directorio`, env `FOTOS_CATALOGO_DIR`, por defecto `uploads/catalogo`), separado de las fotos de acopio (`/api/archivos`, que siguen exigiendo rol).
- El panel reduce la foto a 1600 px, la recodifica (JPEG; PNG se conserva) y descarta el EXIF (GPS) antes de subirla. Si el producto se guarda pero la foto falla, el producto NO se revierte: se avisa y la foto se corrige editando.
- Persistencia aditiva: `V20__foto_producto_presentacion.sql` (`producto.foto_archivo`, `presentacion.foto_archivo`, ambas NULL; guarda solo el nombre del archivo).

## Ampliación vigente 2026-09-28: prevención en Producción

- `ProductoRequest` y `ProductoResponse` incorporan `rangoRendimiento`: null o `{minimo: number, maximo: number, unidad: 'KG' | 'L' | 'UNIDAD'}`. Valores de salida por cada 100 L consumidos; mínimo ≥ 0, máximo > 0, mínimo ≤ máximo, hasta 12 enteros/4 decimales. En la edición web deshabilitar el rango envía null y lo elimina. `rendimientoEsperadoPct` conserva su significado histórico independiente.
- `CrearLoteRequest` agrega `motivoRendimiento?: string | null`, máximo 500 caracteres. `litrosUsados` exige > 0 y como máximo 7 enteros/2 decimales; no admite elementos null en detalles. Motivo obligatorio si el rendimiento calculable excede el rango; espacios no cuentan. Se valida antes de registrar consumos. La web bloquea cantidades superiores al saldo consultado, pero el backend sigue siendo autoridad bajo bloqueo.
- `LoteProduccionResponse` agrega `motivoRendimiento` y `revisionRendimiento`, ambos nullable. La revisión describe resultado y rango al registrar, conservados aunque cambie el catálogo. El motivo forma parte de la comparación idempotente del request.
- KG admite G/KG; L admite ML/L. UNIDAD solo admite una presentación por lote. No se convierte masa en volumen. Un rango incompatible con el contenido declarado se rechaza; sin rango no se inventa validación física. Cero salidas explícitas se evalúa como cero rendimiento.
- Persistencia aditiva: `V13__prevencion_rendimiento_produccion.sql`. No modifica saldos, lotes previos ni límites de productos existentes.

28 DTOs de entrada, incluido RutaItemRequest anidado. Nombres/tipos/anotaciones proceden del código canónico; no son propuestas. Revisar además servicios y ALCANCE para reglas de negocio.

## Convenciones

- @NotBlank: texto requerido, no blanco. @NotNull: requerido. @NotEmpty: lista requerida no vacía. @Valid: valida elementos anidados. @Size sola permite null.
- String/UUID → string JSON; BigDecimal → número decimal; Integer → entero; Boolean → boolean; List → array.
- LocalDate: YYYY-MM-DD; LocalDateTime: YYYY-MM-DDTHH:mm:ss sin offset; LocalTime: HH:mm:ss; Instant con offset UTC.
- uuidCliente es String de idempotencia; generar UUID y conservarlo al reintentar.
- Código de respuestas no es payload de escritura. Un record de respuesta no establece por sí solo una garantía de no-null.
- Enumeraciones: roles desde GET /api/admin/roles; tipoCliente MAYORISTA/PROVEEDOR/PUBLICO; cicloCapital RAPIDO/MADURACION.

## AnalisisCalidadRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\AnalisisCalidadRequest.java`.

Uso: `POST /api/analisis-calidad`; `POST /api/sync/analisis-calidad`.

```java
public record AnalisisCalidadRequest(
    @NotBlank String uuidCliente,          // mejora #1: capturable offline
    @NotNull UUID registroAcopioId,
    @NotBlank String folioMuestra,
    BigDecimal agua,
    BigDecimal proteina,
    BigDecimal lactosa,
    BigDecimal densidad,
    BigDecimal temperatura,
    BigDecimal ph,
    Boolean aguaAnadida
) {}
```

## CambiarPasswordRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\CambiarPasswordRequest.java`.

Uso: `PATCH /api/auth/password`.

```java
public record CambiarPasswordRequest(
    @NotBlank String passwordActual,
    @NotBlank @Size(min = 8, message = "debe tener al menos 8 caracteres") String passwordNueva
) {}
```

## ConfiguracionSistemaUpdateRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\ConfiguracionSistemaUpdateRequest.java`.

Uso: `PUT /api/admin/configuracion/{clave}`.

```java
public record ConfiguracionSistemaUpdateRequest(
    @NotBlank String valor
) {}
```

## ConfirmarComunicadoRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\ConfirmarComunicadoRequest.java`.

Uso: `POST /api/comunicados/{id}/confirmaciones`.

```java
public record ConfirmarComunicadoRequest(
    @NotNull UUID proveedorId
) {}
```

## CorreccionRegistroRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\CorreccionRegistroRequest.java`.

Uso: `POST /api/registros-acopio/{id}/correcciones`.

```java
public record CorreccionRegistroRequest(
    @NotNull @DecimalMin("0.0") BigDecimal litrosCorregido,
    String motivo
) {}
```

## CrearComunicadoRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\CrearComunicadoRequest.java`.

Uso: `POST /api/comunicados`.

```java
public record CrearComunicadoRequest(
    @NotBlank String mensaje,
    @NotEmpty List<UUID> zonaIds
) {}
```

## CrearLoteRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\CrearLoteRequest.java`.

Uso: `POST /api/lotes-produccion`; `POST /api/sync/lotes-produccion`.

```java
public record CrearLoteRequest(
    @NotBlank String uuidCliente,           // mejora #1: capturable offline
    @NotNull LocalDate fecha,
    @NotNull UUID tipoQuesoId,
    @NotNull @DecimalMin(value = "0.0", inclusive = true) BigDecimal litrosUsados,
    @NotNull @Min(0) Integer unidadesObtenidas,
    @NotEmpty List<UUID> registroAcopioIds  // registros de acopio que componen el lote
) {}
```

## DefinirRutaZonaRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\DefinirRutaZonaRequest.java`.

Uso: `PUT /api/zonas/{zonaId}/ruta`.

```java
public record DefinirRutaZonaRequest(
    @NotEmpty @Valid List<RutaItemRequest> items
) {}
```

## GenerarPagoRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\GenerarPagoRequest.java`.

Uso: `POST /api/pagos/generar`.

```java
public record GenerarPagoRequest(
    @NotNull UUID proveedorId,
    @NotNull LocalDate semanaInicio,
    @NotNull LocalDate semanaFin
) {}
```

## JornadaDTO

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\JornadaDTO.java`.

Uso: `POST /api/sync/jornadas`.

```java
public record JornadaDTO(
    @NotBlank String uuidCliente,
    @NotNull UUID unidadId,
    @NotNull LocalDateTime horaInicio,
    BigDecimal gpsLatInicio,
    BigDecimal gpsLngInicio,
    EstadoJornada estado,
    LocalDateTime horaFin,
    BigDecimal gpsLatFin,
    BigDecimal gpsLngFin,
    String motivoCancelacion
) {}
```

## JornadaEstadoRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\JornadaEstadoRequest.java`.

Uso: `POST /api/sync/jornadas/estado`.

```java
public record JornadaEstadoRequest(
    @NotBlank String uuidCliente,
    @NotNull TipoTransicionJornada tipo,
    @NotNull LocalDateTime horaEvento,
    BigDecimal gpsLat,
    BigDecimal gpsLng,
    String motivoCancelacion
) {
    public enum TipoTransicionJornada { FINALIZAR, CANCELAR }
}
```

## LoginRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\LoginRequest.java`.

Uso: `POST /api/auth/login`.

```java
public record LoginRequest(
    @NotBlank @Email String email,
    @NotBlank String password
) {}
```

## MotivoObservacionRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\MotivoObservacionRequest.java`.

Uso: `POST /api/admin/motivos-observacion`; `PUT /api/admin/motivos-observacion/{id}`.

```java
public record MotivoObservacionRequest(@NotBlank String descripcion) {}
```

## PrecioLitroRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\PrecioLitroRequest.java`.

Uso: `POST /api/admin/precios-litro`.

```java
public record PrecioLitroRequest(
    @NotNull @DecimalMin(value = "0.0", inclusive = false) BigDecimal precio,
    @NotNull LocalDate vigenteDesde
) {}
```

## ProveedorRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\ProveedorRequest.java`.

Uso: `POST /api/proveedores`.

```java
public record ProveedorRequest(
    @NotBlank String nombre,
    @NotBlank String dni,
    String telefono,
    UUID zonaActualId
) {}
```

## ProveedorUpdateRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\ProveedorUpdateRequest.java`.

Uso: `PUT /api/proveedores/{id}`.

```java
public record ProveedorUpdateRequest(
    @NotBlank String nombre,
    @NotBlank String dni,
    String telefono
) {}
```

## PuntoGpsJornadaDTO

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\PuntoGpsJornadaDTO.java`.

Uso: `POST /api/sync/puntos-gps`.

```java
public record PuntoGpsJornadaDTO(
    @NotBlank String uuidCliente,
    @NotNull UUID jornadaId,
    @NotNull @DecimalMin(value = "-90.0") @DecimalMax(value = "90.0") BigDecimal lat,
    @NotNull @DecimalMin(value = "-180.0") @DecimalMax(value = "180.0") BigDecimal lng,
    BigDecimal precisionM,                 // nullable -- solo si el dispositivo la proveyo
    @NotNull LocalDateTime capturadoEn
) {}
```

## RecepcionJornadaRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\RecepcionJornadaRequest.java`.

Uso: `POST /api/sync/recepciones-jornada`.

```java
public record RecepcionJornadaRequest(
    @NotBlank String uuidCliente,
    @NotNull UUID jornadaId,
    @NotNull @DecimalMin(value = "0.0", inclusive = true) BigDecimal litrosReales,
    String turno,                            // opcional, default "UNICO" (igual que RecepcionPlantaRequest)
    @NotNull LocalDateTime horaLlegada,
    String observacion                       // opcional
) {}
```

## RecepcionPlantaRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\RecepcionPlantaRequest.java`.

Uso: `POST /api/recepcion-planta`.

```java
public record RecepcionPlantaRequest(
    @NotNull LocalDate fecha,
    String turno,                            // opcional, default "UNICO"
    @NotNull UUID unidadId,
    @NotNull @DecimalMin("0.0") BigDecimal litrosCampo,
    @NotNull @DecimalMin("0.0") BigDecimal litrosPlanta,
    List<UUID> registroAcopioIds
) {}
```

## RefreshTokenRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\RefreshTokenRequest.java`.

Uso: `POST /api/auth/refresh-token`.

```java
public record RefreshTokenRequest(
    @NotBlank String refreshToken
) {}
```

## RegistroAcopioDTO

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\RegistroAcopioDTO.java`.

Uso: `POST /api/registros-acopio`; `POST /api/sync/registros-acopio`.

```java
public record RegistroAcopioDTO(
    @NotBlank String uuidCliente,
    @NotNull UUID proveedorId,
    @NotNull UUID unidadId,
    @NotNull LocalDateTime fechaHora,
    @NotNull @DecimalMin(value = "0.0", inclusive = true) BigDecimal litros,
    BigDecimal gpsLat,
    BigDecimal gpsLng,
    UUID motivoObservacionId,           // nullable
    Boolean litrosPorVoz,
    String fotoUrl,
    UUID jornadaId
) {}
```

## RutaItemRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\RutaItemRequest.java`.

Uso: anidado en DefinirRutaZonaRequest.

```java
public record RutaItemRequest(
    @NotNull UUID proveedorId,
    @NotNull @Min(1) Integer orden,
    LocalTime horaEstimada
) {}
```

## TipoQuesoRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\TipoQuesoRequest.java`.

Uso: `POST /api/admin/tipos-queso`; `PUT /api/admin/tipos-queso/{id}`.

```java
public record TipoQuesoRequest(
    @NotBlank String nombre,
    @NotNull BigDecimal rendimientoEsperadoPct,
    @NotBlank String cicloCapital    // RAPIDO | MADURACION
) {}
```

## UnidadRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\UnidadRequest.java`.

Uso: `POST /api/admin/unidades`; `PUT /api/admin/unidades/{id}`.

```java
public record UnidadRequest(
    @NotBlank String placa,
    BigDecimal capacidadTon,
    UUID zonaId,
    @NotNull UUID responsableId    // mejora #2: obligatorio
) {}
```

## UsuarioRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\UsuarioRequest.java`.

Uso: `POST /api/admin/usuarios`.

```java
public record UsuarioRequest(
    @NotBlank String nombre,
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8) String password,
    @NotBlank String rolNombre   // ACOPIADOR | CALIDAD | RECEPCION | PRODUCCION | VENTAS | ADMIN
) {}
```

## UsuarioUpdateRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\UsuarioUpdateRequest.java`.

Uso: `PUT /api/admin/usuarios/{id}`.

```java
public record UsuarioUpdateRequest(
    @NotBlank String nombre,
    @NotBlank @Email String email,
    @NotBlank String rolNombre,
    @Size(min = 8, message = "debe tener al menos 8 caracteres") String nuevaPassword
) {}
```

## VentaRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\VentaRequest.java`.

Uso: `POST /api/sync/ventas`; `POST /api/ventas`.

```java
public record VentaRequest(
    @NotBlank String uuidCliente,
    @NotNull LocalDate fecha,
    @NotBlank String tipoCliente,           // MAYORISTA | PROVEEDOR | PUBLICO
    @NotNull UUID tipoQuesoId,
    @NotNull @Min(1) Integer cantidad,
    @NotNull @DecimalMin("0.0") BigDecimal precioUnitario
) {}
```

## ZonaRequest

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\dto\ZonaRequest.java`.

Uso: `POST /api/admin/zonas`; `PUT /api/admin/zonas/{id}`.

```java
public record ZonaRequest(@NotBlank String nombre) {}
```

## Entradas sin DTO JSON

PUT proveedor/{id}/zona usa zonaId y el motivo opcional (≤200) en query; POST archivos usa multipart con campo file; reactivar, desactivar, marcar comprobante y liquidar ajuste no llevan cuerpo. POST auth/refresh requiere token vigente y no cuerpo. POST sync recibe array, no un DTO aislado.

## Respuestas

### AcopioDeJornadaResponse.java

```java
public record AcopioDeJornadaResponse(
    UUID registroAcopioId,
    UUID proveedorId,
    String proveedorNombre,
    LocalDateTime fechaHora,
    BigDecimal litros
) {}
```

### AjustePagoResponse.java

```java
public record AjustePagoResponse(
    UUID id,
    UUID pagoId,
    UUID registroAcopioId,
    UUID correccionRegistroId,
    BigDecimal litrosDiferencia,
    BigDecimal precioLitro,
    BigDecimal monto,
    String estado,
    LocalDateTime creadoEn,
    BigDecimal precioLitroAlCrear,   // Fase B (aditivo): precio y monto del momento de la creación
    BigDecimal montoAlCrear
) {}
```

`precioLitro` y `monto` son los **vigentes**: mientras el ajuste está PENDIENTE siguen al precio de su entrega (su precio de calidad o, si no tiene, el del pago); al
LIQUIDARLO quedan congelados. El panel solo los muestra.

### LineaPagoResponse.java (Fases B y C)

```java
public record LineaPagoResponse(
    UUID registroAcopioId, LocalDateTime fechaHora,
    BigDecimal litrosOriginales,        // lo recibido; nunca cambia
    BigDecimal litrosLiquidados,        // lo pagado al generar el pago
    BigDecimal litrosContabilizados,    // liquidados + ajustes de litros posteriores
    BigDecimal litrosEfectivosActuales, // original o última corrección válida de hoy
    BigDecimal precioBase,              // precio normal con el que se generó el pago
    BigDecimal precioAplicado,          // precio de ESTA entrega hoy (su precio de calidad o el del pago)
    UUID correccionAplicadaId,
    boolean precioPropioDeCalidad, UUID analisisCalidadId, String motivoAjusteCalidad
) {}
```

### AjusteCalidadEntregaRequest.java / AjusteCalidadEntregaResponse.java (Fase C)

```java
public record AjusteCalidadEntregaRequest(
    BigDecimal precioLitroNuevo,   // 0.001–999.999, ≤3 decimales
    UUID analisisCalidadId,        // obligatorio y de ESA entrega
    String motivo                  // obligatorio, ≤500
) {}
public record AjusteCalidadEntregaResponse(
    UUID id, UUID pagoId, UUID registroAcopioId, UUID analisisCalidadId, String analisisFolio, String analisisResultado,
    BigDecimal litrosLiquidados, BigDecimal precioNormal, BigDecimal precioAnterior, BigDecimal precioLitroNuevo,
    BigDecimal efectoEnElTotal,    // litros × (precio nuevo − precio normal), negativo = se paga menos (informativo)
    String motivo, String usuarioNombre, LocalDateTime creadoEn
) {}
```

`PagoResponse` gana `ajusteCalidad` (al final): `totalAPagar` es el **total reconocido** (suma entrega por entrega de litros liquidados × precio aplicado,
redondeada una vez) y `ajusteCalidad` = `totalAPagar` − litros × `precioLitroEfectivo`.

### AlertaAnomaliaResponse.java

```java
public record AlertaAnomaliaResponse(
    UUID id,
    UUID registroAcopioId,
    UUID proveedorId,
    String proveedorNombre,
    String tipo,
    BigDecimal zScore,
    String severidad,
    LocalDateTime creadoEn
) {}
```

### AnalisisBandejaResponse.java

```java
public record AnalisisBandejaResponse(
    UUID registroAcopioId,
    UUID proveedorId,
    String proveedorNombre,
    LocalDateTime fechaHora,
    BigDecimal litros,
    String resultado
) {}
```

### AnalisisCalidadRequest.java

```java
public record AnalisisCalidadRequest(
    @NotBlank String uuidCliente,          // mejora #1: capturable offline
    @NotNull UUID registroAcopioId,
    @NotBlank String folioMuestra,
    BigDecimal agua,
    BigDecimal proteina,
    BigDecimal lactosa,
    BigDecimal densidad,
    BigDecimal temperatura,
    BigDecimal ph,
    Boolean aguaAnadida
) {}
```

### AnalisisCalidadResponse.java

```java
public record AnalisisCalidadResponse(
    UUID id,
    UUID registroAcopioId,
    String folioMuestra,
    BigDecimal agua,
    BigDecimal proteina,
    BigDecimal lactosa,
    BigDecimal densidad,
    BigDecimal temperatura,
    BigDecimal ph,
    Boolean aguaAnadida,
    String resultado,
    LocalDateTime creadoEn
) {}
```

### ArchivoResponse.java

```java
public record ArchivoResponse(
    String url,
    String nombreArchivo,
    long tamanoBytes
) {}
```

### CambiarPasswordRequest.java

```java
public record CambiarPasswordRequest(
    @NotBlank String passwordActual,
    @NotBlank @Size(min = 8, message = "debe tener al menos 8 caracteres") String passwordNueva
) {}
```

### CambiosResponse.java

```java
public record CambiosResponse(
    Instant generadoEn,
    List<ProveedorPublicoResponse> proveedores,
    java.math.BigDecimal precioLitroVigente,
    List<ComunicadoResponse> comunicados,
    List<PrediccionProveedorResponse> prediccionesProveedor,
    List<MotivoObservacionResponse> motivosObservacion,
    List<TipoQuesoResponse> tiposQueso,
    List<UnidadResponse> unidades
) {}
```

### ComunicadoConfirmacionResponse.java

```java
public record ComunicadoConfirmacionResponse(
    UUID id,
    UUID proveedorId,
    String proveedorNombre,
    UUID acopiadorId,
    String acopiadorNombre,
    LocalDateTime confirmadoEn
) {}
```

### ComunicadoResponse.java

```java
public record ComunicadoResponse(
    UUID id,
    String mensaje,
    LocalDateTime fecha,
    List<String> zonasNombres
) {}
```

### ConfiguracionSistemaResponse.java

```java
public record ConfiguracionSistemaResponse(
    String clave,
    String valor,
    String descripcion
) {}
```

### ConfiguracionSistemaUpdateRequest.java

```java
public record ConfiguracionSistemaUpdateRequest(
    @NotBlank String valor
) {}
```

### ConfirmarComunicadoRequest.java

```java
public record ConfirmarComunicadoRequest(
    @NotNull UUID proveedorId
) {}
```

### CorreccionRegistroRequest.java

```java
public record CorreccionRegistroRequest(
    @NotNull @DecimalMin("0.0") BigDecimal litrosCorregido,
    String motivo
) {}
```

### CorreccionRegistroResponse.java

```java
public record CorreccionRegistroResponse(
    UUID id,
    UUID registroAcopioId,
    BigDecimal litrosAnterior,
    BigDecimal litrosCorregido,
    String motivo,
    String usuarioNombre,
    LocalDateTime creadoEn
) {}
```

### CrearComunicadoRequest.java

```java
public record CrearComunicadoRequest(
    @NotBlank String mensaje,
    @NotEmpty List<UUID> zonaIds
) {}
```

### CrearLoteRequest.java

```java
public record CrearLoteRequest(
    @NotBlank String uuidCliente,           // mejora #1: capturable offline
    @NotNull LocalDate fecha,
    @NotNull UUID tipoQuesoId,
    @NotNull @DecimalMin(value = "0.0", inclusive = true) BigDecimal litrosUsados,
    @NotNull @Min(0) Integer unidadesObtenidas,
    @NotEmpty List<UUID> registroAcopioIds  // registros de acopio que componen el lote
) {}
```

### DefinirRutaZonaRequest.java

```java
public record DefinirRutaZonaRequest(
    @NotEmpty @Valid List<RutaItemRequest> items
) {}
```

### ErrorResponse.java

```java
@Schema(description = "Forma estandar de cualquier error de la API.")
public record ErrorResponse(
        @Schema(description = "Momento en que ocurrio el error (ISO-8601).", example = "2026-09-03T10:15:30.123Z")
        String timestamp,
        @Schema(description = "Codigo de estado HTTP.", example = "404")
        int status,
        @Schema(description = "Nombre del codigo HTTP.", example = "Not Found")
        String error,
        @Schema(description = "Mensaje legible del error, listo para mostrar o loguear.",
                example = "Proveedor no encontrado: 550e8400-e29b-41d4-a716-446655440000")
        String mensaje
) {}
```

### GenerarPagoRequest.java

```java
public record GenerarPagoRequest(
    @NotNull UUID proveedorId,
    @NotNull LocalDate semanaInicio,
    @NotNull LocalDate semanaFin
) {}
```

### Pagos efectivos (V30) — PagoProveedorController

```java
public record PagoProveedorRequest(
    String uuidCliente, UUID proveedorId, ModalidadPagoProveedor modalidad /* EFECTIVO|TRANSFERENCIA|DEPOSITO */, BigDecimal monto,
    String concepto, String banco, String nroOperacion, String nroRecibo, String observacion,
    List<AplicacionPagoRequest> aplicaciones   // opcional: {pagoId, monto}
) {}
public record AplicarPagoProveedorRequest(List<AplicacionPagoRequest> aplicaciones) {}
public record AnularPagoProveedorRequest(String motivo) {}
public record PagoProveedorResponse(
    UUID id, String uuidCliente, UUID proveedorId, String proveedorNombre, LocalDateTime fechaHora, String modalidad, BigDecimal monto,
    String concepto, String banco, String nroOperacion, String nroRecibo, String observacion, String usuarioNombre,
    String estado /* REGISTRADO|ANULADO */, String anuladoMotivo, String anuladoPorNombre, LocalDateTime anuladoEn,
    BigDecimal aplicado, BigDecimal sinAplicar, List<AplicacionPagoResponse> aplicaciones
) {}
public record AplicacionPagoResponse(UUID id, UUID pagoId, LocalDate semanaInicio, LocalDate semanaFin, BigDecimal monto, String usuarioNombre, LocalDateTime creadoEn) {}
public record SaldoPagoResponse(
    UUID pagoId, UUID proveedorId, LocalDate semanaInicio, LocalDate semanaFin,
    BigDecimal totalAPagar, BigDecimal ajustesLitros, BigDecimal totalConAjustes, BigDecimal aplicado,
    BigDecimal saldo /* negativo = a favor del proveedor */, String estado /* PENDIENTE|PARCIAL|PAGADO|SALDO_A_FAVOR */
) {}
public record SaldoProveedorResponse(UUID proveedorId, String proveedorNombre, List<SaldoPagoResponse> liquidaciones,
    BigDecimal saldoLiquidaciones, BigDecimal adelantosSinAplicar, BigDecimal saldoNeto) {}
```

Ninguna respuesta trae DNI ni teléfono. `POST /api/pagos-proveedor` responde 201 al crear y 200 en un reenvío (mismo `uuidCliente`, o misma operación bancaria con los mismos datos).

### Historial consolidado (Fase D) — HistorialProveedorController

```java
public record HistorialResumenResponse(
    UUID proveedorId, String proveedorNombre, String zonaActualNombre,
    List<String> secciones,            // ENTREGAS | CALIDAD | PAGOS | ZONAS: las que el rol puede ver
    EntregasResumen entregas,          // todos
    CalidadResumen calidad,            // ADMIN, CALIDAD (si no, null)
    PagosResumen pagos,                // ADMIN, RECEPCION (si no, null)
    List<HistorialZonaResponse> zonas  // solo ADMIN (si no, null)
) {}
// EntregasResumen(total, litrosRecibidos, litrosEfectivos, primeraEntrega, ultimaEntrega, conCorreccion, sinZona)
// CalidadResumen(analizadas, sinAnalisis, aprobadas, observadas, rechazadas, alertas, conPrecioDeCalidad)
// PagosResumen(liquidaciones, litrosLiquidados, totalOriginal, totalReconocido, ajusteCalidad, ajustesLitros, totalConAjustes,
//              pagado, saldoLiquidaciones, adelantosSinAplicar, saldoNeto /* negativo = a favor */, entregasSinLiquidar, litrosSinLiquidar)
public record HistorialEntregaResponse(
    UUID id, LocalDateTime fechaHora, BigDecimal litrosOriginales, BigDecimal litrosEfectivos, boolean corregida,
    String zonaNombre,                 // la de ese momento; null si no se pudo determinar
    CalidadEntrega calidad,            // ADMIN, CALIDAD: resultado (último), folio, analizadoEn, analisis, alertas, precioPropio
    LiquidacionEntrega liquidacion     // ADMIN, RECEPCION; null si no está liquidada: pagoId, semanaInicio, semanaFin, litrosLiquidados, precioAplicado, importe
) {}
```

Sin DNI ni teléfono. `importe` = litros liquidados × precio aplicado sin redondear: la suma de los importes de un pago, redondeada una vez, es su `totalAPagar`.

### HistorialZonaResponse.java

```java
public record HistorialZonaResponse(
    UUID id,
    UUID zonaId,
    String zonaNombre,
    LocalDate desde,
    LocalDate hasta,
    LocalDateTime inicioEn,        // Fase A (aditivos): periodo exacto [inicioEn, finEn); finEn nulo = periodo actual
    LocalDateTime finEn,
    String zonaOrigenNombre,
    String motivo,
    String usuarioNombre,
    boolean requiereRevision,      // periodo invertido heredado: se conserva, no decide la zona de ninguna entrega
    String notaRevision
) {}
```

### RevisionZonasResponse.java (Fase A, `GET /api/admin/zonas/revision`)

```java
public record RevisionZonasResponse(
    List<PeriodoParaRevisar> periodos,        // id, proveedorId, proveedorNombre, zonaNombre, desde, hasta, nota
    long totalEntregasSinZona, int limiteEntregas,
    List<EntregaSinZona> entregasSinZona      // registroId, proveedorId, proveedorNombre, fechaHora, litros, motivo (DIA_DE_CAMBIO|SIN_PERIODO|OTRO)
) {}
```

### JornadaBandejaResponse.java

```java
public record JornadaBandejaResponse(
    UUID id,
    String uuidCliente,
    EstadoJornada estado,
    UUID unidadId,
    String unidadPlaca,
    UUID acopiadorId,
    String acopiadorNombre,
    LocalDateTime horaInicio,
    LocalDateTime horaFin,
    int cantidadAcopios,
    int cantidadProveedores,
    BigDecimal litrosEsperados
) {}
```

### JornadaDetalleResponse.java

```java
public record JornadaDetalleResponse(
    UUID id,
    String uuidCliente,
    EstadoJornada estado,
    UUID unidadId,
    String unidadPlaca,
    UUID acopiadorId,
    String acopiadorNombre,
    LocalDateTime horaInicio,
    LocalDateTime horaFin,
    BigDecimal litrosEsperados,
    List<String> proveedoresVisitados,
    List<AcopioDeJornadaResponse> acopios
) {}
```

### JornadaDTO.java

```java
public record JornadaDTO(
    @NotBlank String uuidCliente,
    @NotNull UUID unidadId,
    @NotNull LocalDateTime horaInicio,
    BigDecimal gpsLatInicio,
    BigDecimal gpsLngInicio,
    EstadoJornada estado,
    LocalDateTime horaFin,
    BigDecimal gpsLatFin,
    BigDecimal gpsLngFin,
    String motivoCancelacion
) {}
```

### JornadaEstadoRequest.java

```java
public record JornadaEstadoRequest(
    @NotBlank String uuidCliente,
    @NotNull TipoTransicionJornada tipo,
    @NotNull LocalDateTime horaEvento,
    BigDecimal gpsLat,
    BigDecimal gpsLng,
    String motivoCancelacion
) {
    public enum TipoTransicionJornada { FINALIZAR, CANCELAR }
}
```

### JornadaResponse.java

```java
public record JornadaResponse(
    UUID id,
    String uuidCliente,
    UUID unidadId,
    EstadoJornada estado,
    LocalDateTime horaInicio,
    BigDecimal gpsLatInicio,
    BigDecimal gpsLngInicio,
    LocalDateTime horaFin,
    BigDecimal gpsLatFin,
    BigDecimal gpsLngFin,
    String motivoCancelacion
) {}
```

### LoginRequest.java

```java
public record LoginRequest(
    @NotBlank @Email String email,
    @NotBlank String password
) {}
```

### LoginResponse.java

```java
public record LoginResponse(
    String token,
    String rol,
    String nombre,
    long expiraEnSegundos,
    String refreshToken,
    long refreshExpiraEnSegundos
) {}
```

### LoteProduccionResponse.java

```java
public record LoteProduccionResponse(
    UUID id,
    LocalDate fecha,
    String tipoQuesoNombre,
    BigDecimal litrosUsados,
    Integer unidadesObtenidas,
    BigDecimal rendimientoPct,
    BigDecimal rendimientoEsperadoPct,
    List<UUID> registroAcopioIds
) {}
```

### MotivoObservacionRequest.java

```java
public record MotivoObservacionRequest(@NotBlank String descripcion) {}
```

### MotivoObservacionResponse.java

```java
public record MotivoObservacionResponse(UUID id, String descripcion) {}
```

### PaginaResponse.java

```java
public record PaginaResponse<T>(
    List<T> contenido,
    int paginaActual,
    int tamanoPagina,
    long totalElementos,
    int totalPaginas
) {
    public static <T> PaginaResponse<T> de(Page<T> page) {
        return new PaginaResponse<>(page.getContent(), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages());
    }
}
```

### PagoResponse.java

```java
public record PagoResponse(
    UUID id,
    UUID proveedorId,
    String proveedorNombre,
    LocalDate semanaInicio,
    LocalDate semanaFin,
    BigDecimal litrosTotales,
    BigDecimal precioLitro,
    BigDecimal total,
    Boolean comprobanteGenerado,
    List<UUID> registroAcopioIds,   // mejora #4: trazabilidad exacta
    BigDecimal precioLitroEfectivo, // V24: precio del ajuste de precio más reciente de ESTE pago (o precioLitro si no hay)
    BigDecimal totalAPagar          // V24: litrosTotales × precioLitroEfectivo (precioLitro/total siguen siendo los originales)
) {}
```

### AjustePrecioPagoRequest.java

```java
public record AjustePrecioPagoRequest(
    @NotNull @DecimalMin("0.001") @Digits(integer = 3, fraction = 3) BigDecimal precioLitroNuevo,
    @NotBlank @Size(max = 500) String motivo
) {}
```

### AjustePrecioPagoResponse.java

```java
public record AjustePrecioPagoResponse(
    UUID id,
    UUID pagoId,
    BigDecimal precioLitroAnterior,
    BigDecimal precioLitroNuevo,
    BigDecimal totalAnterior,
    BigDecimal totalNuevo,
    String motivo,
    String usuarioNombre,
    LocalDateTime creadoEn
) {}
```

### PanelEconomicoResponse.java

```java
public record PanelEconomicoResponse(
    UUID zonaId,
    BigDecimal litrosEnRiesgoValorizados,
    PrediccionZonaResponse forecastSemana,
    List<MargenPorCanal> margenPorCanal,
    BigDecimal pctRechazoSiScoreSube10
) {
    public record MargenPorCanal(String tipoCliente, BigDecimal totalVentas) {}
}
```

### PrecioLitroRequest.java

```java
public record PrecioLitroRequest(
    @NotNull @DecimalMin(value = "0.0", inclusive = false) BigDecimal precio,
    @NotNull LocalDate vigenteDesde
) {}
```

### PrecioLitroResponse.java

```java
public record PrecioLitroResponse(
    UUID id,
    BigDecimal precio,
    LocalDate vigenteDesde
) {}
```

### PrediccionProveedorResponse.java

```java
public record PrediccionProveedorResponse(
    UUID proveedorId,
    LocalDate fechaPrevista,
    BigDecimal litrosEstimadosMin,
    BigDecimal litrosEstimadosMax
) {}
```

### PrediccionZonaResponse.java

```java
public record PrediccionZonaResponse(
    UUID zonaId,
    LocalDate semanaInicio,
    BigDecimal litrosEstimados,
    BigDecimal litrosReales,
    String recomendacionMezcla,
    BigDecimal flujoCajaProyectado,
    boolean alertaCapacidad
) {}
```

### ProveedorAdminResponse.java

```java
public record ProveedorAdminResponse(
    UUID id,
    String nombre,
    String dni,
    String telefono,
    UUID zonaActualId,
    String zonaActualNombre,
    String codigoQr,
    Boolean activo
) {}
```

### ProveedorPublicoResponse.java

```java
public record ProveedorPublicoResponse(
    UUID id,
    String nombre,
    UUID zonaActualId,
    String zonaActualNombre,
    String codigoQr
) {}
```

### ProveedorRequest.java

```java
public record ProveedorRequest(
    @NotBlank String nombre,
    @NotBlank String dni,
    String telefono,
    UUID zonaActualId
) {}
```

### ProveedorUpdateRequest.java

```java
public record ProveedorUpdateRequest(
    @NotBlank String nombre,
    @NotBlank String dni,
    String telefono
) {}
```

### PuntoGpsJornadaDTO.java

```java
public record PuntoGpsJornadaDTO(
    @NotBlank String uuidCliente,
    @NotNull UUID jornadaId,
    @NotNull @DecimalMin(value = "-90.0") @DecimalMax(value = "90.0") BigDecimal lat,
    @NotNull @DecimalMin(value = "-180.0") @DecimalMax(value = "180.0") BigDecimal lng,
    BigDecimal precisionM,                 // nullable -- solo si el dispositivo la proveyo
    @NotNull LocalDateTime capturadoEn
) {}
```

### RecepcionJornadaRequest.java

```java
public record RecepcionJornadaRequest(
    @NotBlank String uuidCliente,
    @NotNull UUID jornadaId,
    @NotNull @DecimalMin(value = "0.0", inclusive = true) BigDecimal litrosReales,
    String turno,                            // opcional, default "UNICO" (igual que RecepcionPlantaRequest)
    @NotNull LocalDateTime horaLlegada,
    String observacion                       // opcional
) {}
```

### RecepcionPlantaRequest.java

```java
public record RecepcionPlantaRequest(
    @NotNull LocalDate fecha,
    String turno,                            // opcional, default "UNICO"
    @NotNull UUID unidadId,
    @NotNull @DecimalMin("0.0") BigDecimal litrosCampo,
    @NotNull @DecimalMin("0.0") BigDecimal litrosPlanta,
    List<UUID> registroAcopioIds
) {}
```

### RecepcionPlantaResponse.java

```java
public record RecepcionPlantaResponse(
    UUID id,
    LocalDate fecha,
    String turno,
    UUID unidadId,
    BigDecimal litrosCampo,
    BigDecimal litrosPlanta,
    BigDecimal diferenciaPct,
    String estado,
    BigDecimal litrosRegistradosAcopio,
    List<UUID> registroAcopioIds,
    UUID jornadaId,
    LocalDateTime horaLlegada,
    BigDecimal diferenciaLitros,
    String observacion
) {}
```

### RefreshTokenRequest.java

```java
public record RefreshTokenRequest(
    @NotBlank String refreshToken
) {}
```

### RegistroAcopioDTO.java

```java
public record RegistroAcopioDTO(
    @NotBlank String uuidCliente,
    @NotNull UUID proveedorId,
    @NotNull UUID unidadId,
    @NotNull LocalDateTime fechaHora,
    @NotNull @DecimalMin(value = "0.0", inclusive = true) BigDecimal litros,
    BigDecimal gpsLat,
    BigDecimal gpsLng,
    UUID motivoObservacionId,           // nullable
    Boolean litrosPorVoz,
    String fotoUrl,
    UUID jornadaId
) {}
```

### RegistroAcopioResponse.java

```java
public record RegistroAcopioResponse(
    UUID id,
    String uuidCliente,
    UUID proveedorId,
    String proveedorNombre,
    UUID unidadId,
    LocalDateTime fechaHora,
    BigDecimal litros,
    BigDecimal gpsLat,
    BigDecimal gpsLng,
    String motivoObservacion,
    Boolean litrosPorVoz,
    LocalDateTime sincronizadoEn,
    String fotoUrl,
    Boolean disponibleParaLote
) {}
```

### RegistroAcopioResumenResponse.java

```java
public record RegistroAcopioResumenResponse(
    UUID id,
    LocalDateTime fechaHora,
    BigDecimal litros,
    boolean tieneObservacion,
    boolean disponibleParaLote
) {}
```

### RolResponse.java

```java
public record RolResponse(
    UUID id,
    String nombre
) {}
```

### RutaItemRequest.java

```java
public record RutaItemRequest(
    @NotNull UUID proveedorId,
    @NotNull @Min(1) Integer orden,
    LocalTime horaEstimada
) {}
```

### RutaProveedorOrdenResponse.java

```java
public record RutaProveedorOrdenResponse(
    UUID id,
    UUID proveedorId,
    String proveedorNombre,
    Integer orden,
    LocalTime horaEstimada
) {}
```

### ScoreConfianzaResponse.java

```java
public record ScoreConfianzaResponse(
    UUID proveedorId,
    LocalDate periodo,
    BigDecimal score,
    BigDecimal componenteCalidad,
    BigDecimal componenteRegularidad,
    BigDecimal componenteAnomalias
) {}
```

### SyncResultResponse.java

```java
public record SyncResultResponse(
    List<String> confirmados,
    List<SyncErrorItem> errores,
    List<ConfirmacionItem> confirmadosConId
) {
    public record SyncErrorItem(String uuidCliente, String motivo) {}
    public record ConfirmacionItem(String uuidCliente, UUID id) {}
}
```

### TipoQuesoRequest.java

```java
public record TipoQuesoRequest(
    @NotBlank String nombre,
    @NotNull BigDecimal rendimientoEsperadoPct,
    @NotBlank String cicloCapital    // RAPIDO | MADURACION
) {}
```

### TipoQuesoResponse.java

```java
public record TipoQuesoResponse(
    UUID id,
    String nombre,
    BigDecimal rendimientoEsperadoPct,
    String cicloCapital,
    Boolean activo
) {}
```

### UnidadRequest.java

```java
public record UnidadRequest(
    @NotBlank String placa,
    BigDecimal capacidadTon,
    UUID zonaId,
    @NotNull UUID responsableId    // mejora #2: obligatorio
) {}
```

### UnidadResponse.java

```java
public record UnidadResponse(
    UUID id,
    String placa,
    BigDecimal capacidadTon,
    UUID zonaId,
    UUID responsableId,
    String responsableNombre
) {}
```

### UsuarioMeResponse.java

```java
public record UsuarioMeResponse(
    UUID id,
    String nombre,
    String email,
    String rolNombre,
    Boolean activo,
    List<UUID> unidadesResponsable
) {}
```

### UsuarioRequest.java

```java
public record UsuarioRequest(
    @NotBlank String nombre,
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8) String password,
    @NotBlank String rolNombre   // ACOPIADOR | CALIDAD | RECEPCION | PRODUCCION | VENTAS | ADMIN
) {}
```

### UsuarioResponse.java

```java
public record UsuarioResponse(
    UUID id,
    String nombre,
    String email,
    String rolNombre,
    Boolean activo
) {}
```

### UsuarioUpdateRequest.java

```java
public record UsuarioUpdateRequest(
    @NotBlank String nombre,
    @NotBlank @Email String email,
    @NotBlank String rolNombre,
    @Size(min = 8, message = "debe tener al menos 8 caracteres") String nuevaPassword
) {}
```

### VentaRequest.java

```java
public record VentaRequest(
    @NotBlank String uuidCliente,
    @NotNull LocalDate fecha,
    @NotBlank String tipoCliente,           // MAYORISTA | PROVEEDOR | PUBLICO
    @NotNull UUID tipoQuesoId,
    @NotNull @Min(1) Integer cantidad,
    @NotNull @DecimalMin("0.0") BigDecimal precioUnitario
) {}
```

### VentaResponse.java

```java
public record VentaResponse(
    UUID id,
    LocalDate fecha,
    String tipoCliente,
    String tipoQuesoNombre,
    Integer cantidad,
    BigDecimal precioUnitario,
    BigDecimal total
) {}
```

### ZonaRequest.java

```java
public record ZonaRequest(@NotBlank String nombre) {}
```

### ZonaResponse.java

```java
public record ZonaResponse(UUID id, String nombre, Boolean activa) {}
```


