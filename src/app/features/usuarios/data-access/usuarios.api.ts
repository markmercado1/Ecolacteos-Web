import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import { FiltroPagina, paramsDePagina } from '../../../shared/util/paginacion';
import { RolResponse, UsuarioRequest, UsuarioResponse, UsuarioUpdateRequest } from './usuario.models';

/** Filtros del listado paginado; todos opcionales y aplicados en el servidor antes de paginar. */
export interface FiltroUsuarios extends FiltroPagina {
  rol?: string;
  activo?: boolean;
  /** Nombre o correo, sin distinguir mayúsculas. */
  busqueda?: string;
}

/**
 * Fuente: docs/ENDPOINTS.md, AdminUsuarioController.java. Las pantallas de
 * usuarios y acopiadores usan `listarPaginado()` (filtros en el servidor);
 * `listar()` (lista completa) queda solo para selectores, p. ej. el
 * responsable de una unidad.
 */
@Injectable({ providedIn: 'root' })
export class UsuariosApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Lista completa, sin paginar: solo para selectores (responsable de unidad). */
  listar(): Observable<UsuarioResponse[]> {
    return this.http.get<UsuarioResponse[]>(`${this.baseUrl}/admin/usuarios`);
  }

  listarPaginado(filtro: FiltroUsuarios): Observable<PaginaResponse<UsuarioResponse>> {
    let params = paramsDePagina(filtro);
    if (filtro.rol) params = params.set('rol', filtro.rol);
    if (filtro.activo !== undefined) params = params.set('activo', filtro.activo);
    const busqueda = filtro.busqueda?.trim();
    if (busqueda) params = params.set('busqueda', busqueda);
    return this.http.get<PaginaResponse<UsuarioResponse>>(`${this.baseUrl}/admin/usuarios/paginado`, { params });
  }

  obtener(id: string): Observable<UsuarioResponse> {
    return this.http.get<UsuarioResponse>(`${this.baseUrl}/admin/usuarios/${id}`);
  }

  crear(datos: UsuarioRequest): Observable<UsuarioResponse> {
    return this.http.post<UsuarioResponse>(`${this.baseUrl}/admin/usuarios`, datos);
  }

  actualizar(id: string, datos: UsuarioUpdateRequest): Observable<UsuarioResponse> {
    return this.http.put<UsuarioResponse>(`${this.baseUrl}/admin/usuarios/${id}`, datos);
  }

  desactivar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/usuarios/${id}`);
  }

  reactivar(id: string): Observable<UsuarioResponse> {
    return this.http.patch<UsuarioResponse>(`${this.baseUrl}/admin/usuarios/${id}/reactivar`, {});
  }

  listarRoles(): Observable<RolResponse[]> {
    return this.http.get<RolResponse[]>(`${this.baseUrl}/admin/roles`);
  }
}
