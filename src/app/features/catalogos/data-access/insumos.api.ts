import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { InsumoRequest, InsumoResponse } from './insumo.models';

/** Fuente: backend controller/AdminCatalogosController.java (bloque "--- Insumos ---"). */
@Injectable({ providedIn: 'root' })
export class InsumosApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Solo ADMIN (hasRole('ADMIN')): GET /api/admin/insumos. */
  listar(): Observable<InsumoResponse[]> {
    return this.http.get<InsumoResponse[]>(`${this.baseUrl}/admin/insumos`);
  }

  /**
   * Catálogo para PRODUCCION (sin rol ADMIN): GET /api/sync/cambios, igual criterio que
   * ProductosApi.listarOperativo() -- ya filtra a insumos activos en el servidor.
   */
  listarOperativo(): Observable<InsumoResponse[]> {
    return this.http
      .get<{ insumos: InsumoResponse[] }>(`${this.baseUrl}/sync/cambios`)
      .pipe(map((respuesta) => respuesta.insumos));
  }

  crear(datos: InsumoRequest): Observable<InsumoResponse> {
    return this.http.post<InsumoResponse>(`${this.baseUrl}/admin/insumos`, datos);
  }

  actualizar(id: string, datos: InsumoRequest): Observable<InsumoResponse> {
    return this.http.put<InsumoResponse>(`${this.baseUrl}/admin/insumos/${id}`, datos);
  }

  desactivar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/insumos/${id}`);
  }

  reactivar(id: string): Observable<InsumoResponse> {
    return this.http.patch<InsumoResponse>(`${this.baseUrl}/admin/insumos/${id}/reactivar`, {});
  }
}
