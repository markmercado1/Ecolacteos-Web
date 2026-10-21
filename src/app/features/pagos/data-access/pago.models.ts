/** Fuente: docs/CONTRATOS.md, GenerarPagoRequest.java / PagoResponse.java. */
export interface GenerarPagoRequest {
  proveedorId: string;
  semanaInicio: string;
  semanaFin: string;
}

export interface PagoResponse {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  semanaInicio: string;
  semanaFin: string;
  litrosTotales: number;
  /** Precio del pago ORIGINAL (inmutable). */
  precioLitro: number;
  /** Total del pago ORIGINAL (inmutable). */
  total: number;
  comprobanteGenerado: boolean;
  registroAcopioIds: string[];
  /** Precio por litro vigente para ESTE pago: el del ajuste de precio más reciente, o `precioLitro` si no hay ajustes. */
  precioLitroEfectivo: number;
  /** Lo que realmente se paga: litrosTotales × precioLitroEfectivo (ya incluye el ajuste de precio). */
  totalAPagar: number;
}

/** ¿Este pago tiene un precio ajustado respecto al original? */
export function pagoAjustado(pago: Pick<PagoResponse, 'precioLitro' | 'precioLitroEfectivo'>): boolean {
  return pago.precioLitroEfectivo !== pago.precioLitro;
}

/**
 * Total de un pago a un precio dado, con el MISMO redondeo que el servidor (PagoService.calcularTotal: half-up a
 * céntimos). Aritmética entera para no arrastrar errores de coma flotante (p. ej. 123 × 1.255 = 154.365 → 154.37).
 * Solo para la vista previa: el total oficial siempre lo devuelve el servidor.
 */
export function totalDePago(litros: number, precioLitro: number): number {
  const centilitros = Math.round(litros * 100);
  const milesimas = Math.round(precioLitro * 1000);
  return Math.floor((centilitros * milesimas + 500) / 1000) / 100;
}

/** Fuente: AjustePrecioPagoRequest.java. El motivo es obligatorio (auditoría); el precio, entre 0.001 y 999.999. */
export interface AjustePrecioPagoRequest {
  precioLitroNuevo: number;
  motivo: string;
}

/** Fuente: AjustePrecioPagoResponse.java. Una fila del historial de cambios de precio de un pago. */
export interface AjustePrecioPagoResponse {
  id: string;
  pagoId: string;
  precioLitroAnterior: number;
  precioLitroNuevo: number;
  totalAnterior: number;
  totalNuevo: number;
  motivo: string;
  usuarioNombre: string;
  creadoEn: string;
}

/** Fuente: docs/CONTRATOS.md, AjustePagoResponse.java. */
export interface AjustePagoResponse {
  id: string;
  pagoId: string;
  registroAcopioId: string;
  correccionRegistroId: string;
  litrosDiferencia: number;
  precioLitro: number;
  monto: number;
  estado: string;
  creadoEn: string;
}
