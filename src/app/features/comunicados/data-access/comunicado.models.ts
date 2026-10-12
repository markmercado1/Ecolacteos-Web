/** Fuente: docs/CONTRATOS.md, CrearComunicadoRequest.java / ComunicadoResponse.java. */
export interface CrearComunicadoRequest {
  mensaje: string;
  zonaIds: string[];
}

export interface ComunicadoResponse {
  id: string;
  mensaje: string;
  fecha: string;
  zonasNombres: string[];
}

/** Fuente: docs/CONTRATOS.md, ComunicadoConfirmacionResponse.java. */
export interface ComunicadoConfirmacionResponse {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  acopiadorId: string;
  acopiadorNombre: string;
  confirmadoEn: string;
}
