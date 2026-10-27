import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import {
  AfectacionIgvRequest,
  AfectacionIgvResponse,
  AfectacionLoteRequest,
  AfectacionLoteResponse,
  EstadoIgvResponse,
  FilaAfectacionIgvResponse,
  TasaIgvRequest,
  TasaIgvResponse
} from './igv.models';

/** Fuente: docs/ENDPOINTS.md, ConfiguracionIgvController.java. Solo ADMIN. El cálculo se enciende o apaga aquí, con motivo. */
@Injectable({ providedIn: 'root' })
export class IgvApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/tributario`;

  estado(): Observable<EstadoIgvResponse> {
    return this.http.get<EstadoIgvResponse>(`${this.baseUrl}/estado`);
  }

  tasas(): Observable<TasaIgvResponse[]> {
    return this.http.get<TasaIgvResponse[]>(`${this.baseUrl}/tasas-igv`);
  }

  registrarTasa(datos: TasaIgvRequest): Observable<TasaIgvResponse> {
    return this.http.post<TasaIgvResponse>(`${this.baseUrl}/tasas-igv`, datos);
  }

  afectaciones(filtro: { busqueda?: string; page: number; size: number }): Observable<PaginaResponse<FilaAfectacionIgvResponse>> {
    let params = new HttpParams().set('page', filtro.page).set('size', filtro.size);
    const busqueda = filtro.busqueda?.trim();
    if (busqueda) params = params.set('busqueda', busqueda);
    return this.http.get<PaginaResponse<FilaAfectacionIgvResponse>>(`${this.baseUrl}/afectaciones`, { params });
  }

  historialAfectacion(presentacionId: string): Observable<AfectacionIgvResponse[]> {
    return this.http.get<AfectacionIgvResponse[]>(`${this.baseUrl}/presentaciones/${presentacionId}/afectaciones`);
  }

  /** Enciende o apaga el cálculo (solo ADMIN, con motivo). No recalcula ventas ya registradas. Devuelve el estado resultante. */
  cambiarCalculo(habilitado: boolean, motivo: string): Observable<EstadoIgvResponse> {
    return this.http.put<EstadoIgvResponse>(`${this.baseUrl}/calculo`, { habilitado, motivo });
  }

  clasificarEnLote(datos: AfectacionLoteRequest): Observable<AfectacionLoteResponse> {
    return this.http.post<AfectacionLoteResponse>(`${this.baseUrl}/afectaciones/lote`, datos);
  }

  registrarAfectacion(presentacionId: string, datos: AfectacionIgvRequest): Observable<AfectacionIgvResponse> {
    return this.http.post<AfectacionIgvResponse>(`${this.baseUrl}/presentaciones/${presentacionId}/afectaciones`, datos);
  }
}
