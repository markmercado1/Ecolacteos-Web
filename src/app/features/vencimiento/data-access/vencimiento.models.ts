/**
 * Fase 2 (control de vencimiento). Fuente: docs/CONTRATOS.md "2026-10-11", ControlVencimientoController.java y
 * sus DTOs. Todo es solo web; el contrato del móvil no cambia.
 */

/** GET /control-vencimiento/productos (PRODUCCION, VENTAS, ADMIN). */
export interface ProductosConControlResponse {
  productoIds: string[];
}

/** PUT/DELETE /admin/productos/{id}/control-vencimiento (ADMIN). */
export interface ControlVencimientoResponse {
  productoId: string;
  controlaVencimiento: boolean;
  presentaciones: { presentacionId: string; nombre: string; saldoSinTrazabilidadInicial: number | null }[];
}

/**
 * POST /admin/presentaciones/{id}/regularizaciones (ADMIN). Reclasifica `cantidad` unidades del saldo "sin
 * trazabilidad" a un lote con la fecha de vencimiento de la etiqueta. No escribe en el libro ni en el kardex.
 * `motivo` es obligatorio (máx. 300). Una fecha pasada es válida: las unidades quedan como vencidas.
 */
export interface RegularizacionRequest {
  cantidad: number;
  fechaVencimiento: string;
  motivo: string;
}

export interface RegularizacionResponse {
  id: string;
  presentacionId: string;
  cantidad: number;
  fechaVencimiento: string;
  vencido: boolean;
  motivo: string;
  creadoEn: string;
  sinTrazabilidadRestante: number;
}
