import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdjuntoResponse, TrazabilidadResponse } from './trazabilidad.models';

/**
 * Fuente: backend controller/TrazabilidadController.java. Consulta: PRODUCCION, CALIDAD o ADMIN; adjuntar un recibo: PRODUCCION o ADMIN.
 * Imágenes JPG/PNG/WEBP o PDF, máximo 10 MB (el servidor valida el tipo por el contenido).
 */
@Injectable({ providedIn: 'root' })
export class TrazabilidadApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  buscar(q: string): Observable<TrazabilidadResponse> {
    return this.http.get<TrazabilidadResponse>(`${this.baseUrl}/inventario/trazabilidad/lotes`, { params: new HttpParams().set('q', q) });
  }

  adjuntar(documentoId: string, archivo: File): Observable<AdjuntoResponse> {
    const datos = new FormData();
    datos.append('file', archivo, archivo.name);
    return this.http.post<AdjuntoResponse>(`${this.baseUrl}/inventario/ingresos/${encodeURIComponent(documentoId)}/adjuntos`, datos);
  }

  /** El contenido requiere autenticación: se baja como archivo y el navegador lo muestra con una dirección temporal. */
  contenido(adjuntoId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/adjuntos/${encodeURIComponent(adjuntoId)}/contenido`, { responseType: 'blob' });
  }
}

/** Tamaño máximo de un adjunto (10 MB) y tipos aceptados, para avisar antes de subir. */
export const ADJUNTO_MAX_BYTES = 10 * 1024 * 1024;
export const ADJUNTO_ACEPTA = 'image/jpeg,image/png,image/webp,application/pdf';

/** Mensaje si el archivo no se puede adjuntar (null si está bien). */
export function problemaDeAdjunto(f: File): string | null {
  if (f.size === 0) return `«${f.name}» está vacío.`;
  if (f.size > ADJUNTO_MAX_BYTES) return `«${f.name}» supera el máximo de 10 MB.`;
  if (!ADJUNTO_ACEPTA.split(',').includes(f.type)) return `«${f.name}» no es una imagen JPG, PNG o WEBP ni un PDF.`;
  return null;
}
