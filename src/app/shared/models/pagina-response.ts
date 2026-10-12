/** Fuente: docs/CONTRATOS.md, PaginaResponse.java. page empieza en 0. */
export interface PaginaResponse<T> {
  contenido: T[];
  paginaActual: number;
  tamanoPagina: number;
  totalElementos: number;
  totalPaginas: number;
}
