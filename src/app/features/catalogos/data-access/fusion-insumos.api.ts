import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DuplicadosInsumoResponse, FusionInsumoResponse, VistaPreviaFusion } from './fusion-insumos.models';

/** Fuente: backend controller/FusionInsumoController.java. Solo ADMIN. */
@Injectable({ providedIn: 'root' })
export class FusionInsumosApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/insumos`;

  duplicados(): Observable<DuplicadosInsumoResponse> {
    return this.http.get<DuplicadosInsumoResponse>(`${this.baseUrl}/duplicados`);
  }

  vistaPrevia(origenId: string, destinoId: string): Observable<VistaPreviaFusion> {
    const params = new HttpParams().set('origenId', origenId).set('destinoId', destinoId);
    return this.http.get<VistaPreviaFusion>(`${this.baseUrl}/fusion/vista-previa`, { params });
  }

  /** `origenId` se absorbe en `destinoId`: el origen queda inactivo y su historial pasa al destino. */
  fusionar(origenId: string, destinoId: string): Observable<FusionInsumoResponse> {
    return this.http.post<FusionInsumoResponse>(`${this.baseUrl}/fusion`, { origenId, destinoId });
  }

  historial(): Observable<FusionInsumoResponse[]> {
    return this.http.get<FusionInsumoResponse[]>(`${this.baseUrl}/fusiones`);
  }
}
