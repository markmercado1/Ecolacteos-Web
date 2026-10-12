import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import {
  HistorialZonaResponse,
  ProveedorAdminResponse,
  ProveedorPublicoResponse,
  ProveedorRequest,
  ProveedorUpdateRequest
} from './proveedor.models';

export interface FiltroProveedores {
  zonaId?: string;
  activo?: boolean;
  /** Nombre o DNI; se busca en todo el padrón en el servidor, antes de paginar. */
  busqueda?: string;
  page: number;
  size: number;
}

/** Fuente: docs/ENDPOINTS.md, ProveedorController.java. */
@Injectable({ providedIn: 'root' })
export class ProveedoresApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listar(filtro: FiltroProveedores): Observable<PaginaResponse<ProveedorAdminResponse>> {
    let params = new HttpParams().set('page', filtro.page).set('size', filtro.size);
    if (filtro.zonaId) params = params.set('zonaId', filtro.zonaId);
    if (filtro.activo !== undefined) params = params.set('activo', filtro.activo);
    const busqueda = filtro.busqueda?.trim();
    if (busqueda) params = params.set('busqueda', busqueda);
    return this.http.get<PaginaResponse<ProveedorAdminResponse>>(`${this.baseUrl}/proveedores`, { params });
  }

  obtener(id: string): Observable<ProveedorAdminResponse> {
    return this.http.get<ProveedorAdminResponse>(`${this.baseUrl}/proveedores/${id}`);
  }

  /** Accesible también a ACOPIADOR/RECEPCION/CALIDAD; usado por Rutas para poblar paradas por zona. */
  listarOperativo(): Observable<ProveedorPublicoResponse[]> {
    return this.http.get<ProveedorPublicoResponse[]>(`${this.baseUrl}/proveedores/operativo`);
  }

  obtenerPorCodigoQr(codigoQr: string): Observable<ProveedorPublicoResponse> {
    return this.http.get<ProveedorPublicoResponse>(`${this.baseUrl}/proveedores/qr/${encodeURIComponent(codigoQr)}`);
  }

  crear(datos: ProveedorRequest): Observable<ProveedorAdminResponse> {
    return this.http.post<ProveedorAdminResponse>(`${this.baseUrl}/proveedores`, datos);
  }

  actualizar(id: string, datos: ProveedorUpdateRequest): Observable<ProveedorAdminResponse> {
    return this.http.put<ProveedorAdminResponse>(`${this.baseUrl}/proveedores/${id}`, datos);
  }

  desactivar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/proveedores/${id}`);
  }

  reactivar(id: string): Observable<ProveedorAdminResponse> {
    return this.http.patch<ProveedorAdminResponse>(`${this.baseUrl}/proveedores/${id}/reactivar`, {});
  }

  historialZona(id: string): Observable<HistorialZonaResponse[]> {
    return this.http.get<HistorialZonaResponse[]>(`${this.baseUrl}/proveedores/${id}/historial-zona`);
  }

  reasignarZona(id: string, zonaId: string): Observable<ProveedorAdminResponse> {
    const params = new HttpParams().set('zonaId', zonaId);
    return this.http.put<ProveedorAdminResponse>(`${this.baseUrl}/proveedores/${id}/zona`, null, { params });
  }
}
