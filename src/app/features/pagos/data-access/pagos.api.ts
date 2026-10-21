import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import { FiltroPagina, paramsDePagina } from '../../../shared/util/paginacion';
import {
  AjustePagoResponse, AjustePrecioPagoRequest, AjustePrecioPagoResponse, GenerarPagoRequest, PagoResponse
} from './pago.models';

/**
 * Fuente: docs/ENDPOINTS.md, PagoController.java. Generar, marcar
 * comprobante y liquidar ajustes son solo ADMIN; el resto (listar, detalle,
 * ajustes de un pago) también lo puede leer RECEPCION.
 */
@Injectable({ providedIn: 'root' })
export class PagosApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Paginado en el servidor (semanaInicio desc, desempate por id). */
  listar(filtro: FiltroPagina): Observable<PaginaResponse<PagoResponse>> {
    return this.http.get<PaginaResponse<PagoResponse>>(`${this.baseUrl}/pagos`, { params: paramsDePagina(filtro) });
  }

  /**
   * Variante paginada del historial de un proveedor. GET /pagos/proveedor/{id} (lista completa) sigue
   * existiendo para la app móvil; la web usa siempre /paginado.
   */
  historialPorProveedor(proveedorId: string, filtro: FiltroPagina): Observable<PaginaResponse<PagoResponse>> {
    return this.http.get<PaginaResponse<PagoResponse>>(`${this.baseUrl}/pagos/proveedor/${proveedorId}/paginado`, {
      params: paramsDePagina(filtro)
    });
  }

  obtener(id: string): Observable<PagoResponse> {
    return this.http.get<PagoResponse>(`${this.baseUrl}/pagos/${id}`);
  }

  generar(datos: GenerarPagoRequest): Observable<PagoResponse> {
    return this.http.post<PagoResponse>(`${this.baseUrl}/pagos/generar`, datos);
  }

  marcarComprobante(id: string): Observable<PagoResponse> {
    return this.http.patch<PagoResponse>(`${this.baseUrl}/pagos/${id}/comprobante`, {});
  }

  ajustesDePago(id: string): Observable<AjustePagoResponse[]> {
    return this.http.get<AjustePagoResponse[]>(`${this.baseUrl}/pagos/${id}/ajustes`);
  }

  /** ADMIN. Cambia el precio por litro SOLO de este pago; el pago original no se modifica (queda en el historial). */
  ajustarPrecio(id: string, datos: AjustePrecioPagoRequest): Observable<AjustePrecioPagoResponse> {
    return this.http.post<AjustePrecioPagoResponse>(`${this.baseUrl}/pagos/${id}/ajuste-precio`, datos);
  }

  /** ADMIN y RECEPCION. Historial de cambios de precio del pago, más reciente primero. */
  ajustesDePrecio(id: string): Observable<AjustePrecioPagoResponse[]> {
    return this.http.get<AjustePrecioPagoResponse[]>(`${this.baseUrl}/pagos/${id}/ajustes-precio`);
  }

  /**
   * ADMIN y RECEPCION. Boleta de pago en PDF. Se pide como blob (con el token de la sesión) porque un enlace directo
   * no puede enviar la cabecera Authorization.
   */
  boleta(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/pagos/${id}/boleta`, { responseType: 'blob' });
  }

  ajustesPendientes(proveedorId: string): Observable<AjustePagoResponse[]> {
    const params = new HttpParams().set('proveedorId', proveedorId);
    return this.http.get<AjustePagoResponse[]>(`${this.baseUrl}/pagos/ajustes/pendientes`, { params });
  }

  liquidarAjuste(id: string): Observable<AjustePagoResponse> {
    return this.http.patch<AjustePagoResponse>(`${this.baseUrl}/pagos/ajustes/${id}/liquidar`, {});
  }
}
