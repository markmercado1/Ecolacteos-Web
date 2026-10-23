import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';

/** Filtros de la tabla tal como los recibe el backend; los valores vacíos no se envían. */
export type FiltroExportacion = Record<string, string | number | boolean | null | undefined>;

export interface ArchivoExportado {
  blob: Blob;
  nombre: string;
}

/**
 * Nombre de archivo sugerido por el servidor (Content-Disposition, con soporte de `filename*=UTF-8''…`); si no llega o no
 * es utilizable, `respaldo`. Nunca deja pasar rutas: solo el nombre final.
 */
export function nombreDeContentDisposition(cabecera: string | null, respaldo: string): string {
  if (!cabecera) return respaldo;
  const extendido = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cabecera);
  const simple = /filename\s*=\s*"?([^";]+)"?/i.exec(cabecera);
  const crudo = extendido?.[1] ?? simple?.[1];
  if (!crudo) return respaldo;
  let nombre = crudo.trim();
  try {
    nombre = extendido ? decodeURIComponent(nombre) : nombre;
  } catch {
    return respaldo;
  }
  nombre = nombre.split(/[\\/]/).pop() ?? '';
  return nombre.length > 0 ? nombre : respaldo;
}

/** Los errores de una descarga llegan como Blob: se lee el JSON del servidor para conservar su mensaje. */
export function conMensajeLegible(error: unknown): Observable<never> {
  if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) {
    return throwError(() => error);
  }
  return from(error.error.text()).pipe(
    map((texto) => {
      try {
        return JSON.parse(texto) as unknown;
      } catch {
        return undefined;
      }
    }),
    switchMap((cuerpo) =>
      throwError(
        () =>
          new HttpErrorResponse({
            error: cuerpo,
            status: error.status,
            statusText: error.statusText,
            url: error.url ?? undefined,
            headers: error.headers
          })
      )
    )
  );
}

/** Descarga de tablas en Excel: `GET /exportaciones/{recurso}` con los mismos filtros y búsqueda de la pantalla. */
@Injectable({ providedIn: 'root' })
export class ExportacionExcelApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  descargar(recurso: string, filtro: FiltroExportacion = {}, nombreRespaldo = 'exportacion.xlsx'): Observable<ArchivoExportado> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor === null || valor === undefined) continue;
      const texto = String(valor).trim();
      if (texto !== '') params = params.set(clave, texto);
    }
    return this.http
      .get(`${this.baseUrl}/exportaciones/${recurso}`, { params, responseType: 'blob', observe: 'response' })
      .pipe(
        map((respuesta) => ({
          blob: respuesta.body as Blob,
          nombre: nombreDeContentDisposition(respuesta.headers.get('Content-Disposition'), nombreRespaldo)
        })),
        catchError((error) => conMensajeLegible(error))
      );
  }
}
