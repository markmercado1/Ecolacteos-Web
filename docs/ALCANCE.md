# Alcance funcional y límites comprobados

Fuente: backend canónico local y HTML proporcionado, contrastados con el móvil. Inventario estático: 98 operaciones/18 controladores. CONTRATOS contiene 28 DTOs de entrada, incluido RutaItemRequest. No se ha certificado un servidor desplegado.

## Decisión vigente que prevalece sobre ideas anteriores

Las zonas son libres. No desarrollar asignación restrictiva usuario–zonas. La selección multizona móvil es una preferencia local y no un campo de UsuarioRequest. Una unidad tiene una zona opcional, pero eso no limita la movilidad del acopiador.

## Mapa de módulos

| Módulo | Escritura web | Lectura e interacciones | Límite actual |
|---|---|---|---|
| Usuarios | Crear/editar/desactivar/reactivar | Lista y detalle, roles | Sin paginación ni filtro remoto |
| Acopiadores | Alta como Usuario y asignación de unidad | Filtrar ACOPIADOR y unir responsableId | Ficha sin cuenta condicionada a ampliación |
| Unidades | Crear/editar | Listado | Sin DELETE, activo ni GET individual |
| Proveedores | CRUD lógico y cambio de zona | Paginación zona/activo, QR, historial | Sin búsqueda remota por nombre/DNI |
| Catálogos | Operaciones concretas por recurso | Zonas, motivos, tipos y configuración | Algunos solo activos; no CRUD uniforme |
| Rutas | Reemplazo completo por zona | Orden y hora estimada | No geometría; items no vacío |
| Comunicados | Crear mensaje a zonas | Listado y confirmaciones | Sin editar/eliminar; sin título |
| Pagos | Generar, marcar comprobante, liquidar ajuste | Historial/detalle/ajustes por proveedor | No comprobante PDF ni desembolso registrado |
| Precios | Crear vigencia | Histórico | Sin editar/eliminar; fecha única |
| Ventas | Crear venta simple | Lista paginada fecha/tipoCliente y detalle | Sin stock, cliente identificado, carrito, edición o anulación |
| Acopio | Ninguna captura en web | Fecha/zona/sinAnalisis, detalle, historial, correcciones | Sin paginación ni filtro acopiador |
| Calidad | Consulta en alcance inicial | Bandeja/folio/registro, alertas, score | Bandeja por fecha de entrega, no histórico global paginado |
| Jornadas | Consulta | Pendientes de recepción y detalle | GET lista solo REGRESANDO_A_PLANTA |
| Recepción | Consulta | Lista fecha/unidad, detalle y diferencias | Sin filtro remoto por estado/rango |
| Producción | Consulta | Lotes fecha/tipo, detalle, rendimiento y origen | Sin stock ni estadísticas agregadas |
| Panel | Consulta | Económico por zona, alertas, forecast y ventas por canal | Ventas globales históricas; no serie diaria |

## Contratos que más afectan al diseño

- Crear usuario: nombre, email, password, rolNombre. Editar: nombre, email, rolNombre, nuevaPassword opcional. No dni, telefono ni zonaIds.
- Unidad: placa, capacidadTon opcional, zonaId opcional, responsableId. No nombre/descripcion. El formulario genérico del HTML no es definitivo.
- Proveedor: nombre, dni, telefono opcional, zonaActualId opcional. PUT de datos no cambia zona; usar PUT /api/proveedores/{id}/zona?zonaId=...
- Venta: uuidCliente, fecha, tipoCliente, tipoQuesoId, cantidad, precioUnitario. Total y vendedor se resuelven en servidor.
- Un pago exige proveedorId, semanaInicio, semanaFin; el servidor calcula litros/precio/total.
- Rutas: items[] con proveedorId, orden y horaEstimada opcional.
- Comunicado: mensaje y zonaIds[]; respuesta tiene zonasNombres, no título ni IDs de destino.
- Prototipo usa códigos PRV/VEN/LOT ilustrativos: la API usa UUID.

## GETs para supervisión

| Vista | Consultas principales |
|---|---|
| Acopio | GET /api/registros-acopio?fecha=&zonaId=&sinAnalisis=; GET /api/registros-acopio/{id} |
| Perfil de proveedor | GET /api/proveedores/{id}; /{id}/historial-zona; GET /api/registros-acopio/proveedor/{id}; GET /api/pagos/proveedor/{id} |
| Calidad | GET /api/analisis-calidad/bandeja?fecha=; /registro/{id}; /folio/{folio} |
| Correcciones | GET /api/registros-acopio/{id}/correcciones |
| Jornada | GET /api/jornadas; /api/jornadas/{id} |
| Recepción | GET /api/recepcion-planta?unidadId=&fecha=&page=&size=; /{id} |
| Producción | GET /api/lotes-produccion?fecha=&tipoQuesoId=&page=&size=; /{id} |
| Ventas | GET /api/ventas?fecha=&tipoCliente=&page=&size=; /{id} |
| Economía | GET /api/innovacion/panel-economico?zonaId=; /alertas?zonaId=; /score/{proveedorId}; /prediccion/{proveedorId} |

Los valores vacíos son marcadores documentales; no enviar UUID/fecha vacíos. Para parámetros y permisos completos, consultar ENDPOINTS.

## Hallazgos que no deben ocultarse

1. PanelEconomicoService usa VentaRepository.margenAgrupadoPorTipoCliente: suma total de todas las ventas sin zona/fecha. margenPorCanal no es margen neto.
2. ForecastingService.obtenerUltima arroja 404 si falta proyección; puede fallar todo el panel. pctRechazoSiScoreSube10 puede ser null.
3. El gráfico diario del HTML es ilustrativo; no hay serie equivalente en el panel.
4. GET /jornadas solo trae regresando a planta; el detalle por ID puede consultar otros estados conocidos.
5. Puntos GPS se suben vía sync, pero no hay GET de recorrido.
6. sinAnalisis=false deja de filtrar; no significa solo analizados. La respuesta general de acopio no trae resultado de calidad, acopiadorId ni jornadaId.
7. Bandeja de calidad agrupa último análisis por entrega del día. El resultado actual es RECHAZADO si aguaAnadida=true, APROBADO en otro caso; no se evalúan umbrales de todas las mediciones.
8. Correcciones se anexan y no sustituyen litros del registro. PagoService suma originales y aplica precio vigente al generar, no precio histórico de cada entrega.
9. Ajustes posteriores al pago son incrementales y usan el precio del pago original. “Comprobante generado” es una marca, no dinero pagado ni documento descargable.
10. disponibleParaLote significa no vinculado a otro lote; no garantiza calidad aprobada ni recepción. Rendimiento actual = unidades/litros ×100.
11. Consulta por zona de acopio usa zona actual del proveedor, no asignación histórica de la entrega.
12. Rutas no admiten lista vacía por @NotEmpty. No guardarlas simulando éxito.
13. Zonas/motivos/tipos listan activos; no prometer selector completo de inactivos. Unidades carecen de baja y GET individual.
14. Enum inválido y ciertas restricciones SQL pueden terminar en 500 genérico. Formularios deben usar valores exactos y manejar error sin afirmar 400 universal.
15. Configuración valor es String no vacío; no valida tipo numérico por clave aunque otros servicios lo interpretan como número.
16. Usuario puede tener varias unidades. Crear jornada/acopio exige unidad del usuario autenticado, incluso si un rol tiene acceso HTTP.
17. POST batch devuelve HTTP 200 con errores individuales; revisar errores y confirmadosConId.
18. GET sync/cambios no es incremental pese a aceptar desde. No permite inspeccionar pendientes no enviados de teléfonos.
19. Campos monetarios del panel no equivalen a utilidad: flujoCajaProyectado es volumen estimado × precio de leche.
20. Recepción tiene request tradicional y request por jornada; el segundo calcula litros esperados en servidor. No mezclarlos.

## Backlog backend: propuestas, NO endpoints existentes

No implementar todos por defecto. Priorizar solo si el usuario amplía alcance:
- Histórico general: GET /api/admin/jornadas con rango/estado/acopiador/unidad y paginación.
- Recorrido: GET /api/jornadas/{id}/puntos-gps.
- Estadísticas: /api/estadisticas/acopio, ventas, produccion, recepcion, calidad y pagos con período y dimensiones definidas.
- Ajustes pendientes globales; hoy exige proveedorId.
- Búsqueda/paginación de usuarios, búsqueda de proveedores y consulta de catálogos inactivos.
- Permitir vaciar ruta si se solicita.
- Exportaciones/comprobantes reales si se solicitan.
- Ficha de acopiador: única ampliación condicionada aprobada, según DECISIONES.

No proponer ventas por zona sin definir primero la relación territorial de Venta. No sumar paneles de zonas para obtener ventas globales: repetiría el mismo total.

