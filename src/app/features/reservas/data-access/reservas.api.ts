import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import { paramsDePagina } from '../../../shared/util/paginacion';
import { VentaResumenResponse } from '../../ventas/data-access/venta.models';
import { AceptacionPrecioRequest, FiltroReservas, ReservaResponse, ReservaResumenResponse } from './reserva.models';

/**
 * Fuente: docs/CONTRATOS.md (Fase 4), ReservaController.java. Roles: ADMIN y VENTAS.
 * El frontend no decide nada: cada acción la valida el servidor (precio, aceptación, cobertura de stock,
 * transición de estado) y su rechazo llega como error con mensaje.
 */
@Injectable({ providedIn: 'root' })
export class ReservasApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/reservas`;

  listar(filtro: FiltroReservas): Observable<PaginaResponse<ReservaResumenResponse>> {
    let params: HttpParams = paramsDePagina(filtro);
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.fechaRetiro) params = params.set('fechaRetiro', filtro.fechaRetiro);
    if (filtro.telefono?.trim()) params = params.set('telefono', filtro.telefono.trim());
    if (filtro.codigo?.trim()) params = params.set('codigo', filtro.codigo.trim());
    if (filtro.busqueda?.trim()) params = params.set('busqueda', filtro.busqueda.trim());
    return this.http.get<PaginaResponse<ReservaResumenResponse>>(this.baseUrl, { params });
  }

  obtener(id: string): Observable<ReservaResponse> {
    return this.http.get<ReservaResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  /** Solo pendiente: vuelve a cotizar todas las líneas con el precio público vigente hoy. */
  recotizar(id: string): Observable<ReservaResponse> {
    return this.http.put<ReservaResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/recotizar`, null);
  }

  /** Constancia de que el cliente aceptó el importe actual (la registra el personal). */
  registrarAceptacion(id: string, datos: AceptacionPrecioRequest): Observable<ReservaResponse> {
    return this.http.post<ReservaResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/aceptacion-precio`, datos);
  }

  /** No crea una venta ni mueve el kardex. El servidor revalida precio, aceptación y cobertura. */
  confirmar(id: string): Observable<ReservaResponse> {
    return this.http.put<ReservaResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/confirmar`, null);
  }

  rechazar(id: string, motivo: string): Observable<ReservaResponse> {
    return this.http.put<ReservaResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/rechazar`, { motivo });
  }

  cancelar(id: string, motivo: string): Observable<ReservaResponse> {
    return this.http.put<ReservaResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/cancelar`, { motivo });
  }

  /**
   * Retiro = venta real por el flujo normal (FEFO, kardex) y reserva RETIRADA en la misma transacción del servidor.
   * `uuidCliente` es la clave de idempotencia de esa venta: reintentar con el mismo valor no duplica nada.
   */
  retirar(id: string, uuidCliente: string): Observable<VentaResumenResponse> {
    return this.http.post<VentaResumenResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/retirar`, { uuidCliente });
  }
}
