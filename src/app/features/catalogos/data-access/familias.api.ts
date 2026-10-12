import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FamiliaRequest, FamiliaResponse } from './familia.models';

/** Fuente: docs/ENDPOINTS.md, AdminCatalogosController.java (bloque "Familias", Fase 1). Solo ADMIN.
 *  Catálogo administrable desde la web: el usuario autorizado crea familias (Queso, Yogurt, Leche,
 *  Mantequilla, Dulce de leche...) sin tocar código ni SQL. */
@Injectable({ providedIn: 'root' })
export class FamiliasApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listar(): Observable<FamiliaResponse[]> {
    return this.http.get<FamiliaResponse[]>(`${this.baseUrl}/admin/familias`);
  }

  crear(datos: FamiliaRequest): Observable<FamiliaResponse> {
    return this.http.post<FamiliaResponse>(`${this.baseUrl}/admin/familias`, datos);
  }

  actualizar(id: string, datos: FamiliaRequest): Observable<FamiliaResponse> {
    return this.http.put<FamiliaResponse>(`${this.baseUrl}/admin/familias/${id}`, datos);
  }

  desactivar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/familias/${id}`);
  }

  reactivar(id: string): Observable<FamiliaResponse> {
    return this.http.patch<FamiliaResponse>(`${this.baseUrl}/admin/familias/${id}/reactivar`, {});
  }
}
