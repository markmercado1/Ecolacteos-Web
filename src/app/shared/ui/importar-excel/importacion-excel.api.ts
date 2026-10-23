import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ArchivoExportado, conMensajeLegible, nombreDeContentDisposition } from '../exportar-excel/exportacion-excel.api';
import { ResultadoImportacion, TipoImportacion, VistaPreviaImportacion } from './importacion-excel.models';

/**
 * Importación de datos maestros desde Excel, en dos pasos (solo ADMIN; el backend lo valida):
 * `previsualizar` valida el archivo SIN guardar nada y `confirmar` crea las filas válidas que se vieron.
 */
@Injectable({ providedIn: 'root' })
export class ImportacionExcelApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/importaciones`;

  plantilla(tipo: TipoImportacion): Observable<ArchivoExportado> {
    return this.descargar(`${this.baseUrl}/${tipo}/plantilla`, `plantilla-${tipo}.xlsx`);
  }

  previsualizar(tipo: TipoImportacion, archivo: File): Observable<VistaPreviaImportacion> {
    const formulario = new FormData();
    formulario.append('archivo', archivo, archivo.name);
    return this.http.post<VistaPreviaImportacion>(`${this.baseUrl}/${tipo}/previsualizar`, formulario);
  }

  confirmar(id: string): Observable<ResultadoImportacion> {
    return this.http.post<ResultadoImportacion>(`${this.baseUrl}/${encodeURIComponent(id)}/confirmar`, {});
  }

  /** Filas que NO se importaron (inválidas, duplicadas, omitidas) con su número de fila y motivo. */
  reporte(id: string): Observable<ArchivoExportado> {
    return this.descargar(`${this.baseUrl}/${encodeURIComponent(id)}/reporte`, 'reporte-importacion.xlsx');
  }

  cancelar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  private descargar(url: string, respaldo: string): Observable<ArchivoExportado> {
    return this.http.get(url, { responseType: 'blob', observe: 'response' }).pipe(
      map((respuesta) => ({
        blob: respuesta.body as Blob,
        nombre: nombreDeContentDisposition(respuesta.headers.get('Content-Disposition'), respaldo)
      })),
      catchError((error) => conMensajeLegible(error))
    );
  }
}
