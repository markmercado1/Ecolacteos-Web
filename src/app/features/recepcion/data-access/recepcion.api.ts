import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import { RecepcionPlanta } from './recepcion.models';

export interface FiltroRecepcion {
  unidadId?: string;
  fecha?: string;
  /** Placa o responsable (contiene, sin acentos ni mayúsculas), entre todas las recepciones. */
  busqueda?: string;
  page: number;
  size: number;
}

/**
 * Fuente: docs/ENDPOINTS.md, RecepcionPlantaController.java. Roles: RECEPCION y ADMIN.
 * Solo lectura: la recepción se registra desde el móvil/planta, no desde esta web (docs/DECISIONES.md).
 */
@Injectable({ providedIn: 'root' })
export class RecepcionApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listar(filtro: FiltroRecepcion): Observable<PaginaResponse<RecepcionPlanta>> {
    let params = new HttpParams().set('page', filtro.page).set('size', filtro.size);
    if (filtro.unidadId) params = params.set('unidadId', filtro.unidadId);
    if (filtro.fecha) params = params.set('fecha', filtro.fecha);
    const busqueda = filtro.busqueda?.trim();
    if (busqueda) params = params.set('busqueda', busqueda);
    return this.http.get<PaginaResponse<RecepcionPlanta>>(`${this.baseUrl}/recepcion-planta`, { params });
  }

  obtener(id: string): Observable<RecepcionPlanta> {
    return this.http.get<RecepcionPlanta>(`${this.baseUrl}/recepcion-planta/${encodeURIComponent(id)}`);
  }
}
