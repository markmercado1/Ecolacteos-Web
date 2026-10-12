import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PresentacionRequest, PresentacionResponse, ProductoRequest, ProductoResponse } from './producto.models';

/** Fuente: docs/ENDPOINTS.md, AdminCatalogosController.java (Fase 1: Producto + Presentación, generaliza
 *  "Tipos de queso"). Las presentaciones se administran dentro de la ficha del producto, no aparte. */
@Injectable({ providedIn: 'root' })
export class ProductosApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Solo ADMIN (hasRole('ADMIN')): GET /api/admin/productos. */
  listar(): Observable<ProductoResponse[]> {
    return this.http.get<ProductoResponse[]>(`${this.baseUrl}/admin/productos`);
  }

  /**
   * Catálogo para roles sin acceso a /admin (p. ej. VENTAS, PRODUCCION): GET /api/sync/cambios
   * es "Autenticado" y ya filtra a productos activos en el servidor (mismo criterio que /admin/productos).
   */
  listarOperativo(): Observable<ProductoResponse[]> {
    return this.http
      .get<{ productos: ProductoResponse[] }>(`${this.baseUrl}/sync/cambios`)
      .pipe(map((respuesta) => respuesta.productos));
  }

  crear(datos: ProductoRequest): Observable<ProductoResponse> {
    return this.http.post<ProductoResponse>(`${this.baseUrl}/admin/productos`, datos);
  }

  actualizar(id: string, datos: ProductoRequest): Observable<ProductoResponse> {
    return this.http.put<ProductoResponse>(`${this.baseUrl}/admin/productos/${id}`, datos);
  }

  desactivar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/productos/${id}`);
  }

  reactivar(id: string): Observable<ProductoResponse> {
    return this.http.patch<ProductoResponse>(`${this.baseUrl}/admin/productos/${id}/reactivar`, {});
  }

  // --- Fotos (producto y presentación): multipart, campo `file`; el servidor valida tipo/tamaño ---

  subirFotoProducto(id: string, archivo: File): Observable<ProductoResponse> {
    return this.http.put<ProductoResponse>(`${this.baseUrl}/admin/productos/${id}/foto`, formularioConArchivo(archivo));
  }

  quitarFotoProducto(id: string): Observable<ProductoResponse> {
    return this.http.delete<ProductoResponse>(`${this.baseUrl}/admin/productos/${id}/foto`);
  }

  subirFotoPresentacion(productoId: string, presentacionId: string, archivo: File): Observable<PresentacionResponse> {
    return this.http.put<PresentacionResponse>(
      `${this.baseUrl}/admin/productos/${productoId}/presentaciones/${presentacionId}/foto`, formularioConArchivo(archivo));
  }

  quitarFotoPresentacion(productoId: string, presentacionId: string): Observable<PresentacionResponse> {
    return this.http.delete<PresentacionResponse>(
      `${this.baseUrl}/admin/productos/${productoId}/presentaciones/${presentacionId}/foto`);
  }

  // --- Presentaciones (dentro de la ficha del producto) ---

  crearPresentacion(productoId: string, datos: PresentacionRequest): Observable<PresentacionResponse> {
    return this.http.post<PresentacionResponse>(`${this.baseUrl}/admin/productos/${productoId}/presentaciones`, datos);
  }

  actualizarPresentacion(productoId: string, presentacionId: string, datos: PresentacionRequest): Observable<PresentacionResponse> {
    return this.http.put<PresentacionResponse>(
      `${this.baseUrl}/admin/productos/${productoId}/presentaciones/${presentacionId}`, datos);
  }

  desactivarPresentacion(productoId: string, presentacionId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/productos/${productoId}/presentaciones/${presentacionId}`);
  }

  reactivarPresentacion(productoId: string, presentacionId: string): Observable<PresentacionResponse> {
    return this.http.patch<PresentacionResponse>(
      `${this.baseUrl}/admin/productos/${productoId}/presentaciones/${presentacionId}/reactivar`, {});
  }
}

function formularioConArchivo(archivo: File): FormData {
  const datos = new FormData();
  datos.append('file', archivo, archivo.name);
  return datos;
}
