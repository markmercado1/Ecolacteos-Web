import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DefinirRutaZonaRequest, RutaProveedorOrdenResponse } from './ruta.models';

/**
 * Fuente: docs/ENDPOINTS.md, RutaProveedorController.java. PUT reemplaza la
 * ruta completa de la zona (no hay "agregar una parada" parcial en el
 * backend) y rechaza una lista vacía (@NotEmpty en DefinirRutaZonaRequest).
 */
@Injectable({ providedIn: 'root' })
export class RutasApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listar(zonaId: string): Observable<RutaProveedorOrdenResponse[]> {
    return this.http.get<RutaProveedorOrdenResponse[]>(`${this.baseUrl}/zonas/${zonaId}/ruta`);
  }

  definir(zonaId: string, datos: DefinirRutaZonaRequest): Observable<RutaProveedorOrdenResponse[]> {
    return this.http.put<RutaProveedorOrdenResponse[]>(`${this.baseUrl}/zonas/${zonaId}/ruta`, datos);
  }
}
