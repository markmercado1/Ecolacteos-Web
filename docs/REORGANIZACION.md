# Reorganización de módulos — 2026-10-26

## Auditoría previa
- Producción diaria: informe manual de quesos diarios, reparados, recortes e insumos; no genera movimientos. Independiente de los lotes operativos. Sus tablas históricas se conservan. Se retiró la exportación exclusiva; la búsqueda en los fuentes Java/Kotlin del móvil no encontró consumidores de informes-produccion. No se evaluaron clientes externos no presentes en los repositorios.
- Revisiones de documentos y zonas: informes ADMIN, solo lectura; no son los validadores ni el historial de proveedores. Retirar solo sus consumidores exclusivos; conservar DocumentoIdentidad, ZonaHistoricaService y todos los datos.
- Pagos (/api/pagos): liquidaciones de leche por proveedor y entregas, tabla pago, líneas y ajustes. ADMIN genera; ADMIN/RECEPCION consultan. Pagos efectivos (/api/pagos-proveedor): desembolsos/adelantos y aplicaciones, tablas pago_proveedor y pago_proveedor_aplicacion. Ambos registran/consultan; solo ADMIN anula. No son compras ni recepción de insumos. Conservar reglas, saldos e idempotencia; nombres de pantalla: Liquidaciones de leche y Desembolsos a proveedores.
- Insumos: catálogo ADMIN; inventario ADMIN/PRODUCCION, incluye inactivos con saldo. Recetas y producción consumen el mismo catálogo. Unificar administración y movimientos en Inventario, reutilizando InsumoFormDialog, ImportarExcelDialog, ConfirmDialog, ListaLocal y DataTable. Catálogos conserva carga de insumos para las recetas, no un segundo listado de gestión.
- Productos: SUM(movimiento_inventario), reparto movimiento_inventario_lote, lotes y regularizaciones, FEFO. Vencimiento inclusivo, reloj America/Lima. Lo vencido ya se excluye de venta con control habilitado. Ajustes por conteo no expresan una salida identificada por lote; añadir salida explícita, idempotente, sobre el libro existente.
- Insumos: insumo.stock y movimiento_insumo se actualizan en una transacción. No existe lote de ingreso ni fecha de vencimiento; no se inventan. La salida manual puede registrar el motivo real; no permite detectar automáticamente vencimiento inexistente en el modelo.

## Patrones de referencia
Angular standalone/OnPush, signals, APIs HttpClient, formularios reactivos, CDK Dialog, mapHttpError/ToastService, tokens compartidos. Backend controlador/DTO/servicio/repositorio, validación Jakarta, excepciones de negocio, bloqueo por artículo, libro append-only, migraciones Flyway aditivas. Pruebas de inventario, FEFO y pagos como referencia.

## Git
Dos worktrees nuevos; ningún cambio de rama en los checkouts previos. Rama solicitada ausente local y remotamente antes de crearla. Frontend de origen limpio; backend de origen con cambios de compilación target, preservados. Origen frontend: `feature/igv-activable` en `2b4b4f53918422fed5efe65d1ed4b219d4411f57`. Origen backend: misma rama en `a4904cd100b0b1dc182514b2c90a2fadc6523524`.
Rama creada en ambos: `feature/limpieza-modulos-inventario`. Worktrees: `C:/EcoLacteosProyect/Ecolacteos-Web/.worktrees/limpieza` y `C:/EcoLacteosProyect/acopio-backend-fase2/ecolacteos-backend/.worktrees/limpieza`. No push autorizado.

## Resultado implementado

- Retirados Producción diaria, Revisión de documentos y Revisión de zonas: rutas, navegación, pantallas, APIs Angular, controladores, DTOs, servicios y persistencia exclusivos. Se mantiene la producción operativa por lotes, recetas, validación de documentos y asignación/historial de zonas. Los informes históricos siguen en sus tablas, aunque ya no tienen pantalla ni API de edición.
- Inventario → Insumos concentra ficha (crear/editar/desactivar), importar/exportar, existencias, ingresos, ajustes, salidas y Kardex. Catálogos enlaza a esa sección; el enlace anterior `?pestana=insumos` redirige. Se conserva búsqueda y paginación mediante ListaLocal/DataTable. Las recetas siguen consultando el mismo catálogo.
- ADMIN administra fichas, importa, ajusta y registra retiros. PRODUCCION consulta insumos e ingresa existencias; VENTAS solo consulta productos terminados. Insumos inactivos con stock siguen disponibles para consulta/retiro; no reciben nuevos ingresos.
- Salidas explícitas: vencimiento, deterioro y otra justificada, con cantidad y motivo obligatorio. Cada salida crea un solo movimiento negativo en el libro existente, en la misma transacción y con bloqueo del artículo. Documento `salida_inventario` conserva idempotencia y metadatos, no constituye otro Kardex.
- Producto con control: se elige su lote o regularización, se valida saldo y, para vencimiento, que realmente haya vencido. Se conserva fecha de vencimiento, responsable, fecha/hora, motivo y movimiento. El reparto se integra en movimiento_inventario_lote. La venta sigue usando FEFO y excluyendo vencidos. La pérdida física puede dejar reservas sin cobertura: usa la incidencia existente.
- Producto sin control: permite deterioro/otra, no afirmar vencimiento sin lote fechado. Insumos: retiro manual con motivo real; no se añadieron fechas/lotes inexistentes. Su stock y libro se actualizan juntos.
- Reintentos: `uuidCliente` único y comparación del contenido; misma operación devuelve el mismo movimiento, datos diferentes devuelven conflicto. El panel bloquea doble envío y conserva la solicitud incierta en sessionStorage por usuario/artículo al cerrar, reabrir o recargar la pestaña. No cubre abrir una operación nueva en otro dispositivo; ante incertidumbre fuera de esa pestaña se debe consultar el Kardex.
- Pagos mantienen sus procesos y contratos. **Liquidaciones de leche** calcula obligaciones de entregas; **Desembolsos a proveedores** registra dinero, adelantos y aplicaciones. No se introdujo relación ficticia con compras de insumos ni se modificaron saldos financieros.

## Contratos y base de datos

| Cambio | Detalle |
|---|---|
| Nuevo | `POST /api/inventario/presentaciones/{id}/salidas` y `POST /api/inventario/insumos/{id}/salidas`, ADMIN, HTTP 200 |
| Retirado | `/api/informes-produccion` y subrutas; exportación `/api/exportaciones/informes-produccion`; `/api/admin/proveedores/revision-documentos`; `/api/admin/zonas/revision` |
| Conservado | `/api/admin/insumos`, `/api/inventario/insumos`, ingresos/ajustes/Kardex, producción, ventas, `/api/pagos`, `/api/pagos-proveedor` |
| Migración | `V36__salidas_inventario.sql`, aditiva; documento salida_inventario, FK salida_id en movimiento_inventario y movimiento_insumo, índices únicos y ampliación de tipos/checks |
| Histórico | Sin UPDATE/DELETE de registros anteriores ni DROP de tablas. informe_produccion_diario e informe_produccion_insumo permanecen intactas |

Request: uuidCliente, cantidad (>0; producto entero; insumo hasta 2 decimales), tipo (`VENCIMIENTO|DETERIORO|OTRA`), motivo (1–500), origenLote y loteId juntos cuando hay control. Response: id, movimientoId, cantidad, tipo, motivo, origenLote, loteId, fechaVencimiento, usuarioNombre, creadoEn. Kardex mantiene contrato: documento SALIDA, referencia, usuario y motivo; tipos SALIDA_VENCIMIENTO/DETERIORO/OTRA. La ruta eliminada de revisión de zonas se interpreta como UUID inválido por el CRUD existente (400), no como informe.

## Archivos principales

Frontend: `app.routes.ts`, `core/layout/nav-items.ts`, `features/catalogos/pages/catalogos-page/*`, `features/inventario/{data-access,pages,ui}`, encabezados de pagos y referencias de proveedores/acopios. Nuevos `salida-inventario-dialog`, `salida-pendiente.service.ts`; estilos del diálogo de movimiento reutilizados en `movimiento-inventario-dialog.css`. Eliminados directorios exclusivos `features/produccion-diaria`, `features/zonas`, `features/proveedores/pages/revision-documentos-page`. Pruebas de rutas, navegación, importación, proveedores, permisos y salida ajustadas.

Backend, bajo `src/main/java/com/planta/acopio`: nuevos SalidaInventarioController/Service/Request/Response/Repository, entidad SalidaInventario y MotivoSalida; modificados InventarioService, InventarioInsumoService, MovimientoInventario/Insumo y sus repositorios/tipos, GlobalExceptionHandler y exportaciones. Retirados InformeProduccionDiario*, InformeProduccionInsumo, RevisionDocumentos*, RevisionZonas* y consultas exclusivas sin consumidores. Migración en `src/main/resources/db/migration/V36__salidas_inventario.sql`. Nuevas pruebas SalidasInventarioIntegrationTest y MigracionSalidasIntegrationTest.

## Verificación y alcance de la evidencia

- Panel: 120 archivos / 924 pruebas aprobadas; build producción aprobado. Prueba de permisos del inventario ampliada y ejecutada después: 24/24 aprobadas.
- Web pública: 6 archivos / 74 pruebas y build producción aprobados.
- Backend: resultado final pendiente de cerrar la ejecución completa. Pruebas cubren retiro por lote, validación de fecha/cantidad, insumo stock=libro, permisos, reintento concurrente y conservación de histórico tras V36. Las suites existentes cubren FEFO, ventas, reservas y pagos.
- PostgreSQL 17 temporal en puerto 55439; bases separadas por prueba. `PostgresDePrueba` permite ejecutar las pruebas existentes sin Docker con ECO_TEST_PG_ADMIN_URL; sin esa variable mantiene Testcontainers. Se limita cache de contextos a 4 para no agotar conexiones. DataInitializerTest ya estaba excluida en el POM de origen: no se ejecutó ni se cambió esa exclusión.
- UI real sobre compilación local (4208), backend temporal (8089), base eco_ui_limpieza. Se observó retiro de 2.5 kg: 100 → 97.5, usando datos ficticios. Kardex verificado por UI: saldo inicial 0, entradas 100, una salida de 2.5 por deterioro, saldo 97.5, usuario y motivo correctos. Revisión en 360/768/1440 px, con listado abundante, filtro de una fila y estado vacío; capturas reales en evidencia-reorganizacion. Se comprobó entrada desde el enlace de Catálogos y manejo por teclado. No se probaron dispositivos físicos ni zoom del navegador al 200%.
- No se aplicó V36 a la base habitual ni a producción. No se hicieron merge, push ni despliegue. Para integrar, frontend y backend requieren revisión conjunta y V36.

## Limitaciones explícitas

No hay identificación automática de insumos vencidos porque el modelo carece de lotes de ingreso y fechas. Tampoco se inventa fecha para stock de producto sin trazabilidad: requiere el proceso existente de regularización. Los módulos retirados dejan de ofrecer consulta por UI de sus informes, conservando los datos SQL. Compatibilidad de clientes externos desconocidos no comprobada.
