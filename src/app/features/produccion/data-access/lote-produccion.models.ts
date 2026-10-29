/**
 * Fuente: docs/CONTRATOS.md, CrearLoteRequest.java (refactor de Producción, fase 2/backend). Ya NO se
 * acompaña de `registroAcopioIds`: el backend decide automáticamente de qué recepciones de planta viene la
 * leche (FIFO sobre el saldo remanente, más antiguas primero) -- el cliente solo indica cuánta leche usar.
 * `litrosUsados` es estrictamente mayor que 0.
 *
 * Fase 3 (Producción con varias presentaciones de salida): un lote corresponde a UN producto elaborado pero
 * puede generar VARIAS presentaciones de salida -- `detalles` reemplaza al antiguo `unidadesObtenidas`
 * único. `detalles` puede ser una lista VACÍA: representa una producción real que consumió leche pero no
 * obtuvo ningún rendimiento aprovechable (lote fallido/perdido, caso ya existente) -- nunca una línea de
 * cantidad cero. Idempotente por `uuidCliente`: reenviar el mismo valor nunca duplica; reenviar el mismo
 * uuidCliente con datos DISTINTOS es un conflicto explícito (409), no una corrección silenciosa.
 */
export interface DetalleSalidaRequest {
  presentacionId: string;
  cantidadObtenida: number;
}

export interface CrearLoteRequest {
  motivoRendimiento?: string | null;
  uuidCliente: string;
  fecha: string;
  productoId: string;
  litrosUsados: number;
  detalles: DetalleSalidaRequest[];
  /** Insumos usados (cuajo, sal…). Opcional: vacío = lote sin insumos del catálogo, se registra igual. */
  insumos?: InsumoLoteRequest[];
}

/** Fuente: backend InsumoUsadoRequest.java / InsumoUsadoResponse.java (mismo DTO que el informe diario). */
export interface InsumoLoteRequest {
  insumoId: string;
  cantidad: number;
}

/** Un lote de insumo del que salió lo consumido por un lote de producción (trazabilidad hacia atrás). */
export interface LoteInsumoUsado {
  loteId: string;
  codigo: string;
  codigoProveedor: string | null;
  proveedorNombre: string | null;
  fechaVencimiento: string | null;
  cantidad: number;
}

export interface InsumoLoteResponse {
  insumoId: string;
  insumoNombre: string;
  unidadMedida: string;
  cantidad: number;
  /** Lotes de insumo de los que salió (FEFO), en el orden del kardex; vacío si aún no consumió. Opcional por compatibilidad. */
  lotes?: LoteInsumoUsado[];
}

/**
 * Fuente: docs/CONTRATOS.md, RecepcionConsumidaResponse.java. Una fila del desglose FIFO real de un lote
 * creado bajo el nuevo modelo: de qué RecepcionPlanta puntual salieron cuántos litros. Vacío para lotes
 * creados antes del refactor (ver `LoteProduccion.registroAcopioIds`, que sigue siendo su trazabilidad real).
 */
export interface RecepcionConsumida {
  recepcionPlantaId: string;
  litrosConsumidos: number;
}

/**
 * Fuente: docs/CONTRATOS.md, DetalleSalidaResponse.java. Una fila ya registrada de la sección
 * "Presentaciones obtenidas" de un lote. contenidoCantidad/contenidoUnidad/unidadConteo vienen
 * denormalizados desde Presentación para mostrar "20 x Botella 2 L" sin una llamada aparte al catálogo.
 */
export interface DetalleSalidaResponse {
  presentacionId: string;
  presentacionNombre: string;
  contenidoCantidad: number | null;
  contenidoUnidad: string | null;
  unidadConteo: string;
  cantidadObtenida: number;
}

/**
 * Fuente: docs/CONTRATOS.md, LoteProduccionResponse.java.
 */
export interface LoteProduccion {
  motivoRendimiento?: string | null;
  revisionRendimiento?: string | null;
  id: string;
  fecha: string;
  productoId: string;
  productoNombre: string;
  litrosUsados: number;
  /**
   * Fase 3: una fila por presentación obtenida. Lista vacía = producción sin ningún rendimiento
   * aprovechable (consumió leche, no generó salidas) -- distinto de "Sin cálculo configurado" de
   * `rendimientoPct`, que es sobre la FÓRMULA, no sobre si hubo o no producto obtenido.
   */
  detalles: DetalleSalidaResponse[];
  /**
   * Histórico preservado tal cual para lotes anteriores a esta fase. Para lotes nuevos, solo se calcula
   * cuando hay exactamente una salida hacia una presentación SIN contenido declarado (shape "Unidad"/
   * "Pieza") y el producto tiene rendimiento esperado configurado -- `null` en cualquier otro caso
   * ("Sin cálculo configurado"; nunca se mezclan tamaños distintos en un mismo indicador).
   */
  rendimientoPct: number | null;
  /**
   * Rendimiento esperado ACTUAL del producto (catálogo) -- puede diferir de rendimientoEsperadoPctSnapshot
   * si el catálogo cambió después de producir este lote. `null` para productos de una familia sin
   * rendimiento configurado (no es exclusivo de queso).
   */
  rendimientoEsperadoPct: number | null;
  /**
   * Trazabilidad de lotes creados ANTES del refactor de fase 2 (vínculo directo a registros de acopio).
   * Vacío para lotes nuevos, que usan `recepcionesConsumidas` en su lugar -- no se reinterpreta el historial.
   */
  registroAcopioIds: string[];
  /**
   * Unidades esperadas = litrosUsados × rendimientoEsperadoPctSnapshot / 100, calculado y congelado por el
   * backend al momento de producir. `null` cuando `rendimientoPct` también es null (misma regla).
   */
  unidadesEsperadas: number | null;
  /**
   * Snapshot del rendimiento esperado del producto AL MOMENTO de producir este lote (no se reescribe si el
   * catálogo cambia después). `null` en lotes creados antes de este refactor -- para esos, usar
   * `rendimientoEsperadoPct` (el valor actual del catálogo) como única referencia disponible.
   */
  rendimientoEsperadoPctSnapshot: number | null;
  /**
   * Trazabilidad de lotes creados DESDE el refactor de fase 2 -- desglose FIFO real de qué RecepcionPlanta
   * aportó cuántos litros. Vacío para lotes anteriores (ver `registroAcopioIds`).
   */
  recepcionesConsumidas: RecepcionConsumida[];
  /**
   * Insumos del lote. En un lote PLANIFICADA son los PLANIFICADOS (escalados desde la receta, aún no
   * descontados); desde EN_PRODUCCION, los efectivamente consumidos. Vacío si no se registró ninguno.
   */
  insumos?: InsumoLoteResponse[];

  // --- V18 (recetas): producción planificada vs. real. Campos aditivos del backend. ---
  // Opcionales en el tipo solo para no romper respuestas de un backend anterior a V18: ausente = FINALIZADA
  // (ver estadoDe()).
  /** Los lotes de un solo paso (app móvil, registro manual, históricos) son FINALIZADA desde su creación. */
  estado?: EstadoLote;
  recetaId?: string | null;
  recetaNombre?: string | null;
  /** Salida ESPERADA (snapshot al planificar). Nunca es lo producido: eso son `detalles`. */
  cantidadEsperada?: number | null;
  presentacionEsperadaId?: string | null;
  presentacionEsperadaNombre?: string | null;
  /** Solo FINALIZADA con receta: obtenido en la presentación de la receta − esperado (negativo = faltó). */
  diferencia?: number | null;
  iniciadoEn?: string | null;
  finalizadoEn?: string | null;
  canceladoEn?: string | null;
}

export function estadoDe(lote: LoteProduccion): EstadoLote {
  return lote.estado ?? 'FINALIZADA';
}

/** Total realmente obtenido (todas las presentaciones). 0 si no hubo salidas o aún no se finalizó. */
export function totalObtenido(lote: LoteProduccion): number {
  return lote.detalles.reduce((total, d) => total + d.cantidadObtenida, 0);
}

export type EstadoLote = 'PLANIFICADA' | 'EN_PRODUCCION' | 'FINALIZADA' | 'CANCELADA';

export const ETIQUETA_ESTADO_LOTE: Record<EstadoLote, string> = {
  PLANIFICADA: 'Planificada',
  EN_PRODUCCION: 'En producción',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada'
};

/** Fuente: backend dto/PlanificarLoteRequest.java. Idempotente por uuidCliente (mismo criterio que crear). */
export interface PlanificarLoteRequest {
  uuidCliente: string;
  fecha: string;
  recetaId: string;
  litros: number;
}

/**
 * Fuente: backend dto/FinalizarLoteRequest.java. Resultado REAL: `detalles` vacío = nada aprovechable. La
 * leche e insumos utilizados son los consumidos al iniciar; no se envían aquí.
 */
export interface FinalizarLoteRequest {
  detalles: DetalleSalidaRequest[];
  motivoRendimiento?: string | null;
  /**
   * Fase 1/2 (solo web): fecha de vencimiento de CADA salida, escrita por una persona (nunca calculada). Obligatoria
   * para un producto que controla vencimiento; un producto sin control NO debe enviarla (el backend la rechaza).
   */
  vencimientos?: VencimientoSalidaRequest[];
}

/** Fuente: backend dto/VencimientoSalidaRequest.java. */
export interface VencimientoSalidaRequest {
  presentacionId: string;
  /** yyyy-MM-dd; último día en que se puede vender; no anterior a la fecha del lote. */
  fechaVencimiento: string;
}
