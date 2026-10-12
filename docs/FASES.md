# Plan de cinco fases

Los estados válidos son PENDIENTE, EN_CURSO, PARCIAL, BLOQUEADA y COMPLETA. El alcance de entrega usa el backend actual; propuestas de ampliación no se convierten en obligaciones por aparecer en el análisis.

## Fase 1 — Base Angular, identidad visual y acceso

Objetivo: aplicación navegable, autenticación real y componentes reutilizables.

Trabajo:
- Crear Angular en la raíz sin reemplazar estos documentos. Elegir versiones compatibles; registrar Node/Angular/TypeScript y comando de instalación.
- Configurar rutas lazy, entorno de API, HttpClient, interceptor Bearer, guards, manejo de errores y pruebas.
- Implementar login, /auth/me, renovación con refresh-token, cierre local de sesión y cambio de contraseña.
- Evitar renovaciones concurrentes: una renovación compartida, reintento una vez, nunca bucle de 401. No usar /auth/refresh con token expirado.
- Shell con navegación por permisos, estado activo, encabezados, responsive y estados de carga/error/vacío.
- Integrar tokens de theme.css y componentes de tabla, formulario, diálogo, tarjeta y notificación.
- Mantener rutas de módulos pendientes claramente identificadas; no simular datos de negocio.

Aceptación:
- Instalación reproducible, build y pruebas pertinentes ejecutadas.
- Cambio de colores en un solo archivo modifica shell, botones, tarjetas y gráficos.
- Login válido/inválido, restauración según política de sesión, refresh y 403 comprobados con pruebas; integración real registrada si hay entorno.
- Navegación por teclado, foco visible y shell revisado en escritorio/móvil.
- No secretos en repositorio; README explica comandos reales.

## Fase 2 — Administración y preparación operativa

Objetivo: reemplazar el trabajo administrativo que hoy requiere Postman.

Trabajo:
- Usuarios: listado, detalle, crear, editar, password opcional, desactivar/reactivar; roles desde API.
- Acopiadores: vista de usuarios ACOPIADOR, unidades por responsable, alta guiada y recuperación si falla el segundo paso.
- Evaluar ficha sin cuenta según DECISIONES. Implementar solo si pasa el criterio aditivo; documentar resultado.
- Unidades: crear/editar/listar con placa, capacidadTon, zonaId opcional y responsableId. No botón de baja inexistente.
- Proveedores: listado paginado y filtros reales, detalle/QR, crear/editar/desactivar/reactivar, cambio de zona e historial.
- Zonas, motivos, tipos de queso y configuración: operaciones soportadas; explicar limitación de inactivos. No crear GET individual ficticio.
- Precio por litro: registro de nueva vigencia e histórico; no editar.
- Rutas por zona: orden, hora, proveedor, guardar reemplazo completo, detectar cambios sin guardar; no mapa geográfico ficticio ni ruta vacía guardable.
- Comunicados: publicar mensaje a varias zonas, listar y consultar confirmaciones.
- Pagos: generar por proveedor/período, historial y detalle, registros incluidos, marca de comprobante y ajustes por proveedor/liquidación. Separar generación de liquidación de pago efectivo.

Aceptación:
- Cada formulario envía el request exacto y muestra validación/error del servidor.
- Flujo usuario → vehículo comprobado; se preserva el usuario si falla la asignación.
- No campo zonaIds ni restricciones territoriales en usuario.
- Tipos de queso/catálogos/periodicidad no inventan reglas ausentes.
- Paginación real solo donde existe; búsqueda local indicada como tal.
- Reactivación disponible donde el recurso pueda localizarse; limitación documentada si el listado no expone inactivos.
- Operaciones mutantes verificadas en entorno de pruebas, no producción.
- Si hay ampliación backend: migración, tests y compatibilidad móvil verificados antes de COMPLETA.

## Fase 3 — Ventas

Objetivo: venta simple operativa y consulta confiable.

Trabajo:
- Módulo propio: registro, historial paginado, filtros fecha/tipoCliente y detalle.
- Tipos de queso desde catálogo permitido; ADMIN puede usar admin y VENTAS puede usar sync/cambios.
- Request: uuidCliente, fecha, tipoCliente, tipoQuesoId, cantidad, precioUnitario.
- Generar UUID al iniciar la operación y conservarlo en reintentos. Deshabilitar doble envío mientras está en curso.
- Mostrar cálculo previo como estimación y total devuelto como confirmado.
- No vendedor editable, stock, factura, cliente concreto, carrito o edición/anulación.

Aceptación:
- Canales exactos MAYORISTA/PROVEEDOR/PUBLICO.
- Cantidad entera ≥1 y precio ≥0, fecha ISO, tipo de queso activo.
- Error de red/reintento no duplica intencionadamente la venta.
- Filtros cambian página a 0; total de página no se muestra como total del período.
- Alta real y recuperación de la venta por GET verificadas con datos de desarrollo.

## Fase 4 — Supervisión, perfiles y gráficos

Objetivo: consultar la operación capturada en móvil sin duplicar su captura.

Trabajo:
- Acopio: lista por fecha/zona/sinAnalisis, detalle, fotos autenticadas, historial y correcciones en lectura.
- Calidad: pendientes y bandeja por fecha de entrega; resultados, detalle por registro/folio, alertas y score.
- Jornadas: bandeja REGRESANDO_A_PLANTA y detalle; recepción paginada, diferencias, estado y registros vinculados.
- Producción: listado, filtros, detalle, rendimiento y trazabilidad de registros.
- Perfil integral de proveedor: zonas, entregas, pagos, ajustes, score/predicción; cargar pestañas bajo demanda.
- Panel económico: riesgo valorizado por zona, último forecast, simulación nullable y ventas globales por canal.
- Gráficos permitidos: barras de ventas globales por canal; acopio de una fecha/zona sobre listado completo; comparación campo/planta en detalle; rendimiento esperado/obtenido de un lote; componentes del score.
- Si se agrega gráfico sobre una página, etiquetarlo “página actual”; preferir detalle y colecciones completas acotadas.
- Tratar ausencia de forecast/score como sin cálculo disponible, no 0.
- Propuestas de histórico GPS/estadísticas van al backlog, no se simulan.

Aceptación:
- Cada gráfico tiene fuente, unidad, período y alcance escritos en UI de forma comprensible.
- No cambiar visualmente ventas globales como si fueran territoriales.
- sinAnalisis=false no se interpreta como “analizados”.
- RECEPCION no dispara GET acopios no autorizado; usa sus consultas permitidas.
- Sin acciones de captura de acopio/recepción desde web.
- Links de trazabilidad llegan a datos correctos; errores en una pestaña no derriban todo el perfil.
- Estados vacíos/nulos y 404 por falta de cálculo verificados.
- Revisión visual con datos variados, nombres largos y pantalla pequeña.

## Fase 5 — Integración, accesibilidad y entrega

Objetivo: cerrar el alcance, no añadir módulos nuevos.

Trabajo:
- Ejecutar matriz de VALIDACION y resolver defectos del alcance.
- Revisar permisos y navegación con ADMIN y roles expuestos.
- Verificar formularios, pérdidas de conexión, expiración de sesión, recarga directa de rutas y operaciones pendientes.
- Accesibilidad: teclado, foco, diálogos, etiquetas, contraste y alternativas textuales a gráficos.
- Usabilidad: carga, vacíos, errores, texto en español, formatos de fechas/soles/litros.
- Build de producción, rutas de despliegue SPA, configuración externa/orígenes API y CORS documentados.
- Revisar dependencias, retirar mocks de producción, logs sensibles y código muerto relevante.
- Actualizar manual de uso, README, inventario de capacidades y pendientes aceptados.

Aceptación final:
- Build, pruebas de lógica crítica y pruebas integradas del alcance pasan con evidencia actual.
- Flujos completos probados contra backend de desarrollo; si faltan acceso o credenciales, PARCIAL, no COMPLETA.
- Ningún botón anuncia función no implementada ni gráfico usa datos ilustrativos.
- Diferencias/backend necesario están explícitos y separados de defectos.
- Estado y registro permiten continuar sin historial.
- Publicación no incluida hasta que el usuario la pida y exista destino.

## Dependencias y bloqueos

No saltar una dependencia técnica rota. Si solo falta validación en vivo de una fase, puede avanzarse trabajo independiente de la siguiente dejando ambas PARCIALES y el pendiente visible; esto no autoriza declarar completada la anterior. No rehacer trabajo validado sin nueva evidencia.

