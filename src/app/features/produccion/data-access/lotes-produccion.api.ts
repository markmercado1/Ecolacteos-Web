import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import { DisponibilidadProduccion } from '../../catalogos/data-access/receta.models';
import {
  CrearLoteRequest,
  EstadoLote,
  FinalizarLoteRequest,
  LoteProduccion,
  PlanificarLoteRequest
} from './lote-produccion.models';

export interface FiltroLotes {
  fecha?: string;
  productoId?: string;
  estado?: EstadoLote;
  /** Producto o responsable (contiene, sin acentos ni mayúsculas), entre todos los lotes. */
  busqueda?: string;
  page: number;
  size: number;
}

/**
 * Fuente: docs/ENDPOINTS.md, LoteProduccionController.java. Roles: PRODUCCION y ADMIN en todos los métodos.
 * `crear()` reutiliza el mismo `POST /api/lotes-produccion` idempotente por `uuidCliente` que ejecuta
 * `LoteProduccionService.crear()` — el mismo servicio que procesa el lote que sube la app móvil por
 * `POST /api/sync/lotes-produccion` (uno por uno, ver docs/REGISTRO.md). Se usa la variante síncrona
 * porque esta web no tiene cola offline: cada envío es una operación interactiva única.
 *
 * V18 (recetas): planificar → iniciar (consume leche e insumos) → finalizar (resultado real, ingresa
 * producto terminado) o cancelar (solo planificada, nada que revertir).
 */
@Injectable({ providedIn: 'root' })
export class LotesProduccionApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listar(filtro: FiltroLotes): Observable<PaginaResponse<LoteProduccion>> {
    let params = new HttpParams().set('page', filtro.page).set('size', filtro.size);
    if (filtro.fecha) params = params.set('fecha', filtro.fecha);
    if (filtro.productoId) params = params.set('productoId', filtro.productoId);
    if (filtro.estado) params = params.set('estado', filtro.estado);
    const busqueda = filtro.busqueda?.trim();
    if (busqueda) params = params.set('busqueda', busqueda);
    return this.http.get<PaginaResponse<LoteProduccion>>(`${this.baseUrl}/lotes-produccion`, { params });
  }

  obtener(id: string): Observable<LoteProduccion> {
    return this.http.get<LoteProduccion>(`${this.baseUrl}/lotes-produccion/${encodeURIComponent(id)}`);
  }

  crear(datos: CrearLoteRequest): Observable<LoteProduccion> {
    return this.http.post<LoteProduccion>(`${this.baseUrl}/lotes-produccion`, datos);
  }

  planificar(datos: PlanificarLoteRequest): Observable<LoteProduccion> {
    return this.http.post<LoteProduccion>(`${this.baseUrl}/lotes-produccion/planificar`, datos);
  }

  /** Plan del lote contra el stock actual (informativo). */
  disponibilidad(id: string): Observable<DisponibilidadProduccion> {
    return this.http.get<DisponibilidadProduccion>(
      `${this.baseUrl}/lotes-produccion/${encodeURIComponent(id)}/disponibilidad`
    );
  }

  iniciar(id: string): Observable<LoteProduccion> {
    return this.http.post<LoteProduccion>(`${this.baseUrl}/lotes-produccion/${encodeURIComponent(id)}/iniciar`, {});
  }

  finalizar(id: string, datos: FinalizarLoteRequest): Observable<LoteProduccion> {
    return this.http.post<LoteProduccion>(
      `${this.baseUrl}/lotes-produccion/${encodeURIComponent(id)}/finalizar`,
      datos
    );
  }

  cancelar(id: string): Observable<LoteProduccion> {
    return this.http.post<LoteProduccion>(`${this.baseUrl}/lotes-produccion/${encodeURIComponent(id)}/cancelar`, {});
  }
}
