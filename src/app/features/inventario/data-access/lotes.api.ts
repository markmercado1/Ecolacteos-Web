import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { MovimientoInsumoResponse } from './kardex.models';
import { AlertasLotes, ConteoInsumoRequest, ConteoInsumoResponse, LoteInsumoResponse } from './lotes.models';

/** Fuente: backend controller/InventarioInsumoController.java (lotes, conteos y anulación). Consulta: PRODUCCION o ADMIN; conteo y anulación: ADMIN. */
@Injectable({ providedIn: 'root' })
export class LotesInsumoApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/inventario/insumos`;

  listar(insumoId: string, soloConExistencia = false): Observable<LoteInsumoResponse[]> {
    const params = new HttpParams().set('soloConExistencia', String(soloConExistencia));
    return this.http.get<LoteInsumoResponse[]>(`${this.baseUrl}/${encodeURIComponent(insumoId)}/lotes`, { params });
  }

  /** Lotes con existencia por vencer (15 días por defecto) o vencidos. */
  alertas(): Observable<AlertasLotes> {
    return this.http.get<AlertasLotes>(`${this.baseUrl}/lotes/alertas`);
  }

  /** Conteo físico por lote: la cantidad contada de cada lote; la diferencia queda como AJUSTE en ese lote. */
  contar(insumoId: string, datos: ConteoInsumoRequest): Observable<ConteoInsumoResponse> {
    return this.http.post<ConteoInsumoResponse>(`${this.baseUrl}/${encodeURIComponent(insumoId)}/conteos`, datos);
  }

  /** Anula un ingreso (su lote completo) si no se ha usado. */
  anular(loteId: string, motivo: string): Observable<MovimientoInsumoResponse> {
    return this.http.post<MovimientoInsumoResponse>(`${this.baseUrl}/lotes/${encodeURIComponent(loteId)}/anulacion`, { motivo });
  }
}
