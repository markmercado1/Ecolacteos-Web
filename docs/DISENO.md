# Diseño y tema

## Dirección

Mantener identidad del HTML de referencia: verdes, tonos neutros cálidos, navegación lateral y jerarquía administrativa. Mejorar densidad, jerarquía y significado de las tarjetas. No rehacer la marca ni llenar todas las páginas de cuatro KPI decorativos iguales.

## Fuente central

Integrar `docs/referencia/theme.css` como `src/styles/theme.css`. Los colores de marca/estado/gráficos, tipografía, radios, espaciados y sombras son variables CSS. Componentes consumen tokens, no copias de hex.

El archivo de referencia es una base preparada, no un tema aplicado a una app inexistente. Mantener alias semánticos: fondo, superficie, texto, borde, acción, peligro, éxito y series de gráfico.

Los gráficos deben leer los tokens del tema, no duplicar una paleta en TypeScript. Probar que cambiar el token afecta el gráfico.

## Tarjetas según contenido

- Resumen operativo: cifra, unidad, alcance temporal y enlace a consulta verificable.
- Comparación: campo/planta o rendimiento esperado/obtenido con diferencia explícita.
- Estado: tarea pendiente y acción concreta; no inventar alertas.
- Perfil: identidad, contexto y acceso a historial.
- Analítica: gráfico con título descriptivo, leyenda y tabla/alternativa textual.
- Sin métricas disponibles: tabla y filtros útiles, no números ficticios.

No añadir porcentajes de crecimiento sin dos períodos comparables. Ausencia de cálculo es “Aún no disponible”, no cero.

## Interacciones

Tablas con encabezados claros, alineación numérica y acciones distinguibles. Formularios con etiquetas permanentes, ayuda breve, errores por campo y resumen de error cuando corresponda. Confirmar acciones de desactivación y liquidación con el objeto concreto y consecuencia; no hacer preguntas redundantes para simples consultas.

Diálogos con foco inicial, trampa de foco, Escape cuando es seguro y devolución de foco. Formularios con cambios pendientes avisan al salir. No ocultar errores tras cerrar automáticamente un diálogo.

## Gráficos autorizados por contrato

1. Ventas por canal del panel: global, todo el histórico; no zona ni semana.
2. Acopio por proveedor de una fecha y zona: agregar listado completo filtrado, indicando litros originales.
3. Campo vs planta: detalle de recepción con diferencia y estado.
4. Rendimiento del lote: obtenido vs esperado; indicador del backend basado en unidades/litros.
5. Componentes de score: calidad/regularidad/anomalías y período.
6. Pronóstico semanal: valor de la última proyección; no inventar serie diaria.

No hay gráfico GPS de recorrido hasta exponer un GET real. El mapa de rutas del HTML es ilustrativo: puede sustituirse por secuencia visual de paradas.

## Accesibilidad y revisión

Objetivo WCAG AA en contraste y navegación. No depender del color como único significado. Reducir movimiento cuando el sistema lo solicite. Tamaños táctiles adecuados, foco visible, zoom al 200%, nombres largos y errores extensos.

Revisar al menos 360, 768 y 1440 px. En pantallas pequeñas, menú utilizable y tablas con desplazamiento controlado o presentación alternativa. Revisar con datos vacíos, pocos y abundantes. Guardar evidencia real de capturas si el entorno permite navegador; nunca afirmar revisión visual solo por leer CSS.

