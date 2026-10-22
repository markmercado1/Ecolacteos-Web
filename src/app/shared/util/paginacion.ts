import { HttpParams } from '@angular/common/http';
import { PaginaResponse } from '../models/pagina-response';

/** Mismo tamaño por defecto que usan ventas-page, proveedores-page, etc. El backend acota size a 1..100. */
export const TAMANO_PAGINA_POR_DEFECTO = 20;

/** Tamaños de página que ofrece el selector «Filas» de las tablas. */
export const TAMANOS_PAGINA = [10, 20, 50];

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

/** Rango de filas que muestra una página: «21–40 de 87». Sin resultados: desde = hasta = 0. */
export function rangoMostrado(pagina: number, tamano: number, totalElementos: number): { desde: number; hasta: number } {
  if (totalElementos <= 0 || tamano <= 0) return { desde: 0, hasta: 0 };
  const desde = pagina * tamano + 1;
  return { desde: Math.min(desde, totalElementos), hasta: Math.min(desde + tamano - 1, totalElementos) };
}

/**
 * Números de página que se dibujan en el paginador: siempre la primera y la última, la actual con `vecinas` a cada
 * lado, y `null` donde hay un salto (se dibuja «…»). Páginas base 0. Con pocas páginas se muestran todas.
 * Ej.: pagina 5 de 12 → [0, null, 4, 5, 6, null, 11].
 */
export function ventanaPaginas(pagina: number, totalPaginas: number, vecinas = 1): (number | null)[] {
  if (totalPaginas <= 0) return [];
  if (totalPaginas <= 2 * vecinas + 5) return Array.from({ length: totalPaginas }, (_, i) => i);
  const actual = Math.min(Math.max(pagina, 0), totalPaginas - 1);
  const desde = Math.max(actual - vecinas, 1);
  const hasta = Math.min(actual + vecinas, totalPaginas - 2);
  const paginas: (number | null)[] = [0];
  if (desde > 1) paginas.push(desde === 2 ? 1 : null);
  for (let p = desde; p <= hasta; p++) paginas.push(p);
  if (hasta < totalPaginas - 2) paginas.push(hasta === totalPaginas - 3 ? totalPaginas - 2 : null);
  paginas.push(totalPaginas - 1);
  return paginas;
}
