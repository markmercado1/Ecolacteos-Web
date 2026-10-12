import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { UnidadRequest, UnidadResponse } from './unidad.models';

/**
 * Fuente: docs/ENDPOINTS.md, AdminCatalogosController.java. No hay DELETE,
 * GET individual ni bandera "activo" para unidades (docs/ALCANCE.md, mapa de
 * módulos): esta API solo expone lo que el backend soporta.
 */
@Injectable({ providedIn: 'root' })
export class UnidadesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listar(): Observable<UnidadResponse[]> {
    return this.http.get<UnidadResponse[]>(`${this.baseUrl}/admin/unidades`);
  }

  /** Accesible también a ACOPIADOR/RECEPCION/CALIDAD (p. ej. para resolver placas en Recepción). */
  listarOperativo(): Observable<UnidadResponse[]> {
    return this.http.get<UnidadResponse[]>(`${this.baseUrl}/unidades/operativo`);
  }

  crear(datos: UnidadRequest): Observable<UnidadResponse> {
    return this.http.post<UnidadResponse>(`${this.baseUrl}/admin/unidades`, datos);
  }

  actualizar(id: string, datos: UnidadRequest): Observable<UnidadResponse> {
    return this.http.put<UnidadResponse>(`${this.baseUrl}/admin/unidades/${id}`, datos);
  }
}
