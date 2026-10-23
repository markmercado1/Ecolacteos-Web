# Inventario de endpoints comprobados

## Ampliación vigente 2026-10-22: exportar e importar Excel (ver `EXCEL.md`)

Exportación (solo lectura; mismos roles y filtros que el listado de cada tabla; devuelve `.xlsx` con TODAS las filas del filtro):
`GET /api/exportaciones/{proveedores, acopios, pagos, ventas, reservas, recepciones, lotes, informes-produccion, stock, inventario-insumos, calidad-analizados, alertas-anomalia, jornadas, usuarios, precios-litro, precios-presentacion, zonas, motivos-observacion, familias, productos, insumos, recetas, configuracion, unidades}`
(`ExportacionController`, `ExportacionAdminController`; tabla de roles y filtros en `EXCEL.md`). Cabecera `Content-Disposition` expuesta por CORS.

Importación (solo ADMIN, `ImportacionController`, `/api/admin/importaciones`):

- `GET /{tipo}/plantilla` (`proveedores` | `insumos`) → `.xlsx` oficial.
- `POST /{tipo}/previsualizar` (multipart `archivo`) → `VistaPreviaImportacionResponse {id, tipo, titulo, version, nombreArchivo, totalFilas, validas, invalidas, duplicadas, omitidas, expiraEn, puedeConfirmar, columnas[], filas[]}`. No crea datos de negocio.
- `POST /{id}/confirmar` → `ResultadoImportacionResponse {creadas, invalidas, duplicadas, omitidas, yaConfirmada, filasNoCreadas[]}`; una transacción, idempotente.
- `GET /{id}/reporte` → `.xlsx` con las filas no importadas (fila, resultado, motivo, valores).
- `DELETE /{id}` → 204; descarta una vista previa.
- Migración V26 `importacion_excel`. Errores: 400 (archivo/plantilla inválidos), 403 (otro usuario/rol), 404 (tipo o importación), 409 (`No se creó ningún registro…`, vista previa vencida o cancelada).

## Ampliación vigente 2026-10-11: web pública (Fase 6)

- `GET /api/catalogo/reservas/reglas` — **público**, solo lectura. 200 `{fechasDisponibles: [yyyy-MM-dd…], maxUnidades, horasPendiente}`. Cualquier otro método sobre esa ruta sigue exigiendo autenticación (401).
- La web pública consume además `GET /api/catalogo/productos`, `GET /api/catalogo/fotos/{archivo}`, `POST /api/catalogo/reservas` y `POST /api/catalogo/reservas/consulta` (todos de fases anteriores, sin cambios).

## Ampliación vigente 2026-10-11: panel de reservas (Fase 5)

- `GET /api/reservas` gana el filtro opcional `codigo` (exacto, sin distinguir mayúsculas) y cada fila gana `sinCobertura`.
- `GET /api/inventario/stock/presentaciones`: cada fila gana `stockComprometido` y `stockLibre`.
- Sin endpoints nuevos ni migraciones. El panel consume los de la Fase 4 (`/api/reservas…`).

## Ampliación vigente 2026-10-11: reservas (Fase 4)

- `POST /api/catalogo/reservas` — **público**. 201 `ReservaPublicaResponse` · 400 · 404 · 409 · 422.
- `POST /api/catalogo/reservas/consulta` — **público**. Body `{codigo, telefono}`. 200 · 404.
- `GET /api/reservas` — VENTAS/ADMIN. Filtros `estado`, `fechaRetiro`, `telefono` y `codigo` (Fase 5); paginado.
- `GET /api/reservas/{id}` — VENTAS/ADMIN. Detalle con historial y `sinCobertura`.
- `PUT /api/reservas/{id}/recotizar` · `POST /api/reservas/{id}/aceptacion-precio` · `PUT /api/reservas/{id}/confirmar` · `PUT /api/reservas/{id}/rechazar` · `PUT /api/reservas/{id}/cancelar` — VENTAS/ADMIN. 409 en transiciones no permitidas.
- `POST /api/reservas/{id}/retirar` — VENTAS/ADMIN. 201 `VentaResumenResponse` (venta real + reserva RETIRADA, atómico).
- `POST /api/ventas/carrito`: acepta `reservaId` opcional (retiro parcial); exige `tipoCliente = PUBLICO`.
- `PUT /api/admin/configuracion/{clave}` (ADMIN): las claves `RESERVA_*` se validan al guardar.
- `GET /api/catalogo/productos`: las presentaciones sin precio público se listan con `precio: null` y `precioAConfirmar: true`; `disponibilidad` descuenta las reservas vigentes.

## Ampliación vigente 2026-10-11: catálogo público (Fase 3)

- `GET /api/catalogo/productos` — **público (sin token)**. 200 `CatalogoPublicoResponse` (productos con control de vencimiento, presentaciones con precio PUBLICO vigente, `disponibilidad` DISPONIBLE/POCAS_UNIDADES/AGOTADO). `POST`/otras subrutas de `/api/catalogo/` → 401.

## Ampliación vigente 2026-10-11: FEFO, vencidos y regularización (Fase 2)

- `GET /api/inventario/presentaciones/{presentacionId}/existencias` — PRODUCCION, VENTAS o ADMIN. 200 `ExistenciasPresentacionResponse` (físico, vendible, vencido, sin trazabilidad y lotes en orden FEFO) · 404.
- `GET /api/control-vencimiento/productos` — PRODUCCION, VENTAS o ADMIN. 200 `{productoIds}`.
- `POST /api/admin/presentaciones/{presentacionId}/regularizaciones` — ADMIN. Body `{cantidad, fechaVencimiento, motivo}`. 201 `RegularizacionResponse` · 400 · 404.
- `GET /api/inventario/stock/presentaciones`: `FilaStockResponse` agrega `controlaVencimiento` y `stockVendible`.
- `POST /api/ventas` · `POST /api/ventas/carrito`: para presentaciones controladas validan el stock **vendible** y reparten FEFO (400 `Stock vendible insuficiente…`).
- `POST /api/inventario/ajustes` (ADMIN): en presentaciones controladas el sobrante entra sin trazabilidad y la baja descuenta vencido → sin trazabilidad → FEFO.

## Ampliación vigente 2026-10-11: control de vencimiento (Fase 1, solo backend)

- `PUT /api/admin/productos/{id}/control-vencimiento` — ADMIN. 200 `ControlVencimientoResponse` · 404 · 409 (activación deshabilitada en el entorno).
- `DELETE /api/admin/productos/{id}/control-vencimiento` — ADMIN. 200 · 404 · 409 (ya hay movimientos asignados a lotes o el stock cambió).
- `PATCH /api/lotes-produccion/detalles/{detalleId}/vencimiento` — PRODUCCION o ADMIN. Body `{fechaVencimiento, motivo}`. 200 `VencimientoLoteResponse` · 400 · 404 · 409 (lote ya usado).
- `POST /api/lotes-produccion/{id}/finalizar`: acepta `vencimientos` opcional (obligatorio para productos controlados).

## Ampliación vigente 2026-10-10: fotos de catálogo

- `PUT /api/admin/productos/{id}/foto` — ADMIN. `multipart/form-data`, campo `file`. 200 `ProductoResponse` · 400 archivo vacío/formato/tamaño/dañado · 404 · 415 si no es multipart.
- `DELETE /api/admin/productos/{id}/foto` — ADMIN. 200 `ProductoResponse` (sin foto) · 404.
- `PUT /api/admin/productos/{productoId}/presentaciones/{presentacionId}/foto` — ADMIN. Igual que la de producto; 404 si la presentación no pertenece al producto. 200 `PresentacionResponse`.
- `DELETE /api/admin/productos/{productoId}/presentaciones/{presentacionId}/foto` — ADMIN. 200 `PresentacionResponse`.
- `GET /api/catalogo/fotos/{nombre}` — **público (sin token)**. 200 imagen · 404. Solo sirve fotos de catálogo; `/api/archivos/{nombre}` (acopio) sigue exigiendo ACOPIADOR/ADMIN/CALIDAD.
- `POST /api/admin/productos` y `PUT /api/admin/productos/{id}`: ahora 409 si el nombre ya existe (aunque cambie la capitalización o el producto esté desactivado).

## Ampliación vigente 2026-09-28: familias de Inventario

`GET /api/inventario/familias`: ADMIN, VENTAS o PRODUCCION; devuelve `FamiliaResponse[]` (`id`, `nombre`, `activo`), ordenado por nombre e id. Incluye inactivas para permitir filtrar saldos remanentes. Es catálogo de solo lectura y no concede permisos administrativos. Verificación HTTP con MockMvc: 200 para los tres roles, 403 ACOPIADOR y 401 anónimo.

`GET /api/inventario/stock/presentaciones?familiaId=<uuid>&page=0&size=20`: contrato existente reutilizado. Filtro en backend antes de paginar; total corresponde a presentaciones. La web omite familiaId para todas, reinicia página al cambiar familia y la conserva al cambiar tamaño. Prueba de integración PostgreSQL con dos presentaciones y tamaño 1 confirma dos páginas y exclusión de otras familias.

98 operaciones HTTP en 18 controladores. Fuente exclusiva: backend canónico de README. Instantánea estática; el código actual prevalece. Permisos incluyen @PreAuthorize de clase/método; servicios añaden reglas de propiedad.

page empieza en 0; donde existe size: default 20, límite 1–100. Login y refresh-token públicos; resto autenticado. No enviar filtros opcionales como UUID/fechas vacíos.

## AdminCatalogosController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\AdminCatalogosController.java`.

### POST /api/admin/zonas

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `ZonaResponse`.
- Entrada: `@RequestBody @Valid ZonaRequest dto`.
- Fuente: línea 70, método `crearZona`.

### GET /api/admin/zonas

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `List<ZonaResponse>`.
- Entrada: sin parámetros ni cuerpo.
- Fuente: línea 77, método `listarZonas`.

### GET /api/admin/zonas/{id}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `ZonaResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 89, método `obtenerZona`.

### PUT /api/admin/zonas/{id}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `ZonaResponse`.
- Entrada: `@PathVariable UUID id, @RequestBody @Valid ZonaRequest dto`.
- Fuente: línea 101, método `actualizarZona`.

### DELETE /api/admin/zonas/{id}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `Void`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 112, método `desactivarZona`.

### PATCH /api/admin/zonas/{id}/reactivar

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `ZonaResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 124, método `reactivarZona`.

### POST /api/admin/unidades

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `UnidadResponse`.
- Entrada: `@RequestBody @Valid UnidadRequest dto`.
- Fuente: línea 137, método `crearUnidad`.

### GET /api/admin/unidades

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `List<UnidadResponse>`.
- Entrada: sin parámetros ni cuerpo.
- Fuente: línea 144, método `listarUnidades`.

### PUT /api/admin/unidades/{id}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `UnidadResponse`.
- Entrada: `@PathVariable UUID id, @RequestBody @Valid UnidadRequest dto`.
- Fuente: línea 159, método `actualizarUnidad`.

### POST /api/admin/motivos-observacion

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `MotivoObservacionResponse`.
- Entrada: `@RequestBody @Valid MotivoObservacionRequest dto`.
- Fuente: línea 171, método `crearMotivo`.

### GET /api/admin/motivos-observacion

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `List<MotivoObservacionResponse>`.
- Entrada: sin parámetros ni cuerpo.
- Fuente: línea 178, método `listarMotivos`.

### PUT /api/admin/motivos-observacion/{id}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `MotivoObservacionResponse`.
- Entrada: `@PathVariable UUID id, @RequestBody @Valid MotivoObservacionRequest dto`.
- Fuente: línea 190, método `actualizarMotivo`.

### DELETE /api/admin/motivos-observacion/{id}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `Void`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 203, método `desactivarMotivo`.

### PATCH /api/admin/motivos-observacion/{id}/reactivar

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `MotivoObservacionResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 215, método `reactivarMotivo`.

### POST /api/admin/tipos-queso

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `TipoQuesoResponse`.
- Entrada: `@RequestBody @Valid TipoQuesoRequest dto`.
- Fuente: línea 227, método `crearTipoQueso`.

### GET /api/admin/tipos-queso

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `List<TipoQuesoResponse>`.
- Entrada: sin parámetros ni cuerpo.
- Fuente: línea 234, método `listarTiposQueso`.

### PUT /api/admin/tipos-queso/{id}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `TipoQuesoResponse`.
- Entrada: `@PathVariable UUID id, @RequestBody @Valid TipoQuesoRequest dto`.
- Fuente: línea 247, método `actualizarTipoQueso`.

### DELETE /api/admin/tipos-queso/{id}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `Void`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 258, método `desactivarTipoQueso`.

### PATCH /api/admin/tipos-queso/{id}/reactivar

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `TipoQuesoResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 270, método `reactivarTipoQueso`.

### POST /api/admin/precios-litro

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `PrecioLitroResponse`.
- Entrada: `@RequestBody @Valid PrecioLitroRequest dto`.
- Fuente: línea 292, método `crearPrecioLitro`.

### GET /api/admin/precios-litro

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `PaginaResponse<PrecioLitroResponse>` (vigenteDesde desc).
- Entrada: `@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size`.
- Paginación real (feat/paginacion-pendiente): `page` < 0 se lleva a 0 y `size` se acota a 1..100; orden estable con desempate por id.

### GET /api/admin/precios-litro/vigente

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `PrecioLitroResponse` (200) o 204 si no hay precio vigente. Misma regla que la liquidación de pagos (vigenteDesde más reciente <= hoy). La web ya no lo deduce del histórico porque solo recibe una página.
- Fuente: línea 299, método `listarPreciosLitro`.

### GET /api/admin/roles

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `List<RolResponse>`.
- Entrada: sin parámetros ni cuerpo.
- Fuente: línea 314, método `listarRoles`.

### GET /api/admin/configuracion

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `List<ConfiguracionSistemaResponse>`.
- Entrada: sin parámetros ni cuerpo.
- Fuente: línea 327, método `listarConfiguracion`.

### PUT /api/admin/configuracion/{clave}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `ConfiguracionSistemaResponse`.
- Entrada: `@PathVariable String clave, @RequestBody @Valid ConfiguracionSistemaUpdateRequest dto`.
- Fuente: línea 342, método `actualizarConfiguracion`.

## AdminUsuarioController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\AdminUsuarioController.java`.

### POST /api/admin/usuarios

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `UsuarioResponse`.
- Entrada: `@RequestBody @Valid UsuarioRequest dto`.
- Fuente: línea 44, método `crear`.

### GET /api/admin/usuarios/paginado

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `PaginaResponse<UsuarioResponse>` (nombre, desempate por id).
- Entrada: `rol?`, `activo?`, `busqueda?` (nombre o correo) + `@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size`. Filtros aplicados en el servidor antes de paginar.
- Consumidores: pantallas Usuarios y Acopiadores. Paginación real (feat/paginacion-pendiente): `page` < 0 se lleva a 0 y `size` se acota a 1..100; orden estable con desempate por id.

### GET /api/admin/usuarios

- Lista completa sin paginar: se conserva solo para selectores (responsable de unidad en Unidades y en Acopiadores).

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `List<UsuarioResponse>`.
- Entrada: sin parámetros ni cuerpo.
- Fuente: línea 52, método `listar`.

### GET /api/admin/usuarios/{id}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `UsuarioResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 63, método `obtener`.

### PUT /api/admin/usuarios/{id}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `UsuarioResponse`.
- Entrada: `@PathVariable UUID id, @RequestBody @Valid UsuarioUpdateRequest dto`.
- Fuente: línea 82, método `actualizar`.

### DELETE /api/admin/usuarios/{id}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `Void`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 97, método `desactivar`.

### PATCH /api/admin/usuarios/{id}/reactivar

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `UsuarioResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 110, método `reactivar`.

## AnalisisCalidadController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\AnalisisCalidadController.java`.

### POST /api/analisis-calidad

- Permiso: `hasAnyRole('CALIDAD','ADMIN')`.
- Respuesta: `AnalisisCalidadResponse`.
- Entrada: `@RequestBody @Valid AnalisisCalidadRequest dto`.
- Fuente: línea 48, método `crear`.

### GET /api/analisis-calidad/bandeja

- Permiso: `hasAnyRole('CALIDAD','ADMIN')`.
- Respuesta: `List<AnalisisBandejaResponse>`.
- Entrada: `@RequestParam LocalDate fecha`.
- Fuente: línea 54, método `bandeja`.

### GET /api/analisis-calidad/folio/{folio}

- Permiso: `hasAnyRole('CALIDAD','ADMIN')`.
- Respuesta: `List<AnalisisCalidadResponse>`.
- Entrada: `@PathVariable String folio`.
- Fuente: línea 63, método `porFolio`.

### GET /api/analisis-calidad/registro/{registroAcopioId}

- Permiso: `hasAnyRole('CALIDAD','ADMIN')`.
- Respuesta: `List<AnalisisCalidadResponse>`.
- Entrada: `@PathVariable UUID registroAcopioId`.
- Fuente: línea 72, método `porRegistro`.

## ArchivoController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\ArchivoController.java`.

### POST /api/archivos

- Permiso: `hasAnyRole('ACOPIADOR','ADMIN')`.
- Respuesta: `ArchivoResponse`.
- Entrada: `@RequestParam("file") MultipartFile file`.
- Fuente: línea 48, método `subir`.

### GET /api/archivos/{nombre}

- Permiso: `hasAnyRole('ACOPIADOR','ADMIN','CALIDAD')`.
- Respuesta: `Resource`.
- Entrada: `@PathVariable String nombre`.
- Fuente: línea 62, método `obtener`.

## AuthController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\AuthController.java`.

### POST /api/auth/login

- Permiso: `Público`.
- Respuesta: `LoginResponse`.
- Entrada: `@RequestBody @Valid LoginRequest request`.
- Fuente: línea 43, método `login`.

### POST /api/auth/refresh

- Permiso: `Autenticado`.
- Respuesta: `LoginResponse`.
- Entrada: sin parámetros ni cuerpo.
- Fuente: línea 59, método `refrescar`.

### POST /api/auth/refresh-token

- Permiso: `Público`.
- Respuesta: `LoginResponse`.
- Entrada: `@RequestBody @Valid RefreshTokenRequest request`.
- Fuente: línea 83, método `refrescarConRefreshToken`.

### GET /api/auth/me

- Permiso: `Autenticado`.
- Respuesta: `UsuarioMeResponse`.
- Entrada: sin parámetros ni cuerpo.
- Fuente: línea 103, método `me`.

### PATCH /api/auth/password

- Permiso: `Autenticado`.
- Respuesta: `Void`.
- Entrada: `@RequestBody @Valid CambiarPasswordRequest dto`.
- Fuente: línea 118, método `cambiarPassword`.

## ComunicadoController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\ComunicadoController.java`.

### POST /api/comunicados

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `ComunicadoResponse`.
- Entrada: `@RequestBody @Valid CrearComunicadoRequest dto`.
- Fuente: línea 42, método `crear`.

### GET /api/comunicados

- Paginación real: ahora devuelve `PaginaResponse<ComunicadoResponse>` (fecha desc) con `@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size`. La app móvil no lo usa (usa `/zona/{zonaId}`).

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `List<ComunicadoResponse>`.
- Entrada: sin parámetros ni cuerpo.
- Fuente: línea 52, método `listar`.

### GET /api/comunicados/zona/{zonaId}

- Permiso: `Autenticado`.
- Respuesta: `List<ComunicadoResponse>`.
- Entrada: `@PathVariable UUID zonaId`.
- Fuente: línea 65, método `porZona`.

### POST /api/comunicados/{id}/confirmaciones

- Permiso: `hasAnyRole('ACOPIADOR','ADMIN')`.
- Respuesta: `ComunicadoConfirmacionResponse`.
- Entrada: `@PathVariable UUID id, @RequestBody @Valid ConfirmarComunicadoRequest dto`.
- Fuente: línea 85, método `confirmar`.

### GET /api/comunicados/{id}/confirmaciones

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `List<ComunicadoConfirmacionResponse>`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 99, método `confirmaciones`.

## InnovacionController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\InnovacionController.java`.

### GET /api/innovacion/score/{proveedorId}

- Permiso: `hasAnyRole('ADMIN','CALIDAD')`.
- Respuesta: `ScoreConfianzaResponse`.
- Entrada: `@PathVariable UUID proveedorId`.
- Fuente: línea 55, método `score`.

### GET /api/innovacion/prediccion/{proveedorId}

- Permiso: `hasAnyRole('ADMIN','CALIDAD')`.
- Respuesta: `PrediccionProveedorResponse`.
- Entrada: `@PathVariable UUID proveedorId`.
- Fuente: línea 76, método `prediccion`.

### GET /api/innovacion/alertas

- Permiso: `hasAnyRole('ADMIN','CALIDAD')`.
- Respuesta: `List<AlertaAnomaliaResponse>`.
- Entrada: `@RequestParam UUID zonaId`.
- Fuente: línea 88, método `alertasPorZona`.

### GET /api/innovacion/panel-economico

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `PanelEconomicoResponse`.
- Entrada: `@RequestParam UUID zonaId`.
- Fuente: línea 105, método `panelEconomico`.

## JornadaController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\JornadaController.java`.

### GET /api/jornadas

- Permiso: `hasAnyRole('RECEPCION','ADMIN')`.
- Respuesta: `List<JornadaBandejaResponse>`.
- Entrada: sin parámetros ni cuerpo.
- Fuente: línea 46, método `listarPendientesRecepcion`.

### GET /api/jornadas/{id}

- Permiso: `hasAnyRole('RECEPCION','ADMIN')`.
- Respuesta: `JornadaDetalleResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 60, método `obtenerDetalle`.

## LoteProduccionController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\LoteProduccionController.java`.

### POST /api/lotes-produccion

- Permiso: `hasAnyRole('PRODUCCION','ADMIN')`.
- Respuesta: `LoteProduccionResponse`.
- Entrada: `@RequestBody @Valid CrearLoteRequest dto`.
- Fuente: línea 50, método `crear`.

### GET /api/lotes-produccion

- Permiso: `hasAnyRole('PRODUCCION','ADMIN')`.
- Respuesta: `PaginaResponse<LoteProduccionResponse>`.
- Entrada: `@RequestParam(required = false) LocalDate fecha, @RequestParam(required = false) UUID productoId, @RequestParam(required = false) EstadoLote estado, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size`. `estado` (V18) es opcional; un valor inválido responde 400.
- Fuente: método `listar`.

### GET /api/lotes-produccion/{id}

- Permiso: `hasAnyRole('PRODUCCION','ADMIN')`.
- Respuesta: `LoteProduccionResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: método `obtener`.

### POST /api/lotes-produccion/planificar (V18, IMPLEMENTADO 2026-09-30)

- Permiso: `hasAnyRole('PRODUCCION','ADMIN')` (heredado de la clase).
- Entrada: `@RequestBody @Valid PlanificarLoteRequest` `{uuidCliente, fecha, recetaId, litros}`.
- Respuesta: 201 `LoteProduccionResponse` con `estado = PLANIFICADA`, `cantidadEsperada` e `insumos` escalados. No consume stock ni registra producto terminado. Idempotente por `uuidCliente`.
- Errores: 400 validación / insumo que resulta 0 al escalar; 404 receta; 409 mismo uuidCliente con otros datos; 422 receta/producto/presentación/insumo desactivado.

### GET /api/lotes-produccion/{id}/disponibilidad (V18)

- Respuesta: `DisponibilidadProduccionResponse` del plan del lote contra el stock actual (informativo, sin bloqueo).

### POST /api/lotes-produccion/{id}/iniciar (V18)

- PLANIFICADA → EN_PRODUCCION. Descuenta leche (FIFO con bloqueo sobre recepciones) e insumos (UPDATE atómico condicionado). 400 con todos los faltantes si algo no alcanza (no consume nada); 409 si no está PLANIFICADA; 422 insumo desactivado. Reintento sobre EN_PRODUCCION devuelve el lote sin volver a consumir.

### POST /api/lotes-produccion/{id}/finalizar (V18)

- Entrada: `FinalizarLoteRequest` `{detalles: DetalleSalidaRequest[], motivoRendimiento?}`. EN_PRODUCCION → FINALIZADA; recién aquí ingresa producto terminado al inventario. Reintento con el mismo resultado: devuelve el lote sin duplicar; con otro: 409.

### POST /api/lotes-produccion/{id}/cancelar (V18)

- PLANIFICADA → CANCELADA (nada que revertir). EN_PRODUCCION/FINALIZADA: 409.

## KardexController.java (V19, IMPLEMENTADO 2026-10-01)

Solo lectura, solo cantidades. Parámetros comunes: `desde`, `hasta` (LocalDate, opcionales, inclusive; filtran por fecha de registro), `page` (0), `size` (50, máx. 200). Respuesta: `KardexResponse`.

- `GET /api/inventario/kardex/leche` — `hasAnyRole('PRODUCCION','ADMIN')`.
- `GET /api/inventario/kardex/insumos/{insumoId}` — `hasAnyRole('PRODUCCION','ADMIN')`. 404 si no existe.
- `GET /api/inventario/kardex/presentaciones/{presentacionId}` — `hasAnyRole('PRODUCCION','VENTAS','ADMIN')`. 404 si no existe.
- 400 si `desde` > `hasta`. No existen endpoints para editar ni borrar movimientos (un verbo no soportado responde 405).

## InventarioInsumoController.java (V19, IMPLEMENTADO 2026-10-01)

Clase: `hasAnyRole('PRODUCCION','ADMIN')`.

- `GET /api/inventario/insumos` → `InsumoResponse[]` (activos + inactivos con stock).
- `POST /api/inventario/insumos/{id}/ingresos` `IngresoInsumoRequest {cantidad > 0, referencia?, observacion?}` → 201 `MovimientoInsumoResponse`. 404 / 422 (insumo inactivo).
- `POST /api/inventario/insumos/{id}/ajustes` (solo ADMIN) `AjusteInsumoRequest {cantidadFisica ≥ 0, motivo}` → 201 `MovimientoInsumoResponse`. 400 si el conteo coincide con el sistema.
- Cambio en `PUT /api/admin/insumos/{id}`: `stock` distinto del actual → 400 (el stock solo cambia con movimientos).

## RecetaController.java (V18, IMPLEMENTADO 2026-09-30)

Fuente: `...\controller\RecetaController.java`. Clase: `hasAnyRole('PRODUCCION','ADMIN')`; escritura: `hasRole('ADMIN')`.

- `GET /api/recetas?incluirInactivas=false` → `RecetaResponse[]`.
- `GET /api/recetas/{id}` → `RecetaResponse`.
- `GET /api/recetas/{id}/calculo?litros=` → `DisponibilidadProduccionResponse` (factor, leche e insumos escalados, esperado, estado por línea, `litrosMaximos`/`cantidadEsperadaMaxima`). No modifica nada.
- `POST /api/recetas` (ADMIN) → 201 `RecetaResponse`. 400/404/409 (nombre repetido por producto)/422.
- `PUT /api/recetas/{id}` (ADMIN) → `RecetaResponse`. Producto y presentación no cambian (400).
- `DELETE /api/recetas/{id}` (ADMIN) → 204, baja lógica. `PATCH /api/recetas/{id}/reactivar` (ADMIN).

## PagoController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\PagoController.java`.

### POST /api/pagos/generar

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `PagoResponse`.
- Entrada: `@RequestBody @Valid GenerarPagoRequest dto`.
- Fuente: línea 53, método `generar`.

### GET /api/pagos

- Permiso: `hasAnyRole('ADMIN','RECEPCION')`.
- Respuesta: `PaginaResponse<PagoResponse>` (semanaInicio desc).
- Entrada: `@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size`.
- Paginación real (feat/paginacion-pendiente): `page` < 0 se lleva a 0 y `size` se acota a 1..100; orden estable con desempate por id.
- Fuente: línea 63, método `listar`.

### GET /api/pagos/proveedor/{proveedorId}/paginado

- Permiso: `hasAnyRole('ADMIN','RECEPCION')`.
- Respuesta: `PaginaResponse<PagoResponse>`. Entrada: `@PathVariable UUID proveedorId` + `@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size`.
- Lo usa la pestaña Pagos del detalle de proveedor.

### GET /api/pagos/proveedor/{proveedorId}

- Sin cambios (lista completa): es contrato de la app móvil (R-04).

- Permiso: `hasAnyRole('ADMIN','RECEPCION')`.
- Respuesta: `List<PagoResponse>`.
- Entrada: `@PathVariable UUID proveedorId`.
- Fuente: línea 71, método `historialPorProveedor`.

### GET /api/pagos/{id}

- Permiso: `hasAnyRole('ADMIN','RECEPCION')`.
- Respuesta: `PagoResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 83, método `obtener`.

### PATCH /api/pagos/{id}/comprobante

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `PagoResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 96, método `marcarComprobanteGenerado`.

### GET /api/pagos/{id}/ajustes

- Permiso: `hasAnyRole('ADMIN','RECEPCION')`.
- Respuesta: `List<AjustePagoResponse>`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 110, método `ajustesDePago`.

### POST /api/pagos/{id}/ajuste-precio

- Permiso: `hasRole('ADMIN')`.
- Entrada: `@PathVariable UUID id` + `AjustePrecioPagoRequest { precioLitroNuevo (0.001–999.999, ≤3 decimales), motivo (obligatorio, ≤500) }`.
- Respuesta: 201 `AjustePrecioPagoResponse`. 400 si el precio es cero/negativo/igual al actual o el motivo está vacío; 404 si el pago no existe.
- Cambia el precio por litro SOLO de ese pago (V24, tabla `ajuste_precio_pago`, append-only): el pago original no se modifica y el precio general de la leche no cambia. Un ajuste nuevo reemplaza al anterior en el cálculo; el historial se conserva. `PagoResponse` expone `precioLitroEfectivo` y `totalAPagar`.

### GET /api/pagos/{id}/ajustes-precio

- Permiso: `hasAnyRole('ADMIN','RECEPCION')`.
- Respuesta: `List<AjustePrecioPagoResponse>` (más reciente primero).

### GET /api/pagos/{id}/boleta

- Permiso: `hasAnyRole('ADMIN','RECEPCION')`.
- Respuesta: `application/pdf` en línea (`Content-Disposition: inline`, `Cache-Control: no-store`). Boleta de pago a proveedor: comprobante **interno**, no es boleta ni factura electrónica (sin serie/RUC/SUNAT). Lleva proveedor, semana, litros, precio y total originales, cada ajuste de precio con motivo y usuario, y el total a pagar.
- Un enlace directo no puede enviar el token: el panel la pide como `blob` con la sesión y la abre en otra pestaña.

### GET /api/pagos/{id}/lineas (Fases B y C)

- Permiso: `hasAnyRole('ADMIN','RECEPCION')`.
- Respuesta: `List<LineaPagoResponse>`: por entrega liquidada, litros originales / liquidados / contabilizados / efectivos de hoy, precio normal y precio aplicado, con el precio de calidad propio si lo tiene. Sin datos personales.
- Panel: «Ver entregas y precios de calidad» en el detalle del pago.

### POST /api/pagos/{id}/lineas/{registroAcopioId}/ajuste-calidad (Fase C)

- Permiso: `hasRole('ADMIN')` (CALIDAD y RECEPCION reciben 403).
- Entrada: `AjusteCalidadEntregaRequest { precioLitroNuevo, analisisCalidadId, motivo }`.
- Respuesta: 201 `AjusteCalidadEntregaResponse`. 400 si el análisis es de otra entrega, el precio es igual al actual o el motivo está vacío; 404 si el pago, la entrega dentro del pago o el análisis no existen.
- Fija a mano el precio de UNA entrega (append-only); manda sobre el ajuste de precio del pago completo. El panel solo ofrece los análisis de esa entrega (`GET /api/analisis-calidad/registro/{id}`).

### GET /api/pagos/{id}/ajustes-calidad (Fase C)

- Permiso: `hasAnyRole('ADMIN','RECEPCION','CALIDAD')`.
- Respuesta: `List<AjusteCalidadEntregaResponse>` (más reciente primero).
- El panel lo muestra en el detalle del pago (ADMIN y RECEPCION). CALIDAD tiene permiso en la API pero **no hay ruta del panel** que lo alcance (su único acceso es «Calidad»; `/pagos` es ADMIN/RECEPCION).

### GET /api/pagos/ajustes/pendientes

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `List<AjustePagoResponse>`.
- Entrada: `@RequestParam UUID proveedorId`.
- Fuente: línea 118, método `ajustesPendientes`.

### PATCH /api/pagos/ajustes/{id}/liquidar

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `AjustePagoResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 130, método `liquidarAjuste`.

## ProveedorController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\ProveedorController.java`.

### POST /api/proveedores

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `ProveedorAdminResponse`.
- Entrada: `@RequestBody @Valid ProveedorRequest dto`.
- Fuente: línea 48, método `crear`.

### GET /api/proveedores

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `PaginaResponse<ProveedorAdminResponse>` (nombre, desempate por id).
- Entrada: `@RequestParam(required = false) UUID zonaId, @RequestParam(required = false) Boolean activo, @RequestParam(required = false) String busqueda, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size`.
- `busqueda` (nombre o DNI) se resuelve en el servidor sobre todo el padrón antes de paginar; antes la web solo filtraba la página descargada.
- Fuente: línea 69, método `listar`.

### GET /api/proveedores/operativo

- Permiso: `hasAnyRole('ADMIN','ACOPIADOR','RECEPCION','CALIDAD')`.
- Respuesta: `List<ProveedorPublicoResponse>`.
- Entrada: sin parámetros ni cuerpo.
- Fuente: línea 94, método `listarOperativo`.

### GET /api/proveedores/{id}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `ProveedorAdminResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 109, método `obtener`.

### GET /api/proveedores/qr/{codigoQr}

- Permiso: `hasAnyRole('ADMIN','ACOPIADOR')`.
- Respuesta: `ProveedorPublicoResponse`.
- Entrada: `@PathVariable String codigoQr`.
- Fuente: línea 131, método `obtenerPorCodigoQr`.

### PUT /api/proveedores/{id}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `ProveedorAdminResponse`.
- Entrada: `@PathVariable UUID id, @RequestBody @Valid ProveedorUpdateRequest dto`.
- Fuente: línea 152, método `actualizar`.

### DELETE /api/proveedores/{id}

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `Void`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 171, método `desactivar`.

### PATCH /api/proveedores/{id}/reactivar

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `ProveedorAdminResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 188, método `reactivar`.

### GET /api/proveedores/{id}/historial-zona

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `List<HistorialZonaResponse>`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 202, método `historialZona`.

### PUT /api/proveedores/{id}/zona

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `ProveedorAdminResponse`.
- Entrada: `@PathVariable UUID id, @RequestParam UUID zonaId`.
- Fuente: línea 220, método `reasignarZona`.

## RecepcionPlantaController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\RecepcionPlantaController.java`.

### POST /api/recepcion-planta

- Permiso: `hasAnyRole('RECEPCION','ADMIN')`.
- Respuesta: `RecepcionPlantaResponse`.
- Entrada: `@RequestBody @Valid RecepcionPlantaRequest dto`.
- Fuente: línea 51, método `crear`.

### GET /api/recepcion-planta

- Permiso: `hasAnyRole('RECEPCION','ADMIN')`.
- Respuesta: `PaginaResponse<RecepcionPlantaResponse>`.
- Entrada: `@RequestParam(required = false) UUID unidadId, @RequestParam(required = false) LocalDate fecha, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size`.
- Fuente: línea 67, método `listar`.

### GET /api/recepcion-planta/{id}

- Permiso: `hasAnyRole('RECEPCION','ADMIN')`.
- Respuesta: `RecepcionPlantaResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 82, método `obtener`.

## RegistroAcopioController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\RegistroAcopioController.java`.

### POST /api/registros-acopio

- Permiso: `hasAnyRole('ACOPIADOR','ADMIN')`.
- Respuesta: `RegistroAcopioResponse`.
- Entrada: `@RequestBody @Valid RegistroAcopioDTO dto`.
- Fuente: línea 55, método `crear`.

### GET /api/registros-acopio

- Sin cambios (lista completa del filtro): contrato de la app móvil y de la bandeja de Calidad. La pantalla web de Acopios usa `/paginado`, `/por-jornada` y `/resumen-por-proveedor`.

- Permiso: `hasAnyRole('ACOPIADOR','ADMIN','CALIDAD','PRODUCCION')`.
- Respuesta: `List<RegistroAcopioResponse>`.
- Entrada: `@RequestParam(required = false) LocalDate fecha, @RequestParam(required = false) UUID zonaId, @RequestParam(required = false) Boolean sinAnalisis`.
- Fuente: línea 90, método `buscar`.

### GET /api/registros-acopio/{id}

- Permiso: `hasAnyRole('ACOPIADOR','ADMIN','CALIDAD','PRODUCCION')`.
- Respuesta: `RegistroAcopioResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 112, método `obtener`.

### GET /api/registros-acopio/paginado

- Permiso: `hasAnyRole('ACOPIADOR','ADMIN','CALIDAD','PRODUCCION')` (los mismos del listado completo).
- Respuesta: `PaginaResponse<RegistroAcopioResponse>` (fechaHora desc).
- Entrada: `fecha?`, `zonaId?`, `sinAnalisis?`, `busqueda?` (proveedor o placa) + `@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size`. Vista "Por entrega" de Acopios.

### GET /api/registros-acopio/por-jornada

- Mismos permisos y filtros que `/paginado`.
- Respuesta: `PaginaResponse<AcopioPorJornadaResponse>` `{clave, esJornada, acopiadorNombre, placa, fecha, cantidad, totalLitros, primerAcopioId}`. Agrupado en SQL sobre todo el filtro y después paginado (una jornada nunca queda partida entre páginas). Vista "Por jornada" de Acopios.

### GET /api/registros-acopio/resumen-por-proveedor

- Mismos permisos. Entrada: `fecha?`, `zonaId?`, `sinAnalisis?` (sin búsqueda ni página).
- Respuesta: `TotalAcopioProveedorResponse[]` `{proveedorId, proveedorNombre, totalLitros, cantidad}`, totales globales del filtro para el gráfico "Acopio por proveedor".

### GET /api/registros-acopio/proveedor/{proveedorId}/paginado

- Mismos permisos. Respuesta: `PaginaResponse<RegistroAcopioResumenResponse>` + `@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size`. Lo usa el diálogo de historial del proveedor.

### GET /api/registros-acopio/proveedor/{proveedorId}

- Permiso: `hasAnyRole('ACOPIADOR','ADMIN','CALIDAD','PRODUCCION')`.
- Respuesta: `List<RegistroAcopioResumenResponse>`.
- Entrada: `@PathVariable UUID proveedorId`.
- Fuente: línea 132, método `porProveedor`.

### POST /api/registros-acopio/{id}/correcciones

- Permiso: `hasAnyRole('CALIDAD','ADMIN')`.
- Respuesta: `CorreccionRegistroResponse`.
- Entrada: `@PathVariable UUID id, @RequestBody @Valid CorreccionRegistroRequest dto`.
- Fuente: línea 153, método `corregir`.

### GET /api/registros-acopio/{id}/correcciones

- Permiso: `hasAnyRole('CALIDAD','ADMIN')`.
- Respuesta: `List<CorreccionRegistroResponse>`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 166, método `listarCorrecciones`.

## RutaProveedorController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\RutaProveedorController.java`.

### PUT /api/zonas/{zonaId}/ruta

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `List<RutaProveedorOrdenResponse>`.
- Entrada: `@PathVariable UUID zonaId, @RequestBody @Valid DefinirRutaZonaRequest dto`.
- Fuente: línea 50, método `definir`.

### GET /api/zonas/{zonaId}/ruta

- Permiso: `hasAnyRole('ADMIN','ACOPIADOR')`.
- Respuesta: `List<RutaProveedorOrdenResponse>`.
- Entrada: `@PathVariable UUID zonaId`.
- Fuente: línea 68, método `listar`.

## SyncController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\SyncController.java`.

### POST /api/sync/registros-acopio

- Permiso: `hasAnyRole('ACOPIADOR','ADMIN')`.
- Respuesta: `SyncResultResponse`.
- Entrada: `@RequestBody List<RegistroAcopioDTO> lote`.
- Fuente: línea 43, método `subirRegistrosAcopio`.

### POST /api/sync/jornadas

- Permiso: `hasAnyRole('ACOPIADOR','ADMIN')`.
- Respuesta: `SyncResultResponse`.
- Entrada: `@RequestBody List<JornadaDTO> lote`.
- Fuente: línea 58, método `subirJornadas`.

### POST /api/sync/jornadas/estado

- Permiso: `hasAnyRole('ACOPIADOR','ADMIN')`.
- Respuesta: `SyncResultResponse`.
- Entrada: `@RequestBody List<JornadaEstadoRequest> lote`.
- Fuente: línea 73, método `subirJornadaEstados`.

### POST /api/sync/recepciones-jornada

- Permiso: `hasAnyRole('RECEPCION','ADMIN')`.
- Respuesta: `SyncResultResponse`.
- Entrada: `@RequestBody List<RecepcionJornadaRequest> lote`.
- Fuente: línea 88, método `subirRecepcionesJornada`.

### POST /api/sync/puntos-gps

- Permiso: `hasAnyRole('ACOPIADOR','ADMIN')`.
- Respuesta: `SyncResultResponse`.
- Entrada: `@RequestBody List<PuntoGpsJornadaDTO> lote`.
- Fuente: línea 103, método `subirPuntosGps`.

### POST /api/sync/analisis-calidad

- Permiso: `hasAnyRole('CALIDAD','ADMIN')`.
- Respuesta: `SyncResultResponse`.
- Entrada: `@RequestBody List<AnalisisCalidadRequest> lote`.
- Fuente: línea 114, método `subirAnalisisCalidad`.

### POST /api/sync/lotes-produccion

- Permiso: `hasAnyRole('PRODUCCION','ADMIN')`.
- Respuesta: `SyncResultResponse`.
- Entrada: `@RequestBody List<CrearLoteRequest> lote`.
- Fuente: línea 125, método `subirLotesProduccion`.

### POST /api/sync/ventas

- Permiso: `hasAnyRole('VENTAS','ADMIN')`.
- Respuesta: `SyncResultResponse`.
- Entrada: `@RequestBody List<VentaRequest> lote`.
- Fuente: línea 136, método `subirVentas`.

### GET /api/sync/cambios

- Permiso: `Autenticado`.
- Respuesta: `CambiosResponse`.
- Entrada: `@RequestParam(required = false) Instant desde`.
- Fuente: línea 154, método `descargarCambios`.

## UnidadController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\UnidadController.java`.

### GET /api/unidades/operativo

- Permiso: `hasAnyRole('ADMIN','ACOPIADOR','RECEPCION','CALIDAD')`.
- Respuesta: `List<UnidadResponse>`.
- Entrada: sin parámetros ni cuerpo.
- Fuente: línea 45, método `listarOperativo`.

## VentaController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\VentaController.java`.

### POST /api/ventas

- Permiso: `hasAnyRole('VENTAS','ADMIN')`.
- Respuesta: `VentaResponse`.
- Entrada: `@RequestBody @Valid VentaRequest dto`.
- Fuente: línea 49, método `crear`.

### GET /api/ventas

- Permiso: `hasAnyRole('VENTAS','ADMIN')`.
- Respuesta: `PaginaResponse<VentaResponse>`.
- Entrada: `@RequestParam(required = false) LocalDate fecha, @RequestParam(required = false) String tipoCliente, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size`.
- Fuente: línea 64, método `listar`.

### GET /api/ventas/{id}

- Permiso: `hasAnyRole('VENTAS','ADMIN')`.
- Respuesta: `VentaResponse`.
- Entrada: `@PathVariable UUID id`.
- Fuente: línea 79, método `obtener`.

## ZonaController.java

Fuente: `C:\EcoLacteosProyect\acopio-backend-fase2\ecolacteos-backend\src\main\java\com\planta\acopio\controller\ZonaController.java`.

### GET /api/zonas/operativo

- Permiso: `hasAnyRole('ADMIN','ACOPIADOR','RECEPCION','CALIDAD')`.
- Respuesta: `List<ZonaResponse>`.
- Entrada: sin parámetros ni cuerpo.
- Fuente: línea 42, método `listarOperativo`.

### GET /api/inventario/ajustes

- Permiso: `hasRole('ADMIN')`.
- Respuesta: `PaginaResponse<AjusteInventarioResponse>` (creadoEn desc). Antes `List<...>`; único consumidor: diálogo de historial de ajustes.
- Entrada: `@RequestParam UUID presentacionId` + `@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size`.
