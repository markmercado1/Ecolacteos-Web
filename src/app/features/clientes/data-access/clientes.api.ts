import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import {
  AvisoPrivacidadResponse,
  ClienteRequest,
  ClienteResponse,
  ClienteUpdateRequest,
  CoincidenciasRequest,
  ComercialRequest,
  CompradorSugerencia,
  CompraResponse,
  ConsentimientoResponse,
  FusionResponse,
  HistorialClienteResponse
} from './cliente.models';

export interface FiltroClientes {
  busqueda?: string;
  activo?: boolean;
  mayorista?: boolean;
  conComunicaciones?: boolean;
  page: number;
  size: number;
}

/** Fuente: docs/ENDPOINTS.md, ClienteController.java y CompradorController.java (Fase H). */
@Injectable({ providedIn: 'root' })
export class ClientesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listar(filtro: FiltroClientes): Observable<PaginaResponse<ClienteResponse>> {
    let params = new HttpParams().set('page', filtro.page).set('size', filtro.size);
    if (filtro.busqueda?.trim()) params = params.set('busqueda', filtro.busqueda.trim());
    if (filtro.activo !== undefined) params = params.set('activo', filtro.activo);
    if (filtro.mayorista !== undefined) params = params.set('mayorista', filtro.mayorista);
    if (filtro.conComunicaciones !== undefined) params = params.set('conComunicaciones', filtro.conComunicaciones);
    return this.http.get<PaginaResponse<ClienteResponse>>(`${this.baseUrl}/clientes`, { params });
  }

  obtener(id: string): Observable<ClienteResponse> {
    return this.http.get<ClienteResponse>(`${this.baseUrl}/clientes/${id}`);
  }

  registrar(datos: ClienteRequest): Observable<ClienteResponse> {
    return this.http.post<ClienteResponse>(`${this.baseUrl}/clientes`, datos);
  }

  actualizar(id: string, datos: ClienteUpdateRequest): Observable<ClienteResponse> {
    return this.http.put<ClienteResponse>(`${this.baseUrl}/clientes/${id}`, datos);
  }

  agregarTelefono(id: string, telefono: string): Observable<ClienteResponse> {
    return this.http.post<ClienteResponse>(`${this.baseUrl}/clientes/${id}/telefonos`, { telefono });
  }

  cambiarMayorista(id: string, mayorista: boolean, motivo: string): Observable<ClienteResponse> {
    return this.http.put<ClienteResponse>(`${this.baseUrl}/clientes/${id}/mayorista`, { mayorista, motivo });
  }

  /** Habilita o quita a un cliente para un tipo de precio con regla CLIENTE_HABILITADO (solo ADMIN, con motivo). */
  cambiarHabilitacion(id: string, codigo: string, habilitado: boolean, motivo: string): Observable<ClienteResponse> {
    return this.http.put<ClienteResponse>(`${this.baseUrl}/clientes/${id}/tipos-precio/${codigo}`, { habilitado, motivo });
  }

  desactivar(id: string): Observable<ClienteResponse> {
    return this.http.put<ClienteResponse>(`${this.baseUrl}/clientes/${id}/desactivar`, {});
  }

  reactivar(id: string): Observable<ClienteResponse> {
    return this.http.put<ClienteResponse>(`${this.baseUrl}/clientes/${id}/reactivar`, {});
  }

  comunicaciones(id: string, datos: ComercialRequest): Observable<ClienteResponse> {
    return this.http.post<ClienteResponse>(`${this.baseUrl}/clientes/${id}/comunicaciones`, datos);
  }

  consentimientos(id: string): Observable<ConsentimientoResponse[]> {
    return this.http.get<ConsentimientoResponse[]>(`${this.baseUrl}/clientes/${id}/consentimientos`);
  }

  historial(id: string): Observable<HistorialClienteResponse> {
    return this.http.get<HistorialClienteResponse>(`${this.baseUrl}/clientes/${id}/historial`);
  }

  compras(id: string, page: number, size: number): Observable<PaginaResponse<CompraResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PaginaResponse<CompraResponse>>(`${this.baseUrl}/clientes/${id}/compras`, { params });
  }

  fusionar(origenId: string, destinoId: string, motivo: string): Observable<FusionResponse> {
    return this.http.post<FusionResponse>(`${this.baseUrl}/clientes/${origenId}/fusionar`, { destinoId, motivo });
  }

  /** POST para no dejar teléfono ni documento en la URL. */
  sugerencias(criterio: CoincidenciasRequest): Observable<CompradorSugerencia[]> {
    return this.http.post<CompradorSugerencia[]>(`${this.baseUrl}/compradores/sugerencias`, criterio);
  }

  avisos(): Observable<AvisoPrivacidadResponse> {
    return this.http.get<AvisoPrivacidadResponse>(`${this.baseUrl}/catalogo/privacidad`);
  }
}
