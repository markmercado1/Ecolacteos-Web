/** Fuente: docs/CONTRATOS.md, ZonaRequest.java / ZonaResponse.java. */
export interface ZonaRequest {
  nombre: string;
}

export interface ZonaResponse {
  id: string;
  nombre: string;
  activa: boolean;
}
