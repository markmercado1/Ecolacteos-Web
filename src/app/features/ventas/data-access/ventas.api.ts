import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import { PrecioQuesoResponse } from '../../precios/data-access/precio-queso.models';
import { CrearVentaCarritoRequest, TipoClienteVenta, VentaResumenResponse } from './venta.models';

export interface FiltroVentas {
  fecha?: string;
  tipoCliente?: TipoClienteVenta;
  page: number;
  size: number;
}

/** Fuente: docs/ENDPOINTS.md, VentaController.java. Roles: ADMIN y VENTAS. */
@Injectable({ providedIn: 'root' })
export class VentasApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listar(filtro: FiltroVentas): Observable<PaginaResponse<VentaResumenResponse>> {
    let params = new HttpParams().set('page', filtro.page).set('size', filtro.size);
    if (filtro.fecha) params = params.set('fecha', filtro.fecha);
    if (filtro.tipoCliente) params = params.set('tipoCliente', filtro.tipoCliente);
    return this.http.get<PaginaResponse<VentaResumenResponse>>(`${this.baseUrl}/ventas`, { params });
  }

  obtener(id: string): Observable<VentaResumenResponse> {
    return this.http.get<VentaResumenResponse>(`${this.baseUrl}/ventas/${encodeURIComponent(id)}`);
  }

  /** Fase 4 (Venta multi-línea / carrito): una venta con una o más líneas. Endpoint exclusivo de la web --
   *  el contrato de una sola línea (POST /api/ventas) sigue existiendo tal cual para el sync de la app móvil. */
  crearCarrito(datos: CrearVentaCarritoRequest): Observable<VentaResumenResponse> {
    return this.http.post<VentaResumenResponse>(`${this.baseUrl}/ventas/carrito`, datos);
  }

  /**
   * Consulta el precio vigente de UNA presentación para mostrarlo en el formulario ANTES de confirmar (UX).
   * El backend vuelve a resolverlo de forma independiente al confirmar la venta -- el valor devuelto aquí
   * nunca es la fuente de verdad. `fecha` es obligatoria: la preview y la confirmación deben usar el mismo
   * criterio de vigencia, la fecha de la venta, no la fecha de hoy. Para un carrito con varias líneas se
   * llama una vez por cada presentación seleccionada (mismo patrón que producción con varias presentaciones).
   */
  precioVigente(presentacionId: string, tipoCliente: TipoClienteVenta, fecha: string): Observable<PrecioQuesoResponse> {
    const params = new HttpParams()
      .set('presentacionId', presentacionId)
      .set('tipoCliente', tipoCliente)
      .set('fecha', fecha);
    return this.http.get<PrecioQuesoResponse>(`${this.baseUrl}/ventas/precio-vigente`, { params });
  }
}
