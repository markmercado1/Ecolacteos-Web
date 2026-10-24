# Fase E — Reportes por zona histórica: comparación antes y después

Fecha: 2026-10-23. **Mismos datos, dos versiones del backend.** Los datos son una **copia** de la base de desarrollo (`dev_e_cmp`, derivada de la copia ya migrada a V29; la base real `acopio_lechero` no se tocó).
Se levantó el backend de `integration/7-fases` **antes** del cambio (Fase D) y el de la rama `feature/reportes-zona-historica` **después**, ambos contra esa misma copia, y se consultaron los mismos endpoints para cada zona.

## Qué cambió y por qué

Antes, todo reporte «por zona» agrupaba una entrega según la **zona actual del proveedor** (`proveedor.zona_actual_id`): al cambiar un proveedor de zona, toda su historia pasaba a la zona nueva.
Desde la Fase A cada entrega guarda la zona que tenía el proveedor **cuando entregó** (`registro_acopio.zona_id`). La Fase E hace que los reportes usen esa zona. Efectos esperados:

1. Un proveedor que cambió de zona **deja de arrastrar** su historia a la zona nueva: sus entregas anteriores se quedan en la zona de entonces.
2. Una entrega **sin zona determinada** (`zona_id` nulo: 3 en estos datos, los casos de revisión de la Fase A) **no aparece en ninguna zona**. No se rellena con la zona actual ni se repara: sigue visible sin filtro de zona y en «Revisión de zonas».
3. Sin filtro de zona **nada cambia**: el total es el mismo (3 276 entregas).

Alcance del cambio (consultas): listado y paginado de acopios por zona, resumen por proveedor, exportación a Excel de acopios, alertas por zona, litros en alerta, % de rechazo por semana, y las bases del forecasting (litros por rango, promedio histórico, promedio por mes y suma semanal).
**No cambia** el score de confianza por zona (`ScoreConfianzaProveedorRepository`): es una propiedad del proveedor, no de una entrega, y se mide con su zona actual. Tampoco el filtro de proveedores por zona (es un estado actual).

## Resultado por zona (endpoints reales)

| Zona | Entregas antes | Entregas después | Δ entregas | Litros antes | Litros después | Δ litros | Alertas (30 d) antes → después |
|---|---:|---:|---:|---:|---:|---:|---|
| Bambamarca | 689 | 692 | +3 | 36,700.00 | 38,655.94 | +1,955.94 | 4 → 4 |
| Chugur | 728 | 833 | +105 | 39,840.13 | 46,809.71 | +6,969.58 | 3 → 3 |
| Hualgayoc | 718 | 718 | 0 | 59,790.56 | 59,790.56 | 0.00 | 11 → 11 |
| La EncaÃ±ada | 546 | 546 | 0 | 33,241.21 | 33,241.21 | 0.00 | 0 → 0 |
| Sorochuco | 397 | 478 | +81 | 39,484.37 | 42,438.93 | +2,954.56 | 5 → 5 |
| Zona Prueba | 195 | 3 | -192 | 12,764.94 | 706.00 | -12,058.94 | 2 → 2 |
| Zona Test Movil | 3 | 3 | 0 | 223.00 | 223.00 | 0.00 | 0 → 0 |
| Zona Test Movil 2 | 0 | 0 | 0 | 0.00 | 0.00 | 0.00 | 0 → 0 |
| **Suma de zonas** | **3,276** | **3,273** | **-3** | **222,044.21** | **221,865.35** | **-178.86** | |
| Sin filtro de zona | 3,276 | 3,276 | 0 | | | | |

La suma de zonas pasa de 3,276 a 3,273: la diferencia (3) son exactamente las entregas sin zona determinada, que ya no se atribuyen a ninguna.

## Causa de cada diferencia

Entregas cuya zona de entonces **no** coincide con la zona actual de su proveedor (es lo que se movió entre zonas):

| Zona actual del proveedor (antes se contaban aquí) | Zona de la entrega (ahora se cuentan aquí) | Entregas | Litros |
|---|---|---:|---:|
| Bambamarca | (sin zona: no se cuenta en ninguna) | 1 | 53.15 |
| Bambamarca | Chugur | 51 | 2,241.19 |
| Bambamarca | Sorochuco | 42 | 2,244.55 |
| Chugur | (sin zona: no se cuenta en ninguna) | 1 | 25.71 |
| Chugur | Sorochuco | 39 | 710.01 |
| Zona Prueba | (sin zona: no se cuenta en ninguna) | 1 | 100.00 |
| Zona Prueba | Bambamarca | 97 | 6,494.83 |
| Zona Prueba | Chugur | 94 | 5,464.11 |

Por proveedor (los nombres son datos de la base de desarrollo; los caracteres como «Ã³» ya vienen así guardados —texto doblemente codificado en esos datos de prueba— y no los causó este cambio ni se corrigieron):

| Proveedor | Zona actual | Zona de la entrega | Entregas | Litros | Desde | Hasta |
|---|---|---|---:|---:|---|---|
| AbsalÃ³n Ortiz Ramos | Bambamarca | (sin zona) | 1 | 53.15 | 2026-07-20 | 2026-07-20 |
| AbsalÃ³n Ortiz Ramos | Bambamarca | Chugur | 51 | 2,241.19 | 2026-07-21 | 2026-09-16 |
| AbsalÃ³n Ortiz Ramos | Bambamarca | Sorochuco | 42 | 2,244.55 | 2026-06-08 | 2026-07-19 |
| Alejandro Terrones HuamÃ¡n | Zona Prueba | (sin zona) | 1 | 100.00 | 2026-09-30 | 2026-09-30 |
| Alejandro Terrones HuamÃ¡n | Zona Prueba | Bambamarca | 97 | 6,494.83 | 2026-06-08 | 2026-09-25 |
| AnÃ­bal NÃºÃ±ez Saucedo | Zona Prueba | Chugur | 94 | 5,464.11 | 2026-06-10 | 2026-09-23 |
| Irma Quiroz HuamÃ¡n | Chugur | (sin zona) | 1 | 25.71 | 2026-07-20 | 2026-07-20 |
| Irma Quiroz HuamÃ¡n | Chugur | Sorochuco | 39 | 710.01 | 2026-06-08 | 2026-07-19 |

Lectura: cada fila del primer cuadro explica un movimiento de la tabla por zona (p. ej. las entregas que los proveedores que hoy están en «Zona Prueba» hicieron cuando estaban en Bambamarca o Chugur pasan de contarse en Zona Prueba a contarse en la zona de entonces). Las entregas sin zona son los 3 casos de día de cambio de la Fase A; **no se repararon**.

## Otros reportes sobre los mismos datos

- **Análisis de calidad (porcentaje de rechazo por semana):** 192 de 2,146 análisis pertenecen a entregas cuya zona de entonces no es la actual de su proveedor; sus semanas se cuentan ahora en la zona de entonces.
- **Panel económico (`/api/innovacion/panel-economico`):** sus campos salieron **idénticos** en estas zonas porque el forecast que muestra es una predicción ya guardada, los litros en riesgo dependen de alertas de los últimos 30 días (sin diferencias) y la regresión del rechazo no tiene datos suficientes (`null`). Las bases del forecasting que se recalculen a futuro sí usarán la zona de cada entrega.
- **Promedio histórico de litros por entrega (base del forecasting):**

| Zona | Antes | Después |
|---|---:|---:|
| Bambamarca | 53.27 | 55.86 |
| Chugur | 54.73 | 56.19 |
| Hualgayoc | 83.27 | 83.27 |
| La EncaÃ±ada | 60.88 | 60.88 |
| Sorochuco | 99.46 | 88.78 |
| Tongod | 0.00 | 0.00 |
| Zona Prueba | 65.46 | 235.33 |
| Zona Test Movil | 74.33 | 74.33 |
| Zona Test Movil 2 | 0.00 | 0.00 |

## Qué debe esperar quien use los reportes

- Las cifras **históricas** por zona cambian de forma permanente y se vuelven coherentes con la zona en la que se entregó la leche; las de zonas cuyos proveedores nunca se movieron no cambian (Hualgayoc, La Encañada, Zona Test Movil).
- Las entregas sin zona determinada **no suman en ninguna zona** hasta que una persona decida su zona fuera de este cambio (pantalla «Revisión de zonas», solo lectura). Mientras tanto la suma de las zonas es menor que el total sin filtro, y es esperado.
- Los contratos de la API no cambian (ni campos ni rutas): solo cambia qué entregas coinciden con el parámetro `zonaId` ya existente. Sin filtro de zona la respuesta es exactamente la misma.
