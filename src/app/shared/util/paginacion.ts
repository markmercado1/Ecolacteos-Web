import { HttpParams } from '@angular/common/http';
import { PaginaResponse } from '../models/pagina-response';

/** Mismo tamaño por defecto que usan ventas-page, proveedores-page, etc. El backend acota size a 1..100. */
export const TAMANO_PAGINA_POR_DEFECTO = 20;

export interface FiltroPagina {
  page: number;
  size: number;
}

/** HttpParams con page/size ya puestos, para que cada *.api.ts solo agregue sus filtros. */
export function paramsDePagina(filtro: FiltroPagina): HttpParams {
  return new HttpParams().set('page', filtro.page).set('size', filtro.size);
}

/**
 * Si la página pedida quedó fuera de rango (p. ej. se desactivó el último registro de la última página con
 * un filtro de estado activo, o el total bajó entre dos consultas), devuelve la última página válida para
 * volver a pedirla. Devuelve null si la respuesta es válida o si ya no hay resultados (página 0 vacía:
 * se muestra el estado vacío, no se reintenta).
 */
export function paginaCorregida<T>(respuesta: PaginaResponse<T>): number | null {
  const fueraDeRango =
    respuesta.contenido.length === 0 && respuesta.paginaActual > 0 && respuesta.paginaActual >= respuesta.totalPaginas;
  if (!fueraDeRango) return null;
  return Math.max(respuesta.totalPaginas - 1, 0);
}

/** Texto de pie estándar: "Página 2 de 5 · 87 pagos". */
export function textoPie(pagina: number, totalPaginas: number, totalElementos: number, unidad: string): string {
  return `Página ${pagina + 1} de ${totalPaginas || 1} · ${totalElementos} ${unidad}`;
}
