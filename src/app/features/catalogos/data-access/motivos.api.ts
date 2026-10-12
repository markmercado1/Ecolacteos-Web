import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { MotivoObservacionRequest, MotivoObservacionResponse } from './motivo.models';

/** Fuente: docs/ENDPOINTS.md, AdminCatalogosController.java. */
@Injectable({ providedIn: 'root' })
export class MotivosApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listar(): Observable<MotivoObservacionResponse[]> {
    return this.http.get<MotivoObservacionResponse[]>(`${this.baseUrl}/admin/motivos-observacion`);
  }

  crear(datos: MotivoObservacionRequest): Observable<MotivoObservacionResponse> {
    return this.http.post<MotivoObservacionResponse>(`${this.baseUrl}/admin/motivos-observacion`, datos);
  }

  actualizar(id: string, datos: MotivoObservacionRequest): Observable<MotivoObservacionResponse> {
    return this.http.put<MotivoObservacionResponse>(`${this.baseUrl}/admin/motivos-observacion/${id}`, datos);
  }

  desactivar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/motivos-observacion/${id}`);
  }

  reactivar(id: string): Observable<MotivoObservacionResponse> {
    return this.http.patch<MotivoObservacionResponse>(`${this.baseUrl}/admin/motivos-observacion/${id}/reactivar`, {});
  }
}
