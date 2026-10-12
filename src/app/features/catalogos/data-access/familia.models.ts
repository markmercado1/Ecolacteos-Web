/** Fuente: docs/CONTRATOS.md, FamiliaRequest.java / FamiliaResponse.java (Fase 1: Producto + Presentación). */
export interface FamiliaRequest {
  nombre: string;
}

export interface FamiliaResponse {
  id: string;
  nombre: string;
  activo: boolean;
}
