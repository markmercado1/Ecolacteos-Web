/** Fuente: docs/CONTRATOS.md, ProveedorRequest.java. Alta: zona opcional. */
export interface ProveedorRequest {
  nombre: string;
  dni: string;
  telefono: string | null;
  zonaActualId: string | null;
}

/**
 * Fuente: docs/CONTRATOS.md, ProveedorUpdateRequest.java. No incluye zona:
 * el PUT de datos no la cambia (docs/ALCANCE.md); para eso existe
 * PUT /api/proveedores/{id}/zona.
 */
export interface ProveedorUpdateRequest {
  nombre: string;
  dni: string;
  telefono: string | null;
}

/** Fuente: docs/CONTRATOS.md, ProveedorAdminResponse.java. */
export interface ProveedorAdminResponse {
  id: string;
  nombre: string;
  dni: string;
  telefono: string | null;
  zonaActualId: string | null;
  zonaActualNombre: string | null;
  codigoQr: string;
  activo: boolean;
}

/** Fuente: docs/CONTRATOS.md, ProveedorPublicoResponse.java (usado por el lookup de QR). */
export interface ProveedorPublicoResponse {
  id: string;
  nombre: string;
  zonaActualId: string | null;
  zonaActualNombre: string | null;
  codigoQr: string;
}

/** Fuente: docs/CONTRATOS.md, HistorialZonaResponse.java. */
export interface HistorialZonaResponse {
  id: string;
  zonaId: string;
  zonaNombre: string;
  desde: string;
  hasta: string | null;
}
