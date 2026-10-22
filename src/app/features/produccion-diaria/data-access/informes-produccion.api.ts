import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginaResponse } from '../../../shared/models/pagina-response';
import {
  CrearInformeProduccionRequest,
  EditarInformeProduccionRequest,
  InformeProduccionDiario
} from './informe-produccion.models';

export interface FiltroInformes {
  desde?: string;
  hasta?: string;
  /** Responsable (contiene, sin acentos ni mayúsculas), entre todos los informes. */
  busqueda?: string;
  page: number;
  size: number;
}

/** Fuente: backend controller/InformeProduccionDiarioController.java. Roles: PRODUCCION y ADMIN. */
@Injectable({ providedIn: 'root' })
export class InformesProduccionApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listar(filtro: FiltroInformes): Observable<PaginaResponse<InformeProduccionDiario>> {
    let params = new HttpParams().set('page', filtro.page).set('size', filtro.size);
    if (filtro.desde) params = params.set('desde', filtro.desde);
    if (filtro.hasta) params = params.set('hasta', filtro.hasta);
    const busqueda = filtro.busqueda?.trim();
    if (busqueda) params = params.set('busqueda', busqueda);
    return this.http.get<PaginaResponse<InformeProduccionDiario>>(`${this.baseUrl}/informes-produccion`, { params });
  }

  obtener(id: string): Observable<InformeProduccionDiario> {
    return this.http.get<InformeProduccionDiario>(`${this.baseUrl}/informes-produccion/${encodeURIComponent(id)}`);
  }

  /** 404 si no existe informe para esa fecha -- el llamador lo usa para distinguir crear vs. editar. */
  obtenerPorFecha(fecha: string): Observable<InformeProduccionDiario> {
    return this.http.get<InformeProduccionDiario>(`${this.baseUrl}/informes-produccion/fecha/${encodeURIComponent(fecha)}`);
  }

  crear(datos: CrearInformeProduccionRequest): Observable<InformeProduccionDiario> {
    return this.http.post<InformeProduccionDiario>(`${this.baseUrl}/informes-produccion`, datos);
  }

  editar(id: string, datos: EditarInformeProduccionRequest): Observable<InformeProduccionDiario> {
    return this.http.put<InformeProduccionDiario>(`${this.baseUrl}/informes-produccion/${encodeURIComponent(id)}`, datos);
  }
}
