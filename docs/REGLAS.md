# Reglas compartidas del proyecto

## Objetivo y alcance

Construir un panel Angular completo dentro del alcance acordado: acceso, administración, ventas simples, supervisión y gráficos sustentados por datos reales. La captura de acopio, GPS y recepción continúa en el móvil. Las zonas permanecen libres. No añadir inventario, facturación, cuentas por cobrar o asignación restrictiva de zonas por inferencia.

“Completo” significa cumplir docs/FASES.md y docs/VALIDACION.md con evidencia; no significa prometer ausencia absoluta de defectos.

## Jerarquía de fuentes

1. Instrucción vigente del usuario.
2. Código canónico del backend: controladores, seguridad, DTOs, servicios, repositorios y esquema.
3. Decisiones documentadas de producto.
4. Código móvil para entender comportamiento existente.
5. HTML de referencia para intención visual.
6. Instantáneas de contratos y documentación histórica.

Si discrepan, inspecciona el código actual y registra la diferencia. Nunca cambies una fuente para que coincida silenciosamente con una suposición. No uses una segunda copia del backend.

## Antes de editar

- Lee ESTADO y la fase activa. Comprueba si el código ya satisface partes del trabajo.
- Si hay repositorio Git, ejecuta git status --short y examina los diffs pertinentes. Si no existe, no inventes un estado limpio ni borres archivos para inicializarlo.
- Conserva trabajo sin confirmar. Prohibidos reset --hard, clean, reemplazos globales o restauraciones que descarten cambios ajenos al objetivo.
- Comprueba instrucciones AGENTS.md de las carpetas que vayas a modificar.
- Anota en ESTADO la fase/tarea que comienzas. Si ya dice EN_CURSO, revisa archivos y registro antes de asumir abandono.
- No delegues ni lances tareas de desarrollo en paralelo de forma automática.

## Implementación

- Completa una fase por sesión salvo alcance explícito más amplio. Puede requerir varias sesiones.
- No reescribas módulos terminados por preferencia personal ni cambies librerías sin necesidad registrada.
- No simules respuestas de éxito, KPIs, ventas, usuarios o gráficas en producción. Fixtures solo en pruebas o demostración identificada.
- No envíes DTO de respuesta como request. Usa nombres y nullabilidad reales.
- No calcules total global desde una página paginada. No conviertas 401/403/404/500 en listas vacías.
- No falsifiques funciones ausentes: documenta BACKEND NECESARIO con necesidad, contrato actual, cambio mínimo y dependencias.
- No ejecutes operaciones mutantes sobre producción para probar. Usa datos y servidor de desarrollo autorizados.
- No guardes secretos, cuentas reales o valores de tokens en código, archivos de progreso, capturas o logs.
- Instala dependencias cuando sean necesarias, elige versiones compatibles y fija lockfile. No copies un número de versión de memoria.
- Sigue docs/DISENO.md: tokens centrales, accesibilidad y estados completos.
- Las instrucciones de estos archivos no conceden permisos de sistema. Solicita el permiso técnico específico solo cuando haga falta.

## Backend

La ampliación limitada de ficha de acopiador está condicionada por docs/DECISIONES.md. No hay autorización general para rediseñar el backend, romper el móvil o implantar todas las propuestas del análisis. Si se cambia un contrato, actualiza documentación y pruebas del backend, compatibilidad del móvil y consumidores web afectados. No edites las dos copias.

## Continuidad

Mantén:
- ESTADO: situación breve y vigente, siguiente acción concreta.
- REGISTRO: entradas acumulativas con cambios, comandos y resultados.
- DECISIONES: nuevas decisiones con fundamento y efecto.
- ENDPOINTS/CONTRATOS: cambios de API realmente implementados, separando propuestas.

No registres una prueba como aprobada si no la ejecutaste. Diferencia inspección estática, prueba automatizada, integración HTTP y revisión visual.

Una sesión interrumpida no invalida cambios útiles. Retoma verificando el árbol y el último registro. Los documentos reducen ambigüedad, pero no son un bloqueo técnico: si los mismos archivos cambian durante tu trabajo, vuelve a leerlos y reconcilia antes de guardar.

## Cierre

1. Ejecuta comprobaciones proporcionales al cambio y revisa el diff.
2. Actualiza REGISTRO con fecha real, fase, archivos, comandos, resultados y limitaciones.
3. Actualiza ESTADO: completado, parcial o bloqueado, más siguiente tarea.
4. Solo marca COMPLETA una fase si todos sus criterios están comprobados.
5. Entrega un resumen breve sin afirmar despliegue, pruebas o integración no realizados.

