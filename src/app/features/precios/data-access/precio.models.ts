/**
 * Fuente: docs/CONTRATOS.md, PrecioLitroRequest.java / PrecioLitroResponse.java.
 * Sin editar ni eliminar (docs/ALCANCE.md): cada registro abre una vigencia
 * nueva; el histórico se conserva completo.
 */
export interface PrecioLitroRequest {
  precio: number;
  vigenteDesde: string;
}

export interface PrecioLitroResponse {
  id: string;
  precio: number;
  vigenteDesde: string;
}
