/**
 * Minúsculas y sin acentos, para comparar texto como lo hace la búsqueda del servidor (BusquedaTexto del backend:
 * «contiene», sin distinguir mayúsculas ni acentos; la ñ se compara como n). Se usa en las listas que se buscan en el
 * cliente porque ya traen todo su conjunto (catálogos, unidades, bandeja de jornadas).
 */
export function normalizarTexto(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** ¿`texto` contiene `termino`, sin distinguir mayúsculas ni acentos? Un término vacío coincide con todo. */
export function contieneTexto(texto: string | null | undefined, termino: string): boolean {
  const buscado = normalizarTexto(termino);
  return buscado === '' || normalizarTexto(texto).includes(buscado);
}
