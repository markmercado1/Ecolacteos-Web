import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DisponibilidadProduccion, RecetaRequest, RecetaResponse } from './receta.models';

/**
 * Fuente: backend controller/RecetaController.java (V18). Consulta y cálculo: PRODUCCION o ADMIN.
 * Crear/editar/desactivar/reactivar: solo ADMIN (mismo criterio que Productos e Insumos).
 */
@Injectable({ providedIn: 'root' })
export class RecetasApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/recetas`;

  listar(incluirInactivas = false): Observable<RecetaResponse[]> {
    const params = new HttpParams().set('incluirInactivas', incluirInactivas);
    return this.http.get<RecetaResponse[]>(this.baseUrl, { params });
  }

  obtener(id: string): Observable<RecetaResponse> {
    return this.http.get<RecetaResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  /** Vista previa: escala la receta a `litros` y la compara con el stock actual. No modifica nada. */
  calcular(id: string, litros: number): Observable<DisponibilidadProduccion> {
    const params = new HttpParams().set('litros', litros);
    return this.http.get<DisponibilidadProduccion>(`${this.baseUrl}/${encodeURIComponent(id)}/calculo`, { params });
  }

  crear(datos: RecetaRequest): Observable<RecetaResponse> {
    return this.http.post<RecetaResponse>(this.baseUrl, datos);
  }

  actualizar(id: string, datos: RecetaRequest): Observable<RecetaResponse> {
    return this.http.put<RecetaResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`, datos);
  }

  desactivar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  reactivar(id: string): Observable<RecetaResponse> {
    return this.http.patch<RecetaResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/reactivar`, {});
  }
}
