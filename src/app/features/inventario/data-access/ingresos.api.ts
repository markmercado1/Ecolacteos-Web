import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DocumentoIngresoResponse, IngresoDocumentoRequest } from './ingresos.models';

/** Fuente: backend controller/IngresoDocumentoController.java. PRODUCCION o ADMIN. */
@Injectable({ providedIn: 'root' })
export class IngresosApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/inventario/ingresos`;

  /** Todo o nada: cada línea crea un lote y deja su movimiento INGRESO en el kardex. */
  registrar(datos: IngresoDocumentoRequest): Observable<DocumentoIngresoResponse> {
    return this.http.post<DocumentoIngresoResponse>(this.baseUrl, datos);
  }

  obtener(id: string): Observable<DocumentoIngresoResponse> {
    return this.http.get<DocumentoIngresoResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }
}
