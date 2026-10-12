import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FiltroPagina, paramsDePagina } from '../../../shared/util/paginacion';
import { AjusteInventarioRequest, AjusteInventarioResponse, ExistenciasPresentacionResponse, FilaStockResponse, SaldoLecheResponse, StockPresentacionResponse, StockResponse } from './inventario.models';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import { FamiliaResponse } from '../../catalogos/data-access/familia.models';

/** Fuente: docs/ENDPOINTS.md, InventarioController.java. Solo lectura -- ni el stock de queso ni el saldo
 *  de leche se escriben desde el frontend, solo cambian como efecto de operaciones ya existentes
 *  (Producción, Ventas, Recepción). */
@Injectable({ providedIn: 'root' })
export class InventarioApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listarFamilias(): Observable<FamiliaResponse[]> {
    return this.http.get<FamiliaResponse[]>(`${this.baseUrl}/inventario/familias`);
  }

  listarStock(filtro: { page: number; size: number; familiaId?: string; busqueda?: string }): Observable<PaginaResponse<FilaStockResponse>> {
    let params = new HttpParams().set('page', filtro.page).set('size', filtro.size);
    if (filtro.familiaId) params = params.set('familiaId', filtro.familiaId);
    if (filtro.busqueda?.trim()) params = params.set('busqueda', filtro.busqueda.trim());
    return this.http.get<PaginaResponse<FilaStockResponse>>(`${this.baseUrl}/inventario/stock/presentaciones`, { params });
  }

  obtenerStock(): Observable<StockResponse[]> {
    return this.http.get<StockResponse[]>(`${this.baseUrl}/inventario/stock`);
  }

  /** Fase 3: consulta puntual usada por el carrito de ventas al seleccionar una presentación -- informativa,
   *  sin bloqueo (la validación autoritativa de stock suficiente ocurre al confirmar la venta). */
  obtenerStockDePresentacion(presentacionId: string): Observable<StockPresentacionResponse> {
    return this.http.get<StockPresentacionResponse>(`${this.baseUrl}/inventario/stock/presentaciones/${encodeURIComponent(presentacionId)}`);
  }

  /** Fase 2 (solo web): existencias de una presentación separando lo físico de lo vendible, con el detalle por
   *  lote (FEFO). Informativa, sin bloqueo. El carrito de ventas la usa en vez del stock físico. */
  obtenerExistencias(presentacionId: string): Observable<ExistenciasPresentacionResponse> {
    return this.http.get<ExistenciasPresentacionResponse>(
      `${this.baseUrl}/inventario/presentaciones/${encodeURIComponent(presentacionId)}/existencias`);
  }

  /** Refactor de Producción, fase 3: pensado para que "Registrar producción" muestre la leche disponible
   *  antes de que el usuario indique cuánta usar. */
  obtenerSaldoLeche(): Observable<SaldoLecheResponse> {
    return this.http.get<SaldoLecheResponse>(`${this.baseUrl}/inventario/leche/saldo`);
  }

  /** Ajustar stock (solo ADMIN): registra la diferencia entre el stock del sistema y un conteo físico real
   *  como un movimiento nuevo en el libro mayor -- nunca sobrescribe el saldo ni toca leche. */
  ajustarStock(datos: AjusteInventarioRequest): Observable<AjusteInventarioResponse> {
    return this.http.post<AjusteInventarioResponse>(`${this.baseUrl}/inventario/ajustes`, datos);
  }

  /** Historial de ajustes de una presentación (solo ADMIN), paginado en el servidor; más reciente primero. */
  listarAjustes(presentacionId: string, filtro: FiltroPagina): Observable<PaginaResponse<AjusteInventarioResponse>> {
    const params = paramsDePagina(filtro).set('presentacionId', presentacionId);
    return this.http.get<PaginaResponse<AjusteInventarioResponse>>(`${this.baseUrl}/inventario/ajustes`, { params });
  }
}
