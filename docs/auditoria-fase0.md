# Fase 0: auditoría de pagos, calidad, zonas, historial e IGV

Fecha: 2026-10-23. Estado: **solo auditoría y planificación; nada de esto está implementado.** No hay código, migraciones ni cambios de
base de datos derivados de este documento. Implementar requiere autorización explícita del usuario, fase por fase.

Marcas usadas en todo el documento:

- **[C]** comprobado en el código, las migraciones, las pruebas o los datos.
- **[I]** inferencia razonada, no comprobada.
- **[R]** recomendación de diseño.

## 0. Método y límites

- **Código auditado:** rama `feature/excel-import-export` (backend `ecolacteos-backend-excel` y panel `Ecolacteos-Web-excel`), que incluye `main`
  (ajuste de pago, búsqueda y paginación) y la exportación e importación de Excel. No se tocó la segunda copia del backend que existe dentro de
  `acopio-mobile`.
- **Base de datos:** [C] hay una base de **desarrollo**, `acopio_lechero` (PostgreSQL 17 local, Flyway en V26). Se consultó con la conexión que el
  proyecto ya tiene configurada para desarrollo (`application.yml`), en **sesión de solo lectura** (`default_transaction_read_only=on`) y solo con
  `SELECT`. **No se accedió a ninguna base de producción.** La base de desarrollo contiene datos de prueba (zonas «Zona Prueba», «Zona Test Movil»):
  sus cifras **no son hechos de producción**.
- **Pruebas:** no se ejecutó ninguna en esta fase (compilar modifica `target/`, que está versionado en el backend). Las pruebas se citan por nombre
  y por el último resultado conocido: 877 unitarias y de permisos (WebMvc), y 203 de integración en PostgreSQL 17 temporal.
- **Normativa tributaria:** consultada en fuentes de SUNAT (enlaces al final). Algunas son secundarias o antiguas; lo no confirmado se marca para
  el contador.

## 1. Hallazgos confirmados

### Qué existe y funciona

- [C] **Liquidación semanal por proveedor.** `PagoService.generar` toma los acopios del proveedor en el rango, suma los litros, aplica el precio por
  litro vigente y crea el `Pago`. La tabla `pago` (V1) tiene `UNIQUE(proveedor_id, semana_inicio)`. El total es una columna generada
  (`litros_totales * precio_litro`).
- [C] **Vínculo exacto pago-acopio:** `pago_registro_acopio`. Un acopio ya liquidado se rechaza con `PagoRepository.existeRegistroYaLiquidado`.
  Prueba: `PagoServiceTest.rechazaGenerarPagoSiAlgunRegistroYaFueLiquidadoEnOtroPago`. En la base de desarrollo: 0 acopios en más de un pago y 0 pagos
  con rangos solapados.
- [C] **Ajustes sin modificar el pago original.**
  - `AjustePago` (litros): se crea cuando se corrige un acopio ya liquidado (`CorreccionRegistroService.anexar` →
    `AjustePagoService.generarSiCorrespondeAjuste`). Está valorizado al precio del pago original. Tiene `UNIQUE(correccion_registro_id)` (V1), así que
    no se repite. Pruebas: `AjustePagoServiceTest` (7).
  - `AjustePrecioPago` (V24): append-only, guarda precio anterior, nuevo, motivo, usuario y fecha. Rechaza un precio igual al actual. Pruebas:
    `AjustePrecioPagoServiceTest` (9) y `AjustePrecioPagoAuthorizationWebMvcTest` (8).
  - `PagoResponse` entrega `precioLitroEfectivo` y `totalAPagar` (con el ajuste de precio más reciente).
- [C] **Historial del proveedor en el panel, ya parcial:** `ProveedorDetalleDialog` (General con QR, score y predicción; Zonas; Pagos con ajustes) y
  `HistorialProveedorDialog` (entregas paginadas en el servidor; análisis de calidad por entrega cargado bajo demanda).
- [C] **Boleta PDF** de liquidación (`BoletaPagoService`), declarada «documento interno, no es una boleta ni una factura».
- [C] **Permisos de pagos:** `GET` para ADMIN y RECEPCION; generar, marcar comprobante, ajustar precio y liquidar ajustes solo ADMIN
  (`PagoController`).

### Qué funciona parcialmente

- [C] **«Pago» es la deuda, no el dinero entregado.** Solo existe `pago.comprobante_generado` (booleano). `ALCANCE.md` dice «no desembolso
  registrado». `ajuste_pago.pago_liquidacion_id` existe en la entidad (`AjustePago.pagoLiquidacion`) pero **nunca se asigna**; liquidar un ajuste solo
  cambia su estado a LIQUIDADO (`AjustePagoService.liquidar`).
- [C] **Historial de zona:** `historial_zona` existe (V1), pero solo tiene `proveedor_id`, `zona_id`, `desde` y `hasta` (tipo `DATE`). No guarda hora,
  motivo, usuario ni zona de origen, y no tiene `creado_en`.
- [C] **Calidad:** hay análisis (`analisis_calidad`), alertas (`alerta_anomalia`), score y observaciones, pero nada de eso afecta la liquidación
  (sección 2).
- [C] **Zona de la entrega:** `registro_acopio` no tiene zona. Los filtros y reportes usan la zona **actual** del proveedor
  (`RegistroAcopioRepository`, filtro `p.zona_actual_id`; `findLitrosPorZonaYRango`; `AlertaAnomaliaRepository.findPorZonaDesde`; `ForecastingService`).
  Al cambiar un proveedor de zona, sus entregas antiguas se muestran bajo la zona nueva.

### Qué falta

- [C] Pagos efectivos (efectivo, depósito o transferencia), adelantos, pagos parciales y saldos.
- [C] Zona guardada en cada entrega.
- [C] Historial consolidado con totales, saldos e irregularidades de calidad por proveedor (las alertas solo se consultan por zona, en los últimos
  30 días: `GET /api/innovacion/alertas?zonaId=`).
- [C] Cualquier dato fiscal (sección 5).

### Defectos concretos

1. [C] `ProveedorService.reasignarZona` cierra el periodo abierto con `hasta = hoy - 1`. Si se reasigna el mismo día en que se abrió, queda un periodo
   invertido (`hasta < desde`). **Ya ocurrió:** 3 filas invertidas en la base de desarrollo. No hay pruebas de `reasignarZona` en `ProveedorServiceTest`.
   Además no impide reasignar a la misma zona, y `abrirHistorialZona` usa `LocalDate.now()` del servidor, no la hora de Lima.
2. [C] `PagoService.generar` usa `precioLitroRepository.findVigenteHoy()`: el precio del **día en que se genera**, no el de la entrega. Caso en la base
   de desarrollo: el pago de la semana 2026-09-09 a 2026-09-16 se generó el 2026-09-16 a S/ 1.000, cuando el precio 1.540 regía durante esa semana.
3. [C] **Corrección de litros anterior a la liquidación.** `CorreccionRegistroService` declara que `RegistroAcopio` «nunca se edita», y el único
   `setLitros` está en `RegistroAcopioService.crear`. Pero [C] **las 36 correcciones** de la base de desarrollo tienen
   `registro_acopio.litros = litros_corregido` (35 anteriores a la liquidación): algo reescribió esos litros (script o versión anterior del código;
   origen no determinado). [I] Por el código, una corrección hecha **antes** de liquidar no afectaría al pago, porque `generar` suma
   `RegistroAcopio::getLitros` (el original). No hay prueba que lo cubra.
4. [C] La clave primaria de `pago_registro_acopio` es `(pago_id, registro_acopio_id)`: que un acopio no esté en dos liquidaciones lo garantiza solo una
   consulta, no la base. [I] Dos liquidaciones simultáneas con rangos distintos podrían liquidar el mismo acopio.
5. [C] `AjustePrecioPagoService.crear` lee el precio «anterior» sin bloqueo. [I] Dos solicitudes concurrentes podrían registrar dos ajustes con el mismo
   «anterior».

## 2. Ajustes de calidad: comportamiento actual

### Estados y cómo se generan

- [C] El enum `ResultadoCalidad` y el `CHECK` de V1 admiten `APROBADO`, `RECHAZADO` y `OBSERVADO`.
- [C] `AnalisisCalidadService.registrarOIgnorarSiDuplicado` (líneas 54 a 60) solo produce `RECHAZADO` si `aguaAnadida = true`; en cualquier otro caso
  `APROBADO`. **Ningún código genera `OBSERVADO`.**
- [C] En la base de desarrollo hay 230 análisis `OBSERVADO` (de 2026-06-08 a 2026-09-08), 45 `RECHAZADO` con agua añadida y 1 `RECHAZADO` sin agua
  añadida. Los `OBSERVADO` no pueden provenir del código actual (origen desconocido).

### Qué ajustes se producen y cuáles no

| Mecanismo | Se activa por | Calidad |
|---|---|---|
| `AjustePago` (litros) | Corrección de litros posterior a la liquidación | **No** interviene |
| `AjustePrecioPago` (precio) | Acción manual de ADMIN: `POST /api/pagos/{id}/ajuste-precio` | **No** interviene; el vínculo es solo el texto libre del motivo |
| `PagoService.generar` | Genera la liquidación | **No consulta calidad** en ningún punto |

- [C] **No existe ajuste automático por calidad.** Se buscó en todo el backend dónde se crean `AjustePago` y `AjustePrecioPago`: solo en los dos
  puntos de la tabla.
- [C] **No hay tabla de equivalencias, umbrales, porcentajes ni categorías** que conviertan calidad en precio. Los únicos umbrales de
  `configuracion_sistema` son `UMBRAL_ANOMALIA_Z_SCORE` (2.0) y `UMBRAL_CONCILIACION_PCT` (2.5); ninguno toca precios.
- [C] **Lo que parece un ajuste por calidad es manual.** Hay 1 `ajuste_precio_pago`: de 1.000 a 1.100, motivo «leche de buena calidad», creado por
  `admin@planta.com` el 2026-10-21. Todas las entregas de ese pago están `APROBADO`. El comentario de `AjustePrecioPagoService` cita como ejemplo
  «mala calidad: 1.00 → 0.80».
- [C] **El ajuste de precio se aplica a la liquidación completa**, no a una entrega.

### Ejemplo ilustrativo (no es una regla de negocio)

Liquidación de 600 L a S/ 1.00 = S/ 600.00. Si 100 L de calidad deficiente debieran pagarse a 0.90, el total correcto sería
500 × 1.00 + 100 × 0.90 = **S/ 590.00**. Con el mecanismo actual solo se puede cambiar el precio de todo el pago: 590 / 600 = 0.98333…, que con
`NUMERIC(6,3)` queda en 0.983 y da **S/ 589.80** (error de S/ 0.20). Por eso hace falta el precio por entrega.

### Registro, duplicados, cambios y reversión

- [C] **Qué queda registrado:** precio normal (`pago.precio_litro`), precio nuevo (`ajuste_precio_pago.precio_litro_nuevo`), motivo, usuario y fecha;
  se consultan en `GET /api/pagos/{id}/ajustes-precio` y en `PagoResponse`. [C] **Falta** el vínculo estructurado con el análisis de calidad y con
  la entrega.
- [C] **Duplicados:** `AjustePago`, protegido por `UNIQUE(correccion_registro_id)`; `AjustePrecioPago` rechaza un precio igual al vigente, pero [I] sin
  bloqueo ante concurrencia (defecto 5).
- [C] **Si cambia el resultado de calidad después de liquidar o pagar:** no ocurre nada. Hay 1 análisis posterior a una liquidación en la base de
  desarrollo, y es `APROBADO`.
- [C] **Revertir o corregir un ajuste:** no hay anulación; se registra un nuevo ajuste al precio anterior. No existe reverso de `AjustePago`.
- [C] **Qué ocurre con cada resultado.** Último resultado por entrega (base de desarrollo):

| Último resultado | Entregas | Liquidadas | Litros |
|---|---:|---:|---:|
| APROBADO | 1868 | 1825 | 125 541,48 |
| OBSERVADO | 229 | 221 | 15 262,73 |
| RECHAZADO | 45 | **0** | 3 327,20 |
| Sin análisis | 1134 | 936 | 77 912,80 |

  - Las entregas observadas se pagan al precio normal.
  - Ninguna de las 45 entregas rechazadas está liquidada, pero [C] **ningún código lo impide** (`PagoService.generar` no filtra por calidad).
    [I] Es práctica operativa o casualidad de los datos de desarrollo, no una regla.
- [C] **Reportes:** la lista de pagos y la boleta muestran el precio y el total efectivos. El contrato móvil (`PagoResponse.kt`, en `acopio-mobile`) solo
  trae `precioLitro` y `total` originales; la app móvil lo lee con `ignoreUnknownKeys = true` (`JsonConfig.kt`), así que los campos nuevos al final no
  la rompen.

### Qué conservar, qué corregir, qué añadir

- **Conservar [R]:** `AjustePago`, `AjustePrecioPago`, la inmutabilidad de `pago` y la restricción `UNIQUE(correccion_registro_id)`.
- **Corregir [R]:** defectos 2 a 5 de la sección 1; definir qué hacer con `OBSERVADO` (usarlo con una regla o retirarlo).
- **Añadir [R]:** precio normal y precio aplicado **por entrega**, con vínculo al análisis y motivo (sección 5), sin crear un segundo sistema de
  descuentos.

## 3. Datos históricos de zonas (base de desarrollo, solo lectura)

| Consulta | Resultado [C] |
|---|---|
| Proveedores sin historial | 0 de 42 |
| Más de un periodo abierto, o periodo abierto distinto de `zona_actual_id` | 0 |
| Solapes entre periodos del mismo proveedor | 0 |
| Periodos invertidos (`hasta < desde`) | **3**, de un solo proveedor (Absalón Ortiz Ramos), por movimientos del mismo día: 2026-09-30 y 2026-10-22 |
| Entregas cubiertas por exactamente 1 periodo (por fecha) | **3276 de 3276** |
| Entregas anteriores al primer periodo de su proveedor | 0 |
| Entregas de proveedores con cambio de zona, mostradas hoy bajo la zona nueva | **324** (4 proveedores) |
| Entregas hechas el día de un cambio de zona (ambiguas por hora) | 3 |

Distribución de proveedores por número de filas de historial: 35 con 1, 6 con 2 y 1 con 7.

### Qué puede recuperarse de forma segura

- [C] La zona de cada entrega **por fecha**, para las 3276 entregas de la base de desarrollo.
- [C] Cada movimiento con su destino y su fecha, y el origen como el periodo anterior del mismo proveedor.

### Qué no puede recuperarse

- [C] La **hora** de los movimientos, el **motivo** y el **usuario**: nunca se guardaron.
- [C] El **orden** de los movimientos del mismo día: `historial_zona` no tiene `creado_en` y sus `id` son UUID aleatorios.
- [I] Que las fechas de inicio de 2023 y 2024 sean reales: son anteriores a la primera entrega (2026-06-08).

### Casos de revisión manual

- Las 3 filas invertidas de Absalón Ortiz Ramos [I] (parecen ruido de pruebas: sin entregas en esos periodos; la zona actual es coherente con el
  periodo abierto).
- Las 3 entregas del día de cambio, que hoy solo se asignan al periodo nuevo.

### Corrección propuesta [R]

1. Agregar de forma **aditiva** a `historial_zona`: `inicio_en` y `fin_en` (timestamps), `zona_origen_id`, `motivo`, `usuario_id` y una marca de
   revisión. Rellenar con las fechas existentes (`inicio_en` = `desde` 00:00; `fin_en` = día siguiente a `hasta`, 00:00).
2. Las filas invertidas o de duración cero **no se borran**: se marcan para revisión y se excluyen de la resolución por fecha.
3. Agregar `registro_acopio.zona_id` **nulo**, rellenado solo cuando un único periodo válido cubre la fecha de la entrega. Si no, queda nulo y
   marcado para revisión (no se inventa una zona).
4. A futuro, el servidor asigna la zona según la `fecha_hora` de la entrega (hora de captura), no según la hora de sincronización ni la del servidor.
5. `reasignarZona` pasa a usar timestamps, impide reasignar a la misma zona y registra motivo y usuario.
6. Los reportes por zona (acopios, forecasting, alertas, panel económico) cambian a `registro_acopio.zona_id` en una fase separada, con aviso previo
   de que los números históricos por zona cambiarán.

## 4. Decisiones

### Confirmadas por el usuario

1. **Permisos:** ADMIN y RECEPCIÓN pueden registrar y consultar los pagos a proveedores.
2. **Pagos:** se admiten liquidaciones semanales, pagos parciales y adelantos.
3. **Zonas:** cada entrega debe conservar la zona que le correspondía cuando se realizó.
4. **Calidad:** una entrega con calidad deficiente puede pagarse a un precio por litro inferior al normal (el ejemplo de S/ 1.00 a S/ 0.90 es solo
   ilustrativo). Antes de definir o modificar reglas debe auditarse el mecanismo existente (hecho en la sección 2).
5. **Proveedores:** existen proveedores con RUC y sin RUC.
6. **Restricciones de trabajo:** no modificar la segunda copia del backend dentro de `acopio-mobile`; no reemplazar ni eliminar `AjustePago` ni
   `AjustePrecioPago` sin justificación técnica; no inventar porcentajes, precios por categoría ni reglas de penalización; no decidir por su cuenta qué
   hacer con la leche rechazada; no implementar sin autorización explícita.

### PENDIENTES (todas siguen pendientes hasta que el usuario diga lo contrario)

| N.º | Decisión | Estado |
|---|---|---|
| 1 | **Regla calidad→precio:** categorías, umbrales y precios; qué campos del análisis pesan (agua, proteína, densidad, temperatura, pH); qué significa `OBSERVADO`; si el precio menor se aplica automáticamente o por aprobación manual. | **PENDIENTE** |
| 2 | **Leche rechazada y observada:** pagar al precio normal, pagar a precio reducido (exige la decisión 1) o no liquidar y retener (exige un estado «retenida» y su resolución). Cada opción tiene consecuencias distintas en saldos y reportes. | **PENDIENTE** |
| 3 | **Fecha de referencia del precio normal:** el día de la liquidación (comportamiento actual), el día de cada entrega o el inicio de la semana. | **PENDIENTE** |
| 4 | **Combinación del ajuste manual de `AjustePrecioPago` con el precio por entrega por calidad:** si el manual reemplaza al de calidad o se acumulan. | **PENDIENTE** |
| 5 | **Litros efectivos** tras una corrección anterior a la liquidación (defecto 3): definir la fuente de verdad (el último `litros_corregido` o el registro original). | **PENDIENTE** |
| 6 | **Tributario con el contador:** afectación de cada producto (quesos, yogur, mantequilla, otros), si los precios incluyen IGV, régimen tributario, obligación de comprobante electrónico, y tratamiento de las compras (liquidación de compra y retenciones). | **PENDIENTE** |
| 7 | **Revisión manual de los casos de zona:** las 3 filas invertidas de Absalón Ortiz Ramos y las 3 entregas del día de cambio. | **PENDIENTE** |

Recomendación sin decisión pendiente [R]: que la anulación de un pago efectivo sea solo de ADMIN.

## 5. Diseño propuesto [R]

### Pagos efectivos (extender, no duplicar)

`pago` sigue siendo la **liquidación** (la deuda). Se añaden dos tablas, porque hoy no existe ningún concepto de desembolso:

- `pago_proveedor` (dinero realmente entregado):
  - Campos: `proveedor_id`, fecha y hora, `modalidad` (EFECTIVO, TRANSFERENCIA o DEPOSITO), `monto`, `concepto`, banco, `nro_operacion`,
    `nro_recibo`, `observacion`, usuario y `uuid_cliente`.
  - Restricciones: monto mayor que cero; índice único parcial por `(banco, nro_operacion)` cuando existen; reenvío idempotente por `uuid_cliente`.
  - Anulación por estado y motivo, **sin borrar**; los importes no se editan.
- `pago_proveedor_aplicacion` (`pago_proveedor_id`, `pago_id` **o** `ajuste_pago_id`, `monto`):
  - Permite un pago parcial, un pago que cubra varias liquidaciones y un adelanto (pago sin aplicar o con saldo sin aplicar).
  - `ajuste_pago_id` aprovecha el vínculo que hoy nunca se usa (`pago_liquidacion_id`).
- **Saldo** de una liquidación = `totalAPagar` menos las aplicaciones vigentes. No se guarda un estado «pagado» duplicado.
- **Controles:** bloqueo de la fila del pago al aplicar; se rechaza pasarse del saldo o del monto del pago; si un ajuste de precio posterior deja un
  saldo negativo, se muestra como saldo a favor.
- **Permisos:** ADMIN y RECEPCION registran y consultan (decisión confirmada). Los endpoints no exponen DNI ni teléfono (hoy solo ADMIN los ve).
- **Datos bancarios:** guardar solo banco y referencia; no guardar cuentas completas.
- **Constancia:** `ArchivoController` solo permite subir a ACOPIADOR y ADMIN, y leer a ACOPIADOR, ADMIN y CALIDAD [C]: habría que ampliar los
  permisos para RECEPCION.

### Calidad por entrega (sin segundo sistema de descuentos)

- Ampliar `pago_registro_acopio`, que ya vincula liquidación y acopio, para que sea la **línea de liquidación**: agregar `litros_liquidados`,
  `precio_normal`, `precio_aplicado`, `analisis_calidad_id` y `motivo_ajuste`.
- Ajuste económico de la línea = `litros × (precio_normal − precio_aplicado)`. La liquidación suma esas diferencias. Precio con 3 decimales por línea y
  redondeo del importe una sola vez al final.
- `pago.total` es una columna generada y se conserva; el total reconocido sería `total + ajuste_calidad` (más lo que se decida en la decisión 4).
- Primero, el precio por entrega se aplica **a mano, con motivo y análisis vinculado**. La regla automática queda pendiente (decisiones 1 y 2).
- Trazabilidad completa: entrega → análisis → precio normal → precio aplicado → ajuste económico → liquidación → pagos efectivos.

### Historial consolidado

| Ya existe [C] | Falta |
|---|---|
| `GET /api/registros-acopio/proveedor/{id}/paginado` | Zona histórica, resultado de calidad y precio por entrega |
| `GET /api/analisis-calidad/registro/{id}` | Irregularidades del proveedor: análisis distintos de APROBADO, alertas por proveedor, observaciones, correcciones |
| `GET /api/pagos/proveedor/{id}`, `/{id}/ajustes`, `/{id}/ajustes-precio` | Pagos efectivos, adelantos y saldos |
| `GET /api/proveedores/{id}/historial-zona`; `GET /api/innovacion/score|prediccion/{id}` | Resumen con totales: litros, liquidado (normal y ajustado), pagado y saldo |
| | Movimientos de zona con motivo, usuario y hora |

- Endpoints nuevos: `GET /api/proveedores/{id}/historial/resumen` y `GET /api/proveedores/{id}/historial/entregas`; el resto amplía los existentes.
  Son lecturas sobre tablas existentes, sin duplicar datos.
- Las secciones se muestran según el rol: pagos para ADMIN y RECEPCION; calidad para CALIDAD y ADMIN.

### Zonas históricas

Ver la sección 3 (propuesta de corrección y vínculo de cada entrega con su zona).

### IGV, RUC y documentos de respaldo

**Comprobado en el código y la base [C]**

- No existe ninguna columna fiscal: la consulta sobre todo el esquema solo encuentra `pago.comprobante_generado`.
- `proveedor` solo tiene `nombre`, `dni` (obligatorio y único), `telefono` y zona. **No representa bien a un proveedor que solo tenga RUC.**
- Ventas y reservas tienen un único precio (`venta_detalle.precio_unitario`, `precio_presentacion.precio`, `reserva_detalle.precio_unitario`); no se
  distingue entre precio con impuestos y sin impuestos. `venta.total` es la suma de los subtotales de línea.
- Hay 62 ventas de tipo `PROVEEDOR`: son **ventas** a proveedores, con tratamiento distinto al de las **compras** de leche.
- `DECISIONES.md` (línea 153) deja fuera facturas, cobros y clientes identificados.
- **Aviso:** la importación de proveedores desde Excel valida el DNI con exactamente 8 dígitos y **rechazaría un RUC**; hay que ajustarla al agregar el
  RUC.

**Normativa (fuentes de SUNAT; parcial)**

- La leche cruda entera (subpartida 0401.20.00.00) figura en el Apéndice I del IGV como exonerada, con posibilidad de renunciar a la exoneración
  (artículo 7). En la página consultada no aparecen quesos, yogur ni mantequilla, pero esa copia está fechada en 2007: hay que revisar el texto vigente.
- Si se renuncia, la leche cruda entera está sujeta a detracción (4 % según la Resolución 152-2018).
- Las compras a personas naturales productoras sin RUC requieren **liquidación de compra** emitida por el comprador; si el proveedor tiene RUC, no
  (Informe 146-2019 y oficios de SUNAT).
- La retención de 1,5 % (Resolución 011-2006) y la detracción de 4 % son normas antiguas: **vigencia por validar**.
- La tasa de 18 % (16 % de IGV más 2 % de IPM) es conocimiento general, **no confirmado en las fuentes consultadas**.
- Una fuente secundaria menciona cambios de 2026 sobre liquidaciones de compra que **no pudieron confirmarse**.

**Requiere validación con un contador:** afectación de cada producto, si los precios incluyen IGV, régimen tributario del negocio, obligación de
comprobante electrónico, y tratamiento de las compras de leche (liquidación de compra, retenciones, detracciones).

**Diseño [R]** (sin cálculos tributarios ni emisión de comprobantes electrónicos en esta etapa)

- **Afectación por presentación:** campo con valor «sin definir» por defecto, de modo que no se aplique impuesto automáticamente; luego GRAVADO,
  EXONERADO o INAFECTO.
- **Tasa:** tabla de parámetros con vigencia, como la serie de precios.
- **Líneas de venta:** guardar base, tasa e IGV por línea (`venta_detalle`; en las reservas, al confirmar o retirar). Las ventas históricas quedan
  «sin determinar» y **no se recalculan**.
- **Separar** el importe de la venta, el impuesto y el cobro del cliente; los cobros quedan para otra fase.
- **Compras de leche:** campos opcionales de documento de respaldo (tipo, serie, número, fecha) en la liquidación y el pago efectivo; en el proveedor,
  RUC y condición. Sin cálculos hasta confirmar con el contador.

## 6. Módulos afectados

**Migraciones nuevas (V27 en adelante)**

- `historial_zona` y `registro_acopio.zona_id`.
- `pago_proveedor` y `pago_proveedor_aplicacion`.
- Columnas nuevas en `pago_registro_acopio`.
- Campos tributarios en `proveedor`, `presentacion`, `venta_detalle` y `reserva_detalle`.

**Backend**

- Zonas: `ProveedorService.reasignarZona` y `abrirHistorialZona`; `RegistroAcopioService` y `RegistroAcopioRepository` (filtro por zona);
  `ForecastingService`, `AnomaliaService`, `AlertaAnomaliaRepository.findPorZonaDesde`, `PanelEconomicoService`.
- Pagos: `PagoService`, `PagoController`, `PagoRepository`, `BoletaPagoService`, `AjustePagoService`, `AjustePrecioPagoService`.
- Calidad: `AnalisisCalidadService`, `AnalisisCalidadRepository`.
- Archivos: `ArchivoController` (permisos para constancias).
- Sincronización y DTO: `SyncService`, `RegistroAcopioResponse`, `PagoResponse` (solo campos al final).
- Ventas y reservas: `VentaService`, `ReservaService`.
- Importación de proveedores por Excel (DNI y RUC).

**Panel**

- Pagos: `PagosPage`, `PagoDetalleDialog`, `GenerarPagoDialog`.
- Proveedor: `ProveedorDetalleDialog`, `CambiarZonaDialog` (motivo), `HistorialProveedorDialog`.
- Acopios, calidad, ventas y reservas; las exportaciones a Excel que usan estos DTO.

**Móvil**

- Solo lectura de pagos. `JsonConfig` usa `ignoreUnknownKeys = true`, así que los campos aditivos no rompen la app. No tocar la segunda copia del
  backend dentro de `acopio-mobile`.

## 7. Plan por fases [R]

| Fase | Contenido | Depende de |
|---|---|---|
| A. Zonas | V27 aditiva; corregir `reasignarZona`; motivo, usuario y hora; `zona_id` en la entrega con relleno; informe de revisión manual. Los reportes aún no cambian. | Decisión 7 |
| B. Pagos efectivos | Tablas, servicio, endpoints, pantallas, constancia y permisos de RECEPCION. | Decisión 5 |
| C. Calidad por entrega | Línea de liquidación con precio normal y aplicado; aplicación manual con motivo y vínculo al análisis. | Decisiones 3 y 4 |
| D. Historial consolidado | Endpoints de resumen y entregas; pestañas en el perfil. | A, B y C |
| E. Reportes por zona histórica | Cambiar filtros y reportes a `registro_acopio.zona_id`, con aviso previo de que los números históricos por zona cambiarán. | A |
| F. Regla de calidad y de rechazadas | Regla automática, si se aprueba. | Decisiones 1 y 2 |
| G. Tributario | Parámetros, afectación por producto, snapshot por línea, documentos de respaldo. | Decisión 6 |

Cada fase se autoriza por separado; ninguna comienza sin autorización explícita.

## 8. Criterios de aceptación

- **A. Zonas:**
  - Reasignar el mismo día no deja ninguna fila con `hasta < desde`, y reasignar a la misma zona se rechaza.
  - Una entrega sincronizada tarde conserva la zona de su `fecha_hora`.
  - El relleno deja 0 entregas con zona distinta a la que indica el historial; las que no se pueden determinar quedan nulas y marcadas.
  - Se verifican los 4 proveedores y las 324 entregas de la base de desarrollo.
  - Pruebas de integración en PostgreSQL real.
- **B. Pagos efectivos:**
  - Un pago aplicado nunca supera su monto ni el saldo de la liquidación.
  - Reintentar con el mismo `uuid_cliente`, o con la misma operación bancaria, no crea un segundo pago.
  - Anular conserva la fila y deja el saldo correcto.
  - Prueba de concurrencia: dos aplicaciones simultáneas a la misma liquidación.
  - RECEPCION no ve DNI ni teléfono; prueba de la matriz de permisos.
- **C. Calidad por entrega:**
  - El ejemplo de la sección 2 da exactamente S/ 590.00 (redondeo una sola vez).
  - Cada precio aplicado enlaza con su análisis y su motivo.
  - `AjustePago` y `AjustePrecioPago` conservan su comportamiento actual (las pruebas existentes siguen pasando).
- **D. Historial:** los totales cuadran con la suma de las líneas; cada sección se muestra solo al rol autorizado.
- **E. Reportes por zona:** los totales por zona de un proveedor que cambió de zona reflejan la zona histórica de cada entrega.
- **Regresión en todas las fases:** las pruebas existentes siguen pasando (877 unitarias y de permisos, y 203 de integración con el último
  resultado conocido); permisos de pagos y proveedores; sincronización móvil; importación y exportación de Excel.

## Fuentes

- [Apéndice I del IGV (SUNAT)](https://www.sunat.gob.pe/legislacion/tributaria/igv/ley/apendice.htm)
- [Capítulo II de la Ley del IGV (SUNAT)](https://www.sunat.gob.pe/legislacion/igv/ley/capitul2.htm)
- [Resolución de Superintendencia 152-2018](https://www.sunat.gob.pe/legislacion/superin/2018/152-2018.pdf)
- [Informe 146-2019-SUNAT/7T0000 (liquidación de compra)](https://www.sunat.gob.pe/legislacion/oficios/2019/informe-oficios/i146-2019-7T0000.pdf)
- [Liquidación de compra (orientación SUNAT)](https://orientacion.sunat.gob.pe/06-liquidacion-de-compra)
- [Resolución de Superintendencia 011-2006](https://www.sunat.gob.pe/legislacion/superin/2006/011.htm)
- [Resolución de Superintendencia 000391-2025](https://www.sunat.gob.pe/legislacion/superin/2025/000391-2025.pdf)
