import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ZonaRequest, ZonaResponse } from './zona.models';

/**
 * Fuente: docs/ENDPOINTS.md, AdminCatalogosController.java (gestión completa,
 * ADMIN) y ZonaController.java (`/api/zonas/operativo`, lectura para roles
 * operativos como ACOPIADOR). Las zonas siguen libres: este servicio no
 * agrega asignación restrictiva alguna (docs/DECISIONES.md).
 */
@Injectable({ providedIn: 'root' })
export class ZonasApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listarAdmin(): Observable<ZonaResponse[]> {
    return this.http.get<ZonaResponse[]>(`${this.baseUrl}/admin/zonas`);
  }

  /** Lectura para roles no-ADMIN (p. ej. ACOPIADOR en el módulo de Rutas). */
  listarOperativo(): Observable<ZonaResponse[]> {
    return this.http.get<ZonaResponse[]>(`${this.baseUrl}/zonas/operativo`);
  }

  crear(datos: ZonaRequest): Observable<ZonaResponse> {
    return this.http.post<ZonaResponse>(`${this.baseUrl}/admin/zonas`, datos);
  }

  actualizar(id: string, datos: ZonaRequest): Observable<ZonaResponse> {
    return this.http.put<ZonaResponse>(`${this.baseUrl}/admin/zonas/${id}`, datos);
  }

  desactivar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/zonas/${id}`);
  }

  reactivar(id: string): Observable<ZonaResponse> {
    return this.http.patch<ZonaResponse>(`${this.baseUrl}/admin/zonas/${id}/reactivar`, {});
  }
}
