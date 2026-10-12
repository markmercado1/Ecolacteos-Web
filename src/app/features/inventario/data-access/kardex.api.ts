import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { InsumoResponse } from '../../catalogos/data-access/insumo.models';
import {
  AjusteInsumoRequest,
  FiltroKardex,
  IngresoInsumoRequest,
  Kardex,
  MovimientoInsumoResponse,
  TipoItemKardex
} from './kardex.models';

/**
 * Fuente: backend KardexController.java e InventarioInsumoController.java (V19).
 * Kardex de leche e insumos: PRODUCCION o ADMIN. Kardex de producto terminado: PRODUCCION, VENTAS o ADMIN.
 * Ingresos de insumos: PRODUCCION o ADMIN. Ajustes de insumos por conteo: solo ADMIN.
 */
@Injectable({ providedIn: 'root' })
export class KardexApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/inventario`;

  kardex(tipo: TipoItemKardex, itemId: string | null, filtro: FiltroKardex): Observable<Kardex> {
    let params = new HttpParams().set('page', filtro.page).set('size', filtro.size);
    if (filtro.desde) params = params.set('desde', filtro.desde);
    if (filtro.hasta) params = params.set('hasta', filtro.hasta);
    const ruta =
      tipo === 'LECHE'
        ? 'kardex/leche'
        : tipo === 'INSUMO'
          ? `kardex/insumos/${encodeURIComponent(itemId ?? '')}`
          : `kardex/presentaciones/${encodeURIComponent(itemId ?? '')}`;
    return this.http.get<Kardex>(`${this.baseUrl}/${ruta}`, { params });
  }

  /** Stock de insumos: activos y desactivados que conservan stock. */
  listarInsumos(): Observable<InsumoResponse[]> {
    return this.http.get<InsumoResponse[]>(`${this.baseUrl}/insumos`);
  }

  registrarIngreso(insumoId: string, datos: IngresoInsumoRequest): Observable<MovimientoInsumoResponse> {
    return this.http.post<MovimientoInsumoResponse>(
      `${this.baseUrl}/insumos/${encodeURIComponent(insumoId)}/ingresos`,
      datos
    );
  }

  ajustarInsumo(insumoId: string, datos: AjusteInsumoRequest): Observable<MovimientoInsumoResponse> {
    return this.http.post<MovimientoInsumoResponse>(
      `${this.baseUrl}/insumos/${encodeURIComponent(insumoId)}/ajustes`,
      datos
    );
  }
}
