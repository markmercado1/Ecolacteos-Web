import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import { FiltroPagina, paramsDePagina } from '../../../shared/util/paginacion';
import { HistorialEntregaResponse, HistorialResumenResponse } from './historial.models';

/** Fuente: docs/ENDPOINTS.md, HistorialProveedorController.java. ADMIN, RECEPCION y CALIDAD; cada rol recibe solo sus secciones. */
@Injectable({ providedIn: 'root' })
export class HistorialApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  resumen(proveedorId: string): Observable<HistorialResumenResponse> {
    return this.http.get<HistorialResumenResponse>(`${this.baseUrl}/proveedores/${encodeURIComponent(proveedorId)}/historial/resumen`);
  }

  entregas(proveedorId: string, filtro: FiltroPagina): Observable<PaginaResponse<HistorialEntregaResponse>> {
    return this.http.get<PaginaResponse<HistorialEntregaResponse>>(
      `${this.baseUrl}/proveedores/${encodeURIComponent(proveedorId)}/historial/entregas`, { params: paramsDePagina(filtro) });
  }
}
