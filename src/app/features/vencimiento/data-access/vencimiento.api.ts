import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ControlVencimientoResponse,
  ProductosConControlResponse,
  RegularizacionRequest,
  RegularizacionResponse
} from './vencimiento.models';

/** Fuente: docs/ENDPOINTS.md, ControlVencimientoController.java (Fase 1 y 2). */
@Injectable({ providedIn: 'root' })
export class VencimientoApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Ids de los productos que controlan vencimiento (PRODUCCION, VENTAS, ADMIN). */
  productosConControl(): Observable<ProductosConControlResponse> {
    return this.http.get<ProductosConControlResponse>(`${this.baseUrl}/control-vencimiento/productos`);
  }

  /** ADMIN. 409 si la activación está deshabilitada en el entorno. Las existencias actuales quedan "sin trazabilidad". */
  activar(productoId: string): Observable<ControlVencimientoResponse> {
    return this.http.put<ControlVencimientoResponse>(
      `${this.baseUrl}/admin/productos/${encodeURIComponent(productoId)}/control-vencimiento`, null);
  }

  /** ADMIN. 409 si ya hay movimientos asignados a lotes desde la activación o el stock cambió. */
  desactivar(productoId: string): Observable<ControlVencimientoResponse> {
    return this.http.delete<ControlVencimientoResponse>(
      `${this.baseUrl}/admin/productos/${encodeURIComponent(productoId)}/control-vencimiento`);
  }

  /** ADMIN. */
  regularizar(presentacionId: string, datos: RegularizacionRequest): Observable<RegularizacionResponse> {
    return this.http.post<RegularizacionResponse>(
      `${this.baseUrl}/admin/presentaciones/${encodeURIComponent(presentacionId)}/regularizaciones`, datos);
  }
}
