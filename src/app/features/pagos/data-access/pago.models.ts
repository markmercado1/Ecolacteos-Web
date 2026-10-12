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
  precioLitro: number;
  total: number;
  comprobanteGenerado: boolean;
  registroAcopioIds: string[];
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
