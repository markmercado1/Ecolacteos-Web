/** Fuente: docs/CONTRATOS.md, AnalisisBandejaResponse.java. Agrupa el último análisis por entrega del día. */
export interface AnalisisBandeja {
  registroAcopioId: string;
  proveedorId: string;
  proveedorNombre: string;
  fechaHora: string;
  litros: number;
  resultado: string;
}

/** Fuente: docs/CONTRATOS.md, AnalisisCalidadResponse.java. */
export interface AnalisisCalidad {
  id: string;
  registroAcopioId: string;
  folioMuestra: string;
  agua: number | null;
  proteina: number | null;
  lactosa: number | null;
  densidad: number | null;
  temperatura: number | null;
  ph: number | null;
  aguaAnadida: boolean | null;
  resultado: string;
  creadoEn: string;
}

/** Fuente: docs/CONTRATOS.md, AlertaAnomaliaResponse.java. tipo: VOLUMEN_ATIPICO | RIESGO_ADULTERACION. */
export interface AlertaAnomalia {
  id: string;
  registroAcopioId: string;
  proveedorId: string;
  proveedorNombre: string;
  tipo: string;
  zScore: number | null;
  severidad: string;
  creadoEn: string;
}

/** Fuente: docs/CONTRATOS.md, ScoreConfianzaResponse.java. Ausencia de cálculo = 404, no 0 (docs/ALCANCE.md). */
export interface ScoreConfianza {
  proveedorId: string;
  periodo: string;
  score: number;
  componenteCalidad: number;
  componenteRegularidad: number;
  componenteAnomalias: number;
}

/** Fuente: docs/CONTRATOS.md, PrediccionProveedorResponse.java. Ausencia de cálculo = 404, no 0. */
export interface PrediccionProveedor {
  proveedorId: string;
  fechaPrevista: string;
  litrosEstimadosMin: number;
  litrosEstimadosMax: number;
}

/**
 * Fuente: docs/CONTRATOS.md, PrediccionZonaResponse.java. Es la ÚLTIMA proyección semanal ya calculada
 * (ForecastingService.obtenerUltima): no genera una nueva en cada consulta. `litrosReales` es `null`
 * mientras la semana proyectada no haya cerrado todavía (ForecastingService.cerrarSemanaAnterior).
 */
export interface PrediccionZona {
  zonaId: string;
  semanaInicio: string;
  litrosEstimados: number;
  litrosReales: number | null;
  recomendacionMezcla: string;
  flujoCajaProyectado: number;
  alertaCapacidad: boolean;
}

/**
 * Fuente: docs/CONTRATOS.md, PanelEconomicoResponse.java (InnovacionController, GET /api/innovacion/panel-economico?zonaId=).
 * `margenPorCanal` es GLOBAL de toda la planta (VentaRepository.margenAgrupadoPorTipoCliente no filtra por
 * zona ni fecha): es el mismo valor sin importar qué zona se consulte — nunca sumar entre zonas.
 * `pctRechazoSiScoreSube10` es `null` cuando no hay histórico suficiente para la regresión (simulación sin
 * resultado, no 0%). Ver PanelEconomicoService.construirPanel: si la zona no tiene proyección semanal
 * calculada todavía, todo el endpoint responde 404 (ForecastingService.obtenerUltima sin capturar) —
 * limitación real del backend, documentada como BACKEND NECESARIO en docs/REGISTRO.md.
 */
export interface PanelEconomico {
  zonaId: string;
  litrosEnRiesgoValorizados: number;
  forecastSemana: PrediccionZona;
  margenPorCanal: { tipoCliente: string; totalVentas: number }[];
  pctRechazoSiScoreSube10: number | null;
}
