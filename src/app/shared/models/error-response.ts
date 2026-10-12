/** Forma estándar de error de la API. Fuente: docs/CONTRATOS.md, ErrorResponse.java. */
export interface ErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  mensaje: string;
}
