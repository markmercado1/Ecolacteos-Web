import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import { FiltroPagina, paramsDePagina } from '../../../shared/util/paginacion';
import { ComunicadoConfirmacionResponse, ComunicadoResponse, CrearComunicadoRequest } from './comunicado.models';

/**
 * Fuente: docs/ENDPOINTS.md, ComunicadoController.java. Confirmar un
 * comunicado (POST .../confirmaciones) es una acción de campo del
 * acopiador (app móvil); esta página web solo publica y consulta, como el
 * resto de acopio/recepción (docs/DECISIONES.md).
 */
@Injectable({ providedIn: 'root' })
export class ComunicadosApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Paginado en el servidor (más reciente primero); `busqueda` busca en el mensaje y las zonas, entre todos. */
  listar(filtro: FiltroPagina & { busqueda?: string }): Observable<PaginaResponse<ComunicadoResponse>> {
    let params = paramsDePagina(filtro);
    const busqueda = filtro.busqueda?.trim();
    if (busqueda) params = params.set('busqueda', busqueda);
    return this.http.get<PaginaResponse<ComunicadoResponse>>(`${this.baseUrl}/comunicados`, { params });
  }

  crear(datos: CrearComunicadoRequest): Observable<ComunicadoResponse> {
    return this.http.post<ComunicadoResponse>(`${this.baseUrl}/comunicados`, datos);
  }

  confirmaciones(id: string): Observable<ComunicadoConfirmacionResponse[]> {
    return this.http.get<ComunicadoConfirmacionResponse[]>(`${this.baseUrl}/comunicados/${id}/confirmaciones`);
  }
}
