# Decisiones de producto y alcance

## 2026-10-23 — Fase E, reportes por zona histórica

- **Los reportes por zona usan la zona de cada entrega**, no la actual del proveedor (autorizado por el usuario, sabiendo que cambia cifras históricas). Documentado con comparación antes/después sobre los mismos datos.
- **Una entrega sin zona determinada no se atribuye a ninguna zona** (no se rellena con la zona actual ni se repara): sigue visible sin filtro de zona y en «Revisión de zonas». La suma de las zonas puede ser menor que el total sin filtro.
- **El score de confianza por zona no cambia**: es una propiedad del proveedor, no de una entrega. Tampoco el filtro de proveedores por zona (es un estado actual).
- **El panel solo avisa**; no calcula ni reasigna zonas.

## 2026-10-23 — Fase D, historial consolidado

- **Las secciones las decide el servidor por rol** (no el panel): calidad para ADMIN y CALIDAD, pagos para ADMIN y RECEPCION, zonas solo ADMIN; una sección no autorizada llega nula y el panel no la muestra.
- **La zona de cada entrega es la de ese momento** (Fase A); si no se pudo determinar se muestra «Sin zona» y no se rellena con la zona actual.
- **Los totales no se recalculan en Angular**: salen del servidor, de las mismas fuentes que Pagos y Pagos a proveedores, y se prueba que cuadran con las líneas.
- **Las entregas sin liquidar se avisan aparte** y no entran en los totales de liquidaciones.

## 2026-10-23 — Pagos efectivos

- **Los ajustes de litros entran dentro del saldo de su liquidación** (decisión del usuario): saldo = total a pagar + ajustes de litros − pagos aplicados; negativo = saldo a favor. «Liquidar ajuste» sigue siendo
  solo la marca que congela el precio.
- **Un pago sin aplicar es un adelanto** y se aplica después (no hay estado «pagado» guardado: se deriva).
- **Anular es solo de ADMIN, con motivo, y no borra**: el pago se conserva y sus aplicaciones dejan de contar. ADMIN y RECEPCION registran, aplican y consultan.
- **El panel no calcula saldos ni topes**: los trae y decide el servidor; el formulario solo valida formato.
- **Transferencia y depósito exigen banco y N.º de operación** (para detectar duplicados); no se guardan cuentas completas. La misma operación no se registra dos veces entre pagos vigentes.
- **Constancia de pago (archivo adjunto): pendiente.** Requiere ampliar `ArchivoController` a RECEPCION; no se incluyó en esta etapa.

## 2026-10-23 — Cierre de A, B y C

- **«Revisión de zonas» es de solo lectura.** Muestra lo que el sistema no pudo decidir; no ofrece asignar, corregir ni resolver. Resolver los casos históricos es decisión del usuario y se hace fuera del panel.
- **El motivo del cambio de zona es opcional** (≤200 caracteres); la zona en la que el proveedor ya está no se puede elegir (el servidor además responde 409).
- **CALIDAD consulta los precios de calidad por entrega, no por pago.** Para no darle acceso general a pagos se añadió un único endpoint por entrega, sin más datos personales que el nombre ya visible en Calidad.
- **Con precios de calidad por entrega no hay vista previa del ajuste de precio del pago completo**, porque «la entrega manda» y el panel no recalcula reglas económicas: se explica y el total lo calcula el servidor.

## 2026-10-23 — Panel de pagos: litros efectivos (Fase B) y precios de calidad por entrega (Fase C)

- **No se recalcula ninguna regla económica en Angular.** Totales, ajuste de calidad, precio aplicado, litros contabilizados y efecto de cada precio los trae el servidor;
  el panel solo los muestra y, tras una acción, vuelve a leer el pago. (Queda la vista previa del ajuste de precio del pago completo, anterior a esta fase.)
- **Cada cantidad es un concepto distinto:** recibidos (originales, nunca cambian), efectivos hoy, liquidados y contabilizados. Las entregas corregidas y las que tienen
  ajuste de litros se marcan con texto, no solo con color. La corrección de litros **no** tiene formulario en el panel (fuera de alcance).
- **Solo ADMIN fija el precio de calidad** (el servidor devuelve 403 a los demás); el formulario solo ofrece los análisis de esa entrega y exige motivo.
- **Detalle en dos diálogos:** el detalle del pago (desglose del total, historial de precios de calidad, ajustes de litros con su estado y precio vigente/congelado) y un
  diálogo ancho de entregas (tabla con desplazamiento controlado en pantallas pequeñas). El filtrado de rol del historial de calidad es ADMIN, RECEPCION y CALIDAD.
- **Limitación conocida:** CALIDAD puede leer el historial en la API, pero el panel no le da ruta para llegar a un pago. Habilitarlo exigiría un endpoint nuevo en el
  backend (p. ej. historial por entrega o por análisis); no se hizo por no estar en el alcance.

## 2026-10-11 — Web pública: una tarjeta por producto con presentaciones elegibles y carrusel en la portada

- **Una tarjeta por producto** (como una tienda real); las presentaciones se eligen dentro de la tarjeta con etiquetas (como las tallas). La elegida decide precio, disponibilidad («Quedan N» con pocas unidades), foto (la de la presentación; si no tiene, la del producto) y a qué presentación se agrega la reserva. Por defecto, la primera no agotada; una agotada se puede ver pero no reservar.
- **Portada:** el collage de fotos se sustituye por un carrusel de esas mismas tarjetas (hasta 8 productos reservables, primero los que tienen foto), a todo el ancho disponible (portada de hasta 1440 px) y **siempre con tarjetas completas**: de a 3, de a 2 o de a 1 según el ancho (container queries), avanzando por páginas; si todas caben a la vez no hay controles. Avanza solo cada 5 s, se detiene con el cursor/foco/toque y con «Pausar», no avanza solo con «reducir movimiento», se desliza con el dedo y tiene flechas y puntos. Con un solo producto, tarjeta sin controles; sin productos reservables, el logo. Se quita la rejilla de «productos para reservar hoy» (era el mismo contenido).
- Pendiente de dato: la franja oscura de la foto de «Queso Fresco» viene en la propia imagen (conviene volver a subirla recortada).

## 2026-10-11 — Cantidad visible solo con pocas unidades

- El catálogo público añade `unidadesDisponibles` únicamente cuando `disponibilidad = POCAS_UNIDADES`; en otro caso es `null`. Evita revelar el inventario completo y, a la vez, impide el caso que se daba (pedir más de lo que queda). Mide la primera fecha de retiro posible, igual que `disponibilidad`; la comprobación exacta por fecha sigue siendo del servidor.
- Alternativas no tomadas (decisión de negocio): mostrar siempre la cantidad exacta; publicar una cantidad por fecha de retiro (requeriría un endpoint nuevo).

## 2026-10-11 — Web pública, Fase 6

- **Arquitectura:** la web pública es un proyecto Angular aparte (`projects/web-publica`) en el mismo workspace/repositorio. Razón: comparte `node_modules` y configuración sin acoplar código; se construye, sirve y prueba por separado. No importa nada de `src/` (panel). Alternativa descartada: repositorio nuevo (más fricción para el mismo equipo) y rutas públicas dentro del panel (mezcla lo público con el `Shell`, la sesión y el interceptor de tokens).
- **Backend como fuente de verdad:** la web no calcula disponibilidad, fechas ni cobertura. Único cambio de backend: `GET /api/catalogo/reservas/reglas` (fechas válidas ahora, máximo de unidades, horas de retención), porque esas reglas son configurables (Catálogos → Configuración) y copiarlas en Angular las desincronizaría.
- **Configuración y contenido:** `sitio.config.ts` centraliza textos y datos de contacto; vacío = oculto. El WhatsApp flotante solo existe con número real. Textos de «Quiénes somos» provisionales y neutrales (solo afirman funciones reales del sistema); las preguntas frecuentes no incluyen políticas no definidas (pago, entrega, devolución).
- **Datos que el backend no ofrece:** descripciones de producto y el motivo de rechazo/cancelación en la consulta pública. No se inventan; si se necesitan, es un cambio de backend a decidir (campo `descripcion` en producto; `motivo` en `ReservaPublicaResponse`, con cuidado de no exponer notas internas).
- **Nombre comercial:** «EcoLácteos Huata» (como figura en el logo oficial).
- **Dependencias y recursos:** ninguna dependencia nueva; tipografías de sistema (sin Google Fonts); logo en PNG transparente generado del oficial (sin retocar su forma ni colores).

## 2026-10-11 — Preparación de la Fase 6 (web pública): solo constancia, sin implementación

- **Separación:** la web pública es para clientes y debe quedar **diferenciada del panel interno** (`Ecolacteos-Web`, que exige login y roles). Propuesta, a confirmar al iniciar la fase: aplicación Angular aparte, sin `Shell`, sin autenticación y sin el interceptor de tokens, para no mezclar lo público con lo administrativo. No hay decisión firme todavía.
- **Backend ya disponible y público (sin token):** `GET /api/catalogo/productos` (productos con control de vencimiento, presentaciones con precio PUBLICO o «Precio a confirmar», disponibilidad DISPONIBLE / POCAS_UNIDADES / AGOTADO), `POST /api/catalogo/reservas`, `POST /api/catalogo/reservas/consulta` y `GET /api/catalogo/fotos/{nombre}`. Pendiente de la Fase 7: límite por IP/CAPTCHA y CORS del origen público.
- **Reutilizable del panel como patrón (copiar o extraer a una librería compartida, a decidir):** tokens de diseño `styles/theme.css`, utilidades `.btn`/`.field`/`.badge`, estados `ui-loading-state`/`ui-error-state`/`ui-empty-state`, `ToastService`, `mapHttpError`/`AppError`, `PaginaResponse`, `fechaHoyLima()`, la convención de `*.api.ts` con `HttpClient`, y los textos de estado de reserva (`reserva.etiquetas.ts`).
- **No reutilizable:** `Shell` y navegación del panel, `AuthService`/guards/interceptor, `ui-data-table`, diálogos administrativos y cualquier pantalla de `features/`.
- **Material pendiente del usuario** (no se inventa nada): HTML de las referencias y sus recursos visuales, logo oficial, introducción de la empresa, datos de contacto, número de WhatsApp y demás información real. Con eso se definirá la web combinando lo mejor de las referencias sin copiarlas y manteniendo la identidad de EcoLácteos.

## 2026-10-11 — Reservas, Fase 5 (panel de reservas)

- **El panel no replica reglas:** no decide si una reserva puede confirmarse ni calcula stock. Ofrece las acciones propias del estado que informa el servidor y muestra el motivo de un rechazo (409/400). Los contadores por estado son el `totalElementos` de una consulta al servidor, no una suma de la página.
- **Roles (confirmados por el usuario):** VENTAS y ADMIN gestionan reservas; solo ADMIN edita la configuración global (Catálogos → Configuración, `RESERVA_*`). El cierre del retiro del mismo día es 18:00 (`RESERVA_HORA_CIERRE`), configurable.
- **Retiro:** solo por `POST /api/reservas/{id}/retirar` (venta real). Una clave de idempotencia por apertura del detalle, reutilizada en reintentos. El retiro parcial queda fuera del panel.
- **Backend: 3 campos aditivos** (justificados porque lo pedido no se puede mostrar sin ellos y no deben calcularse en Angular): filtro `codigo`, `sinCobertura` por fila del listado y `stockComprometido`/`stockLibre` en Inventario. «Libre para vender» = máximo que una venta directa puede tomar hoy sin romper la cobertura de las reservas (puede ser menor que vendible − reservado, porque depende de las fechas de retiro y de los vencimientos de los lotes). Se pueden descartar sin afectar nada más: son de solo lectura y sin migración.
- **Cuando el producto no controla vencimiento** no puede tener reservas: Inventario no muestra reservado ni libre en esa fila.

## 2026-10-11 — Reservas, Fase 4 (solo backend)

Decisiones del usuario (autorización de la Fase 4): opción B de precio (las presentaciones sin precio público se listan y reservan como «Precio a confirmar»; el total es `null`, nunca inventado; una reserva con precio pendiente no se confirma hasta definir el precio y dejar constancia de la aceptación del cliente); plazo de retiro 3 días calendario desde hoy (Lima), fecha elegible dentro del plazo y en día de atención, mismo día solo dentro del horario, lunes a sábado inicialmente, feriados por configuración; 20 unidades por reserva (sin mezclar medidas con unidades), 2 pendientes por teléfono, 24 h de retención de una pendiente; teléfono peruano normalizado `+519XXXXXXXX`; estados PENDIENTE/CONFIRMADA/RECHAZADA/CANCELADA/VENCIDA/RETIRADA con auditoría; la venta de retiro es real, por el flujo normal, asociada con `reservaId` y atómica; parámetros editables solo por ADMIN en Catálogos → Configuración, con quién y cuándo.

1. **Una reserva es un compromiso, no un movimiento.** Vive en tablas propias; el stock físico, el libro y el kardex no se tocan al crear, confirmar, cancelar ni vencer. Solo el retiro genera movimientos, por la venta real.
2. **Cobertura por fecha (condición de Hall) en vez de asignar lotes a cada reserva.** Asignar lotes fijos habría dejado unidades varadas al llegar producción o ajustes y obligado a reasignar; la condición por fechas es sin estado, verificable en cada escritura y FEFO es óptimo para ella (una venta FEFO que rompe la cobertura no se salva con ninguna otra elección de lotes).
3. **Las reservas pendientes retienen stock** (24 h, configurable): sin eso dos clientes podrían "tener" las mismas unidades; el riesgo de acaparamiento lo acotan los topes por teléfono y por reserva. El límite por IP / CAPTCHA queda para la Fase 7.
4. **Una venta directa no puede dejar sin cobertura a reservas vigentes;** un ajuste por pérdida real sí se registra siempre (no se oculta un faltante) y deja incidencia + marca `sinCobertura`, resoluble rechazando/cancelando.
5. **Expiración calculada, no escrita** (sin job): `VENCIDA` sale de `expira_en`/`fecha_retiro`; los compromisos aplican el mismo criterio, así que una vencida libera stock al instante aunque nadie la haya mirado. Costo: no hay evento "VENCIDA" en el historial (el vencimiento no lo causa un usuario; consta en `expira_en`).
6. **Cotización y aceptación:** el precio cotizado debe coincidir con el vigente al confirmar y al retirar; si cambia, hay que recotizar y volver a registrar la aceptación. La aceptación la registra el personal (VENTAS/ADMIN) indicando el medio (el endpoint público no cambia estados).
7. **Supuestos a confirmar** (no estaban en la especificación): hora de cierre del mismo día **18:00** (`RESERVA_HORA_CIERRE`); VENTAS y ADMIN gestionan (como se acordó antes; la configuración solo ADMIN); código de seguimiento de 10 caracteres; el retiro parcial libera lo no retirado.

## 2026-10-11 — Catálogo público, Fase 3 (solo backend)

Criterios del usuario (autorización de la Fase 3): `Disponible` = stock vendible suficiente; `Pocas unidades` = stock vendible positivo pero bajo; `Agotado` = sin stock vendible; **no listar** presentaciones sin precio PUBLICO; la disponibilidad considera **solo existencias vendibles de lotes válidos** (sin vencidas ni sin trazabilidad) y refleja el stock vendible real, no el físico.

1. **La disponibilidad se calcula una sola vez, en el backend**, con `InventarioService.calcularExistencias` (la misma función que valida las ventas) y se publica como estado. Así el catálogo no puede discrepar de lo que realmente se puede vender y la web pública (Fase 6) no duplica ninguna regla.
2. **Umbral de "pocas unidades" = 5 (inclusive), configurable.** El usuario pidió "bajo" sin cifra; 5 es el valor que se propuso en la conversación y queda en `app.catalogo.umbral-pocas-unidades`. Cambiarlo no requiere código.
3. **Estado, no cantidad:** no se expone el stock real a un endpoint sin autenticación.
4. **Caché corta (30 s) en memoria** para proteger la base de un endpoint público; la comprobación exacta queda para la reserva (Fase 4), bajo bloqueo. Una presentación con existencias inconsistentes se publica como AGOTADO (falla cerrada) sin afectar al resto.
5. **Solo se publican productos que controlan vencimiento** (regla acordada del plan): un producto sin control no aparece aunque tenga precio PUBLICO y stock.

## 2026-10-11 — Control de vencimiento, Fase 2 (FEFO, vencidos, vendible y regularización)

Decisiones del usuario (autorización de la Fase 2 con los valores propuestos): (a) el vencimiento es el **último día válido, inclusive**; (b) la zona horaria es **America/Lima** (configurable; la planta opera en Lima, no se asume la del servidor); (c) orden de un ajuste negativo: **vencido → sin trazabilidad → FEFO**, y un ajuste positivo entra **sin trazabilidad** (no vendible); (d) regularización **opción B**: tabla propia que reclasifica N unidades del saldo sin trazabilidad a un lote con la fecha de la etiqueta, solo ADMIN, motivo obligatorio, N ≤ saldo sin trazabilidad, **sin movimientos en el libro** (no ensucia el kardex); (e) la activación de productos reales sigue deshabilitada hasta que el usuario valide la fase.

1. **La regularización no es un movimiento.** El stock total no cambia: solo se mueve entre "cajones" (sin trazabilidad ↔ lote regularizado). Por eso vive en `regularizacion_trazabilidad` y `movimiento_inventario_lote` gana `regularizacion_id`; el libro y el kardex quedan intactos (verificado byte a byte en una prueba de integración).
2. **Un solo punto de verdad para "hoy" y "vencido":** `ReglaVencimiento` (reloj del servidor en la zona configurada). Nunca la fecha del cliente.
3. **Falla cerrada también al leer:** cada escritura recalcula las existencias bajo el bloqueo de la presentación y exige que `libro = sin trazabilidad + Σ lotes` y que ningún cajón sea negativo; si no, no escribe.
4. **Contratos compartidos intactos.** `ProductoResponse` lo usa `SyncService` (móvil), así que el indicador de control se expone con un endpoint nuevo (`/control-vencimiento/productos`) y el vendible con `/inventario/presentaciones/{id}/existencias`; solo `FilaStockResponse` (inventario, solo web) ganó dos campos.
5. **Panel:** el interruptor de control es un diálogo por producto (Catálogos → "Control de vencimiento") que consulta su estado al abrir, para no añadir peticiones a la tabla de productos. La corrección de fechas de lote (endpoint de la Fase 1) no tiene pantalla todavía.

## 2026-10-02 — Menú lateral desplegable y paleta azul

Pedido del usuario: agrupar el menú con desplegables y cambiar el color. Cada sección es un acordeón (ícono + flecha, `aria-expanded`); se abre sola la de la página actual y, si se pliega, su encabezado queda marcado; las secciones abiertas se recuerdan en `localStorage` (solo comodidad, tolera almacenamiento no disponible). Una sección con un único ítem visible para el rol se muestra como enlace directo. "Precios" pasa a Comercial (son precios de venta). La paleta de marca (`--brand-*` en `theme.css`, único punto de cambio) pasa a verde esmeralda con acento menta (se probó un azul; el usuario lo descartó y pidió otro verde); colores de estado sin cambios. Contraste WCAG verificado por cálculo (texto ≥ 5.4:1). De paso, el título de la barra superior ya no confunde "Producción diaria" con "Producción".

## 2026-10-01 — Kardex por cantidades (rama `feature/kardex-inventario`, V19)

Decisiones funcionales confirmadas por el usuario: solo cantidades (sin costos, valorización, PEPS ni promedio); leche, insumos y producto terminado; PRODUCCION registra ingresos y consulta; ADMIN además ajusta por conteo; VENTAS solo consulta producto terminado; sin borrado de movimientos; ajustes con usuario, fecha/hora, motivo y variación.

1. **Rama base**: `feature/kardex-inventario` se creó desde `feature/recetas-produccion`, no desde `main`. `origin/main` NO contiene el trabajo reciente (recetas, inventario, ventas multi-línea); partir de `main` habría perdido V12–V18, de los que depende el kardex. El PR deberá integrarse después del de recetas, o apuntar a esa rama.
2. **Sin inventario paralelo**: leche (`movimiento_inventario_leche`) y producto terminado (`movimiento_inventario`) ya eran libros append-only; su kardex es una lectura. Solo los insumos necesitaban libro: `movimiento_insumo` (SALDO_INICIAL, INGRESO, SALIDA_PRODUCCION, AJUSTE).
3. **`insumo.stock` se conserva como saldo vigente** (lo usan el descuento atómico, el catálogo y el móvil por `/sync/cambios`). Invariante `stock = SUM(movimientos)`: todo cambio pasa por `InventarioInsumoService`, en la misma transacción. El stock ya no se edita desde Catálogos.
4. **Saldo inicial**: V19 registra el stock existente como primer movimiento (no se inventa historia); un insumo nuevo nace con su SALDO_INICIAL.
5. **Saldo acumulado calculado en la base** (función de ventana sobre todo el libro, orden `creado_en, id`), y luego filtro por fechas y paginación: el saldo de cada fila es real en cualquier página o período. El período filtra por fecha de registro; la fecha del documento (recepción, lote, venta) se muestra aparte.
6. **Ajustes de insumo** dentro del propio libro (variación con signo + usuario + motivo; saldo anterior = saldo previo del kardex), sin tabla extra. Producto terminado conserva su `ajuste_inventario` existente. Leche: sin ajustes manuales (alteraría el FIFO por recepción); queda fuera.
7. **Extensibilidad a costos**: bastaría añadir columnas nullable (p. ej. `costo_unitario`) a los tres libros y al DTO; el kardex no se rehace. El precio de venta nunca se expone en el kardex.
8. **Permisos** con roles existentes; leche e insumos ocultos para VENTAS también en la UI.
9. Se agregó 405 para verbos no soportados (antes caían en 500) y se corrigió una prueba de migración V12 rota desde V15 (ver REGISTRO).

## 2026-09-30 — Recetas y producción planificada vs. real (rama `feature/recetas-produccion`, V18)

Por instrucción explícita del usuario (evolucionar Producción hacia recetas, con autonomía técnica). Se extiende el módulo existente; no hay módulo paralelo.

1. **Receta = leche base + insumos del catálogo existente + rendimiento en UNA presentación del producto.** La leche no se duplica como insumo: tiene su propio libro mayor (V8) y es la "materia prima principal" fija. Cantidades "por litrosBase" en la unidad de cada insumo; no se convierten unidades. Producto y presentación de una receta no se editan (los lotes planificados conservan su salida); nombre, base, rendimiento e insumos sí.
2. **Cálculo solo en backend** (`CalculoReceta`): requerido = base × litros / litrosBase (multiplica antes de dividir), insumos a 2 decimales HALF_UP, esperado a 3 decimales. "Máximo producible" se redondea hacia abajo y nunca se aplica solo: el botón "Usar N L" es decisión explícita.
3. **Se reutiliza `lote_produccion` como producción planificada/real**: nuevas columnas `estado`, `receta_id`, `cantidad_esperada`, marcas de tiempo. Esperado (`cantidad_esperada`) y real (`lote_produccion_detalle`) nunca comparten columna. `litros_usados` = leche planificada = consumida. Plan de insumos = `lote_produccion_insumo` (snapshot al planificar = lo que se descuenta al iniciar).
4. **Estados**: PLANIFICADA → EN_PRODUCCION → FINALIZADA; CANCELADA solo desde PLANIFICADA. Los lotes existentes y los de un solo paso (móvil, "Registro sin receta") son FINALIZADA. No se permite cancelar EN_PRODUCCION (la materia prima ya se usó): se finaliza con 0 obtenido.
5. **Consumo definitivo al INICIAR**, no al planificar ni al finalizar: planificar no toca stock (se puede planificar con faltantes para reponer antes); iniciar valida todo, consume leche (FIFO existente con bloqueo) e insumos; finalizar ingresa producto terminado. Así una cancelación nunca necesita revertir movimientos y no hay doble consumo.
6. **Stock de insumos**: no existía libro mayor (columna `insumo.stock`, V17). No se crea uno nuevo: el descuento es un `UPDATE ... SET stock = stock - x WHERE stock >= x` atómico (sin stock negativo, sin lecturas desactualizadas, en orden de id para evitar deadlocks) y la trazabilidad por lote ya existe en `lote_produccion_insumo`. Deuda aceptada: no hay historial de reposiciones/ajustes de insumos (la edición del stock en Catálogos lo sobrescribe; la web solo envía el stock si se modificó).
7. **El registro directo (`POST /api/lotes-produccion`) ahora también descuenta los insumos que registra** (antes "informativo"): una sola regla de stock. El móvil no envía insumos, así que no cambia su comportamiento. El informe diario de producción NO descuenta (es un resumen del día; descontar ahí duplicaría).
8. **Concurrencia**: transiciones con `SELECT ... FOR UPDATE` sobre el lote (doble iniciar/finalizar se serializa); reintento idempotente de iniciar/finalizar/cancelar; planificar idempotente por `uuidCliente`.
9. **Permisos sin roles nuevos**: recetas se consultan/calculan con PRODUCCION o ADMIN y se administran solo con ADMIN (igual que Productos/Insumos); el ciclo de vida del lote usa PRODUCCION/ADMIN como el resto de `/api/lotes-produccion`.
10. **Rendimiento real**: se conservan esperado y obtenido y se expone `diferencia`; el % histórico (`rendimientoPct`, unidades por 100 L del producto) no se mezcla con la receta y queda null en lotes con receta.

## 2026-09-28 — Prevención de errores de producción

Por instrucción explícita, se implementan primero filtro de inventario y validaciones preventivas en ramas propias. Los límites físicos no se deducen del nombre de producto: se configura un rango opcional por producto (salida por 100 L), sin valores por defecto. UNIDAD se limita a una presentación por lote; para mezclar tamaños se requieren contenidos compatibles en KG o L. Resultados fuera de rango requieren motivo; contenidos incompatibles se bloquean para corregir el catálogo. No se modifica el rendimiento histórico ni se calculan equivalencias kg/L. Los ajustes de inventario y carrito encontrados posteriormente se preservan como trabajo externo a este alcance.

## Aceptadas

- Angular; raíz C:\EcoLacteosProyect\Ecolacteos-Web.
- Cinco fases, continuidad completamente documentada.
- HTML existente como base visual; mejorar tarjetas y contenido sin sustituir toda la identidad.
- Tema central editable, sin colores de marca dispersos.
- Gráficos solamente de datos reales disponibles; respetar alcance temporal/geográfico.
- Acopio y recepción en web: principalmente consulta. Captura operativa en móvil.
- Ventas sí se registra desde la web.
- Zonas libres: no implementar listas restrictivas por acopiador, filtros de autorización territorial ni zonas obligatorias en UsuarioRequest.
- Backend canónico externo; la copia interna del móvil no es fuente de verdad.

## Ampliación condicionada: ficha de acopiador

El usuario acepta ampliar si es sencillo. Hoy ACOPIADOR es Usuario con rol; no hay ficha sin credenciales.

Antes de modificar backend, documentar en Fase 2:
1. Entidad mínima y migración aditiva.
2. Cómo se vincula opcionalmente a Usuario sin cambiar su ID.
3. Qué sucede con usuarios ACOPIADOR existentes, duplicados y desactivaciones.
4. Por qué no cambia requests/respuestas consumidos por móvil ni referencias de jornada/acopio/unidad.
5. Endpoints nuevos, DTOs exactos y pruebas de permisos/compatibilidad.

Puede ejecutarse como ampliación pequeña si es aditiva, no exige convertir identidades históricas, no obliga a cambiar móvil y tiene pruebas reproducibles. No basta llamar “fácil” a crear una tabla.

Si exige migración compleja, reemplazar Usuario o rediseñar flujos, dejar pendiente y continuar con alta de usuario ACOPIADOR existente. Presentar una decisión concreta al usuario. No crear una ficha solo en localStorage o un formulario que finja guardarla.

No inventar requisitos de DNI, teléfono o domicilio para el acopiador. Si se agregan datos opcionales, justificar su finalidad y contrato antes de exponerlos. Alta de ficha sin cuenta y “dar acceso” deben ser acciones distinguibles si se implementan.

### Evaluación en Fase 2 (2026-09-16): no se implementa

Se evaluó separar la ficha de acopiador de su cuenta antes de construir el módulo Acopiadores. Resultado: **no se implementa en esta fase**, porque no cumple las condiciones de la ampliación pequeña:

1. Exige una entidad nueva en el backend (p. ej. `Acopiador`) y una migración — no es aditiva sobre el modelo actual sin tocar el backend, y esta fase tiene prohibido modificar el backend.
2. No hay ningún endpoint hoy para vincular opcionalmente una ficha a un `Usuario` sin cambiar su ID, ni para leer/crear esa ficha; inventar uno en el cliente violaría "no inventes endpoints".
3. No puede probarse de forma reproducible sin ese soporte contractual (no hay nada real que probar).

Por lo tanto se continúa con la alta existente: **ACOPIADOR es un `Usuario` con `rolNombre: 'ACOPIADOR'`**, creado con `POST /api/admin/usuarios` (docs/CONTRATOS.md, `UsuarioRequest`) y, opcionalmente en el mismo flujo guiado, una `Unidad` con `responsableId` apuntando a ese usuario (`POST /api/admin/unidades`). Implementado en `src/app/features/acopiadores/ui/nuevo-acopiador-dialog/`: paso 1 crea el usuario, paso 2 asigna la unidad y es explícitamente omitible sin perder el usuario ya creado si el paso 2 falla. No se agregó DNI, teléfono ni domicilio: los únicos campos usados son los del contrato real de `UsuarioRequest`/`UnidadRequest`.

Esto sigue siendo BACKEND NECESARIO si en el futuro se quiere una ficha real de acopiador sin credenciales: haría falta, como mínimo, una entidad + migración aditiva, un endpoint de vínculo opcional a `Usuario`, y contratos para leer/editar esa ficha — nada de eso existe hoy.

## Propuestas no aprobadas como desarrollo obligatorio

API de estadísticas por período, histórico general de jornadas, lectura de recorrido GPS, vaciado de rutas, inactivos de catálogos, búsqueda remota y exportaciones masivas. Se encuentran en ALCANCE como necesidades identificadas. No bloquear todos los módulos porque falten.

Inventario, clientes identificados, facturas, cobros, devoluciones y anulación de ventas quedan fuera del contrato actual y fuera del alcance inicial.

## Persistencia de sesión (Web) — 2026-09-16

El usuario probó el login real contra el backend (cuenta ADMIN) y pidió corregir que un F5 exigiera volver a autenticarse: la sesión debe sobrevivir a recargar la página, a cerrar y reabrir el navegador, y a navegar entre rutas, mientras el refreshToken siga vigente; solo "Cerrar sesión" debe forzar un login nuevo.

- Decisión: reemplazar el default de Fase 1 ("tokens solo en memoria") por persistencia en `localStorage` (token, refreshToken, `expiraEn`/`refreshExpiraEn` como timestamps absolutos, y los datos de `/auth/me`). Nunca se persiste la contraseña.
- Motivo: es el único mecanismo disponible sin tocar el backend. El contrato de `AuthController` (docs/CONTRATOS.md, `LoginResponse`) devuelve los tokens en el cuerpo JSON, no en una cookie `HttpOnly`; no hay forma de lograr persistencia entre reinicios del navegador sin guardarlos en un storage accesible desde JavaScript.
- Efecto/riesgo: el token queda expuesto a robo por XSS si algún día se inyecta script malicioso en la app (hoy no hay `innerHTML` con contenido dinámico en ningún componente). Se mitiga limpiando el storage de inmediato al cerrar sesión o al fallar una renovación, y no exponiendo la contraseña en ningún momento.
- Mecanismo de renovación usado: el ya existente `POST /api/auth/refresh-token` (público, contrato `RefreshTokenRequest`). No se inventó ni se pidió ningún endpoint nuevo; ver `docs/ENDPOINTS.md`, `AuthController.java`.
- Módulos afectados: `src/app/core/auth/token-store.service.ts` (persistencia + restauración síncrona al construirse), `src/app/core/auth/auth.service.ts` (`reanudarSesion()`), `src/app/app.config.ts` (`provideAppInitializer`). No se tocó ningún contrato ni el backend.
- Compatibilidad: no rompe nada de lo implementado; los interceptores, guards y el flujo de login/refresh/logout siguen igual, solo cambia dónde vive el estado de la sesión entre cargas de página.

## Registro futuro

Para cada cambio: fecha, decisión, motivo, módulos afectados, contrato y compatibilidad. Las hipótesis deben marcarse PROPUESTA, nunca EXISTENTE.



## 2026-09-16 — Asignación y consulta de acopios
Por instrucción explícita, asignar al acopiador una unidad ya existente reemplaza la creación de unidad en ese flujo y en el botón principal de Unidades. Se usa PUT del contrato actual, sin duplicar placas. La consulta de acopios se incorpora como módulo ADMIN independiente, con filtro por día y GPS/foto del registro, sin inventar endpoints de recorrido.


## 2026-10-21 — Varias recetas en una selección de producción (solo web)
Por petición explícita, Nueva producción acepta varias filas, cada una con receta y litros, conservando un lote independiente por fila. No se cambia backend ni se mezclan recetas dentro de un lote. GET /recetas/{id}/calculo calcula cada receta; el cliente suma únicamente necesidades en centésimas y no suma existencias compartidas (mínimo observado por insumo). La comprobación conjunta es informativa, sin reserva. No se suman productos esperados de distintas presentaciones.
Se envía planificar/iniciar secuencialmente con UUID estable por fila; solicitudes y modo quedan congelados desde el primer intento. Un fallo detiene el resto; las filas completadas se conservan y se omiten al reintentar. Una respuesta perdida de iniciar no se presenta como fallo definitivo ni consumo confirmado. No existe atomicidad de grupo: para todo-o-nada haría falta nuevo backend, expresamente fuera de alcance. Cerrar vuelve a cargar historial e inventario de leche. Sin persistencia del borrador entre recargas; se avisa antes de cerrar con operaciones pendientes.

## 2026-10-21 — Recepción de jornadas desde web

Ampliación explícita del usuario al alcance original de Fase 4: ADMIN y RECEPCION pueden recibir jornadas desde la bandeja web, usando exclusivamente `POST /api/sync/recepciones-jornada` existente. No se modifica backend ni móvil. La captura de acopio permanece en móvil. La operación web es online, sin cola offline.

- Formulario dentro del detalle: litros reales >= 0 (sin precargar el esperado), llegada en hora America/Lima, observación opcional; turno UNICO, valor por defecto del contrato. Advierte si no hay acopios en el servidor, sin inventar una prohibición.
- El servidor calcula campo/planta y realiza la transición; Angular exige el UUID propio en confirmados y prioriza errores individuales incluso con HTTP 200. No confía en el estado mostrado previamente en la tabla: carga detalle al abrir y respeta rechazos del servidor.
- UUID por apertura, bloqueo de doble envío y request congelado al enviar. Tras error HTTP o respuesta ambigua, reintenta mismo UUID y mismos datos. Solo un rechazo explícito permite corregir. Cerrar tras editar o enviar pide confirmación; el backend existente impide dos recepciones para una jornada incluso si se reabre con otro UUID.
- Tras cerrar se vuelve a consultar la bandeja; el mensaje de éxito aparece solo por confirmación real. La conciliación se consulta en el módulo Recepción existente.


### 2026-10-21 — Selección y marcas de turno
Se sustituye el turno UNICO fijo por selector MAÑANA/TARDE/UNICO, conforme al móvil. La marca «Ya recepcionado» se calcula exclusivamente con recepciones existentes del mismo vehículo y fecha de llegada (no por acopiador ni fecha de inicio de jornada), leyendo todas las páginas. Es informativa, no una reserva ni garantía de disponibilidad. El esquema existente V1 declara UNIQUE(fecha, unidad_id, turno); se conserva la autoridad del servidor y no se añaden reglas locales ni cambios de API. Los errores de consulta no se interpretan como lista vacía/disponibilidad. Fecha/hora sigue en America/Lima.


## 2026-10-22 — Integración de las funcionalidades 1–6 y correcciones
- **Varias recetas.** Se conserva la decisión de un lote por fila y de no simular atomicidad: son peticiones independientes (planificar/iniciar) y una receta puede quedar guardada aunque falle una posterior. Se restauran el aviso de producción iniciada/planificada y la apertura del detalle del lote (solo con una receta y proceso completo); cancelar sin guardar no recarga; el cierre usa `ConfirmDialog` (no `window.confirm`). `NuevaProduccionDialog` se elimina por no tener referencias; se pierde con él el botón «Usar el máximo» de la receta única, que `ProduccionMultipleDialog` no ofrece.
- **Recepción de jornadas.** El formulario vive en `RecepcionJornadaForm`. Regla de identificador: una solicitud con resultado incierto (sin respuesta, 5xx, 408, 409, 429, o HTTP 200 sin confirmación propia) se reintenta idéntica y con el mismo `uuidCliente`; un rechazo definitivo (error individual en HTTP 200 o 4xx) libera el formulario y la solicitud corregida estrena `uuidCliente`, porque es otra solicitud. El éxito se avisa con `ToastService`.
- **Tablas.** `jornadas-page` combina la búsqueda/paginación en el cliente (`ListaLocal`, orden FIFO de la bandeja) con las acciones de recepción.
- **Mapa de contacto.** Es de la web pública (`projects/web-publica`). `deploy/panel` solo publica el panel, así que el mapa llega a producción con la rama desde la que se despliega la web pública (`main`), no con `deploy/panel`.
