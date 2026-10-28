import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CrearTipoPrecioRequest, EditarTipoPrecioRequest, TipoPrecioResponse } from './tipo-precio.models';

/** Fuente: docs/ENDPOINTS.md, TipoPrecioController.java. Consultar: VENTAS y ADMIN; cambiar el estado: solo ADMIN. */
@Injectable({ providedIn: 'root' })
export class TiposPrecioApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/tipos-precio`;

  /** `soloActivos`: lo que ofrecen los selectores de operaciones nuevas. Sin él, todos con su estado. */
  listar(soloActivos = false): Observable<TipoPrecioResponse[]> {
    const params = new HttpParams().set('soloActivos', soloActivos);
    return this.http.get<TipoPrecioResponse[]>(this.baseUrl, { params });
  }

  crear(datos: CrearTipoPrecioRequest): Observable<TipoPrecioResponse> {
    return this.http.post<TipoPrecioResponse>(this.baseUrl, datos);
  }

  /** Edita nombre y descripción; el código y la regla no cambian, así que ninguna referencia histórica se altera. */
  editar(codigo: string, datos: EditarTipoPrecioRequest): Observable<TipoPrecioResponse> {
    return this.http.put<TipoPrecioResponse>(`${this.baseUrl}/${codigo}`, datos);
  }

  cambiarEstado(codigo: string, activo: boolean, motivo: string): Observable<TipoPrecioResponse> {
    return this.http.put<TipoPrecioResponse>(`${this.baseUrl}/${codigo}/estado`, { activo, motivo });
  }
}
