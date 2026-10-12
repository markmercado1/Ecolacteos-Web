import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import { FilaPrecioPresentacionResponse, FiltroPreciosPresentacion, PrecioQuesoRequest, PrecioQuesoResponse } from './precio-queso.models';

/** Fuente: docs/ENDPOINTS.md, AdminCatalogosController.java (bloque "Precios por presentación", Fase 2).
 *  Solo ADMIN. */
@Injectable({ providedIn: 'root' })
export class PreciosQuesoApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /**
   * Sin `presentacionId`: histórico completo del catálogo. Con `presentacionId`: solo el histórico de esa
   * presentación (usado por "Ver histórico" en /precios, para no traer todo el histórico del catálogo).
   */
  listar(presentacionId?: string): Observable<PrecioQuesoResponse[]> {
    const params = presentacionId ? new HttpParams().set('presentacionId', presentacionId) : undefined;
    return this.http.get<PrecioQuesoResponse[]>(`${this.baseUrl}/admin/precios-queso`, { params });
  }

  crear(datos: PrecioQuesoRequest): Observable<PrecioQuesoResponse> {
    return this.http.post<PrecioQuesoResponse>(`${this.baseUrl}/admin/precios-queso`, datos);
  }

  /**
   * Ampliación de Fase 2: una fila por presentación de producto activo, organizada por familia y paginada
   * en el servidor. `familiaId`/`busqueda` se aplican antes de paginar (nunca se descarga todo el catálogo
   * para filtrar en el cliente).
   */
  listarPaginado(filtro: FiltroPreciosPresentacion): Observable<PaginaResponse<FilaPrecioPresentacionResponse>> {
    let params = new HttpParams().set('page', filtro.page).set('size', filtro.size);
    if (filtro.familiaId) params = params.set('familiaId', filtro.familiaId);
    if (filtro.busqueda) params = params.set('busqueda', filtro.busqueda);
    return this.http.get<PaginaResponse<FilaPrecioPresentacionResponse>>(`${this.baseUrl}/admin/precios-queso/presentaciones`, { params });
  }
}
