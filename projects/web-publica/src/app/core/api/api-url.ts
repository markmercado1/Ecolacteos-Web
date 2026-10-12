import { environment } from '../../../environments/environment';

/** URL absoluta (o del mismo origen) de un endpoint público: `/catalogo/productos` → `{origen}/api/catalogo/productos`. */
export function apiUrl(ruta: string): string {
  return `${environment.apiOrigin}/api${ruta}`;
}

/**
 * Las fotos llegan como ruta relativa del backend (`/api/catalogo/fotos/xyz.jpg`). Se resuelven contra el origen de la
 * API; una URL ya absoluta se respeta; sin foto devuelve null.
 */
export function urlFoto(fotoUrl: string | null | undefined): string | null {
  if (!fotoUrl) return null;
  return /^https?:\/\//i.test(fotoUrl) ? fotoUrl : `${environment.apiOrigin}${fotoUrl}`;
}
