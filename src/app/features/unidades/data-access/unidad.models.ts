/** Fuente: docs/CONTRATOS.md, UnidadRequest.java / UnidadResponse.java. */
export interface UnidadRequest {
  placa: string;
  capacidadTon: number | null;
  zonaId: string | null;
  responsableId: string;
}

export interface UnidadResponse {
  id: string;
  placa: string;
  capacidadTon: number | null;
  zonaId: string | null;
  responsableId: string;
  responsableNombre: string;
}
