import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import { FiltroPagina, paramsDePagina } from '../../../shared/util/paginacion';
import { PrecioLitroRequest, PrecioLitroResponse } from './precio.models';

/** Fuente: docs/ENDPOINTS.md, AdminCatalogosController.java. */
@Injectable({ providedIn: 'root' })
export class PreciosApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Histórico paginado en el servidor (vigenteDesde desc, desempate por id). */
  listar(filtro: FiltroPagina): Observable<PaginaResponse<PrecioLitroResponse>> {
    return this.http.get<PaginaResponse<PrecioLitroResponse>>(`${this.baseUrl}/admin/precios-litro`, {
      params: paramsDePagina(filtro)
    });
  }

  /**
   * Precio vigente hoy, resuelto en el servidor con la misma regla que la liquidación de pagos. Ya no se
   * puede deducir del histórico porque la web solo recibe una página. 204 (sin precio vigente) llega como null.
   */
  vigente(): Observable<PrecioLitroResponse | null> {
    return this.http.get<PrecioLitroResponse | null>(`${this.baseUrl}/admin/precios-litro/vigente`);
  }

  crear(datos: PrecioLitroRequest): Observable<PrecioLitroResponse> {
    return this.http.post<PrecioLitroResponse>(`${this.baseUrl}/admin/precios-litro`, datos);
  }
}
