import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CategoriaProveedor, ProveedorCompraRequest, ProveedorCompraResponse } from './proveedor-compra.models';

/**
 * Fuente: backend controller/ProveedorCompraController.java. Consulta y alta rápida: PRODUCCION o ADMIN; edición y baja: solo ADMIN.
 * No confundir con ProveedoresApi (ganaderos de leche del acopio).
 */
@Injectable({ providedIn: 'root' })
export class ProveedoresCompraApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/proveedores-compra`;

  /** `soloActivos` (por defecto true) es lo que ofrece el selector del ingreso; la pantalla de administración pide todos. */
  listar(opciones: { busqueda?: string; soloActivos?: boolean } = {}): Observable<ProveedorCompraResponse[]> {
    let params = new HttpParams().set('soloActivos', String(opciones.soloActivos ?? true));
    if (opciones.busqueda?.trim()) params = params.set('busqueda', opciones.busqueda.trim());
    return this.http.get<ProveedorCompraResponse[]>(this.baseUrl, { params });
  }

  categorias(): Observable<CategoriaProveedor[]> {
    return this.http.get<CategoriaProveedor[]>(`${this.baseUrl}/categorias`);
  }

  crear(datos: ProveedorCompraRequest): Observable<ProveedorCompraResponse> {
    return this.http.post<ProveedorCompraResponse>(this.baseUrl, datos);
  }

  actualizar(id: string, datos: ProveedorCompraRequest): Observable<ProveedorCompraResponse> {
    return this.http.put<ProveedorCompraResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`, datos);
  }

  desactivar(id: string): Observable<ProveedorCompraResponse> {
    return this.http.patch<ProveedorCompraResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/desactivar`, {});
  }

  reactivar(id: string): Observable<ProveedorCompraResponse> {
    return this.http.patch<ProveedorCompraResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/reactivar`, {});
  }
}
