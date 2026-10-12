import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ConfiguracionSistemaResponse, ConfiguracionSistemaUpdateRequest } from './configuracion.models';

/**
 * Fuente: docs/ENDPOINTS.md, AdminCatalogosController.java. Las claves son
 * fijas (no hay POST/DELETE): solo se edita el valor de una clave existente.
 */
@Injectable({ providedIn: 'root' })
export class ConfiguracionApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listar(): Observable<ConfiguracionSistemaResponse[]> {
    return this.http.get<ConfiguracionSistemaResponse[]>(`${this.baseUrl}/admin/configuracion`);
  }

  actualizar(clave: string, datos: ConfiguracionSistemaUpdateRequest): Observable<ConfiguracionSistemaResponse> {
    return this.http.put<ConfiguracionSistemaResponse>(
      `${this.baseUrl}/admin/configuracion/${encodeURIComponent(clave)}`,
      datos
    );
  }
}
