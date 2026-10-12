/** Fuente: docs/CONTRATOS.md, RutaItemRequest.java / DefinirRutaZonaRequest.java. */
export interface RutaItemRequest {
  proveedorId: string;
  orden: number;
  horaEstimada: string | null;
}

export interface DefinirRutaZonaRequest {
  items: RutaItemRequest[];
}

/** Fuente: docs/CONTRATOS.md, RutaProveedorOrdenResponse.java. */
export interface RutaProveedorOrdenResponse {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  orden: number;
  horaEstimada: string | null;
}
