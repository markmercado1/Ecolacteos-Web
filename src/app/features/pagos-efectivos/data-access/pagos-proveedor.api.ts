import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import { FiltroPagina, paramsDePagina } from '../../../shared/util/paginacion';
import {
  AplicacionPagoRequest, EstadoPagoProveedor, PagoProveedorRequest, PagoProveedorResponse, SaldoPagoResponse, SaldoProveedorResponse
} from './pago-proveedor.models';

export interface FiltroPagosProveedor extends FiltroPagina {
  proveedorId?: string;
  estado?: EstadoPagoProveedor | '';
  busqueda?: string;
}

/**
 * Fuente: docs/ENDPOINTS.md, PagoProveedorController.java. ADMIN y RECEPCION registran, aplican y consultan; anular es solo ADMIN.
 * Ninguna respuesta trae DNI ni teléfono del proveedor.
 */
@Injectable({ providedIn: 'root' })
export class PagosProveedorApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/pagos-proveedor`;

  /** 201 al crearlo, 200 si era un reenvío (mismo uuidCliente o misma operación con los mismos datos): en ambos casos devuelve el pago. */
  registrar(datos: PagoProveedorRequest): Observable<PagoProveedorResponse> {
    return this.http.post<PagoProveedorResponse>(this.baseUrl, datos);
  }

  listar(filtro: FiltroPagosProveedor): Observable<PaginaResponse<PagoProveedorResponse>> {
    let params = paramsDePagina(filtro);
    if (filtro.proveedorId) params = params.set('proveedorId', filtro.proveedorId);
    if (filtro.estado) params = params.set('estado', filtro.estado);
    const busqueda = filtro.busqueda?.trim();
    if (busqueda) params = params.set('busqueda', busqueda);
    return this.http.get<PaginaResponse<PagoProveedorResponse>>(this.baseUrl, { params });
  }

  obtener(id: string): Observable<PagoProveedorResponse> {
    return this.http.get<PagoProveedorResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  aplicar(id: string, aplicaciones: AplicacionPagoRequest[]): Observable<PagoProveedorResponse> {
    return this.http.post<PagoProveedorResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/aplicaciones`, { aplicaciones });
  }

  /** Solo ADMIN. Conserva la fila; el motivo es obligatorio. */
  anular(id: string, motivo: string): Observable<PagoProveedorResponse> {
    return this.http.post<PagoProveedorResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/anular`, { motivo });
  }

  /** Saldos derivados de hasta 100 liquidaciones (en el orden pedido). */
  saldos(pagoIds: string[]): Observable<SaldoPagoResponse[]> {
    return this.http.get<SaldoPagoResponse[]>(`${this.baseUrl}/saldos`, { params: new HttpParams().set('pagoIds', pagoIds.join(',')) });
  }

  saldoDelProveedor(proveedorId: string): Observable<SaldoProveedorResponse> {
    return this.http.get<SaldoProveedorResponse>(`${this.baseUrl}/proveedor/${encodeURIComponent(proveedorId)}/saldo`);
  }
}
