import { HttpErrorResponse } from '@angular/common/http';
import { mapHttpError } from '../../../core/http/app-error';
import { PanelEconomico } from '../../calidad/data-access/calidad.models';

export type EstadoZonaPanel = 'ok' | 'sinProyeccion' | 'error';

/** Resultado de pedir el panel económico de UNA zona (el backend no tiene un endpoint consolidado). */
export interface ResultadoZonaPanel {
  zona: { id: string; nombre: string };
  estado: EstadoZonaPanel;
  panel: PanelEconomico | null;
  /** Mensaje de error real (solo si estado === 'error'). */
  mensaje: string | null;
}

export interface ConsolidadoPanel {
  zonasTotales: number;
  zonasConDatos: number;
  zonasSinProyeccion: number;
  zonasConError: number;
  /** Suma de `litrosEnRiesgoValorizados` de las zonas con datos (últimos 30 días). */
  riesgoValorizadoTotal: number;
  /** Suma de los litros estimados de la última proyección semanal de cada zona con datos. */
  litrosEstimadosTotal: number;
  flujoCajaTotal: number;
  zonasConAlertaCapacidad: number;
  /** Semanas distintas de las proyecciones usadas (ordenadas). Más de una = no son de la misma semana. */
  semanas: string[];
  /** Ventas por canal: el backend las da GLOBALES de toda la planta (iguales en cada zona), se toman una sola vez. */
  margenPorCanal: { tipoCliente: string; totalVentas: number }[];
}

/**
 * Clasifica el error de `GET /api/innovacion/panel-economico` igual que la vista de una zona: SOLO un 404 cuyo mensaje
 * indica falta de proyección es «sin proyección» (limitación del backend: ese 404 oculta también el resto de datos de la
 * zona); cualquier otro fallo es un error real y nunca se disfraza de «sin proyección».
 */
export function clasificarErrorPanel(e: unknown): { estado: 'sinProyeccion' | 'error'; mensaje: string | null } {
  const mensaje = e instanceof HttpErrorResponse ? (e.error?.mensaje as string | undefined) : undefined;
  if (e instanceof HttpErrorResponse && e.status === 404 && mensaje?.toLowerCase().includes('prediccion')) {
    return { estado: 'sinProyeccion', mensaje: null };
  }
  return { estado: 'error', mensaje: mapHttpError(e).mensaje };
}

/** Suma en céntimos (enteros) para no arrastrar errores de coma flotante al total. */
function sumar(valores: number[]): number {
  return valores.reduce((acumulado, v) => acumulado + Math.round(v * 100), 0) / 100;
}

/**
 * Consolida las zonas que SÍ devolvieron datos. Las zonas sin proyección o con error no entran en las sumas (no se
 * inventan ceros): `zonasConDatos` de `zonasTotales` dice cuántas se sumaron. El porcentaje de rechazo estimado no se
 * puede sumar entre zonas, por eso no forma parte del consolidado (solo aparece por zona).
 */
export function consolidar(resultados: ResultadoZonaPanel[]): ConsolidadoPanel {
  const conDatos = resultados.filter((r): r is ResultadoZonaPanel & { panel: PanelEconomico } => r.estado === 'ok' && r.panel !== null);
  return {
    zonasTotales: resultados.length,
    zonasConDatos: conDatos.length,
    zonasSinProyeccion: resultados.filter((r) => r.estado === 'sinProyeccion').length,
    zonasConError: resultados.filter((r) => r.estado === 'error').length,
    riesgoValorizadoTotal: sumar(conDatos.map((r) => r.panel.litrosEnRiesgoValorizados)),
    litrosEstimadosTotal: sumar(conDatos.map((r) => r.panel.forecastSemana.litrosEstimados)),
    flujoCajaTotal: sumar(conDatos.map((r) => r.panel.forecastSemana.flujoCajaProyectado)),
    zonasConAlertaCapacidad: conDatos.filter((r) => r.panel.forecastSemana.alertaCapacidad).length,
    semanas: [...new Set(conDatos.map((r) => r.panel.forecastSemana.semanaInicio))].sort(),
    margenPorCanal: conDatos[0]?.panel.margenPorCanal ?? [],
  };
}
