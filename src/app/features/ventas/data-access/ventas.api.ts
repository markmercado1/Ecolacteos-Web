import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import { PrecioQuesoResponse } from '../../precios/data-access/precio-queso.models';
import { CrearVentaCarritoRequest, PresentacionVentaResultado, TipoClienteVenta, VentaResumenResponse } from './venta.models';

export interface FiltroVentas {
  /** Fecha exacta (si se indica, manda sobre desde/hasta). */
  fecha?: string;
  /** Rango de fechas, ambos extremos inclusivos; cualquiera puede faltar. */
  desde?: string;
  hasta?: string;
  tipoCliente?: TipoClienteVenta;
  /** Vendedor, comprador, número de comprobante, producto o presentación (contiene, sin acentos ni mayúsculas), entre todas las ventas. */
  busqueda?: string;
  page: number;
  size: number;
}

/** Totales de las ventas de un filtro (GET /api/ventas/resumen). */
export interface ResumenVentas {
  cantidad: number;
  total: number;
}

/** Fuente: docs/ENDPOINTS.md, VentaController.java. Roles: ADMIN y VENTAS. */
@Injectable({ providedIn: 'root' })
export class VentasApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listar(filtro: FiltroVentas): Observable<PaginaResponse<VentaResumenResponse>> {
    const params = this.paramsDeFiltro(filtro).set('page', filtro.page).set('size', filtro.size);
    return this.http.get<PaginaResponse<VentaResumenResponse>>(`${this.baseUrl}/ventas`, { params });
  }

  /** Cuántas ventas cumplen el filtro y cuánto suman (todas, no solo la página que se ve). Mismos filtros y búsqueda que `listar`. */
  resumen(filtro: Omit<FiltroVentas, 'page' | 'size'> = {}): Observable<ResumenVentas> {
    return this.http.get<ResumenVentas>(`${this.baseUrl}/ventas/resumen`, { params: this.paramsDeFiltro(filtro) });
  }

  private paramsDeFiltro(filtro: Omit<FiltroVentas, 'page' | 'size'>): HttpParams {
    let params = new HttpParams();
    if (filtro.fecha) params = params.set('fecha', filtro.fecha);
    if (filtro.desde) params = params.set('desde', filtro.desde);
    if (filtro.hasta) params = params.set('hasta', filtro.hasta);
    if (filtro.tipoCliente) params = params.set('tipoCliente', filtro.tipoCliente);
    const busqueda = filtro.busqueda?.trim();
    if (busqueda) params = params.set('busqueda', busqueda);
    return params;
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
   * Buscador con autocompletado de «Nueva venta»: presentaciones cuyo producto, presentación o código coinciden con `q` (primero las que
   * EMPIEZAN con el texto), con su stock vendible y el precio vigente para el canal y la fecha de la venta. Sin texto responde una lista vacía.
   */
  buscarPresentaciones(q: string, tipoCliente: TipoClienteVenta, fecha: string, limite = 10): Observable<PresentacionVentaResultado[]> {
    const params = new HttpParams().set('q', q).set('tipoCliente', tipoCliente).set('fecha', fecha).set('limite', limite);
    return this.http.get<PresentacionVentaResultado[]>(`${this.baseUrl}/ventas/presentaciones`, { params });
  }

  /**
   * Comprobante de la venta en PDF (nota de venta o boleta). El navegador no puede mandar el token en un enlace directo: se descarga con la
   * sesión como Blob y luego se imprime, se abre o se guarda.
   */
  comprobante(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/ventas/${encodeURIComponent(id)}/comprobante`, { responseType: 'blob' });
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
