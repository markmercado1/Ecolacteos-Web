# Validación y criterio de calidad

No hay pruebas ejecutadas del producto todavía. Esta es una lista de aceptación, no resultados.

## Matriz de flujos

| Flujo | Casos mínimos |
|---|---|
| Acceso | Login válido/inválido, token vencido, refresh concurrente, refresh rechazado, logout, 403 |
| Usuarios | Alta con rol real, email repetido, edición sin cambiar password, desactivar/reactivar |
| Acopiador/vehículo | Usuario existente/nuevo, responsable correcto, placa repetida, fallo de asignación sin perder usuario |
| Proveedores | Crear sin zona, editar, filtros paginados, cambio de zona e historial, desactivar/reactivar |
| Catálogos | Request por catálogo, activo/inactivo según API, valores inválidos, ausencia de GET individual |
| Rutas | Reordenar, proveedor duplicado, proveedor fuera de zona, ruta vacía bloqueada, cambios sin guardar |
| Precio | Precio >0, vigencia duplicada, histórico y precio futuro |
| Comunicados | Mensaje vacío, zonas vacías, publicación, listado y confirmaciones |
| Pagos | Sin entregas, período superpuesto, duplicado, precio ausente, detalle y ajustes, marca de comprobante |
| Ventas | UUID estable al reintentar, doble clic, cantidad/precio, tipo inactivo, lista paginada y detalle |
| Acopio | Fecha/zona, sinAnalisis true/false, foto autenticada, correcciones originales |
| Calidad | Bandeja por entrega, folio, varios análisis, resultado nulo/ausente según consulta, score sin cálculo |
| Jornadas/recepción | Solo regresando en bandeja, detalle, lista recibida, diferencia cero/positiva/negativa y ALERTA |
| Producción | Filtros, lote con trazabilidad, rendimiento y lista vacía |
| Panel | Sin forecast (404), simulación null, ventas globales sin duplicarlas por zona, errores parciales |

## Tipos de comprobación

- Pruebas unitarias de lógica con valor: renovación, permisos de navegación, mapping de payload, idempotencia/reintento, paginación y alcance de agregaciones.
- Pruebas HTTP con mocks verifican método/ruta/query/body y manejo de errores; no certifican servidor real.
- Integración en backend de desarrollo: flujo completo con IDs reales y roles. No guardar credenciales en evidencias.
- Revisión visual: escritorio/móvil, teclado, foco, zoom, tema y estados. Lectura de código no sustituye render.
- Build de producción y scripts reales documentados en package.json.

No escribir pruebas que repitan literalmente CSS o implementación sin comprobar comportamiento. No ejecutar suites repetidamente si no cambió nada ni apareció una preocupación nueva.

## Cierre de fase

Registrar comando exacto, resultado, fecha y limitaciones. “No ejecutado”, “bloqueado” y “falló” son resultados distintos. No reutilizar reportes antiguos como prueba actual. Para errores pendientes: reproducción, impacto, archivo/endpoint y siguiente paso.

## Definición de entrega

El alcance inicial tiene flujos reales, estados completos y contratos correctos; cada módulo soportado está probado. Las propuestas de ampliación están separadas. No se entrega como “todo terminado” si falta verificar autenticación o escrituras reales por falta de entorno.

Publicar requiere solicitud de usuario, destino y configuración. Compilar no equivale a desplegar.

