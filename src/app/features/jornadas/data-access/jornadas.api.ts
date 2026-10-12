import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { JornadaBandeja } from './jornada.models';

/**
 * Fuente: docs/ENDPOINTS.md, JornadaController.java. Roles: RECEPCION y ADMIN.
 * El detalle (GET /api/jornadas/{id}) ya lo expone `AcopiosApi.jornada()`
 * (features/acopios), reutilizado aquí en vez de duplicar el método/DTO.
 */
@Injectable({ providedIn: 'root' })
export class JornadasApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  listarBandeja(): Observable<JornadaBandeja[]> {
    return this.http.get<JornadaBandeja[]>(`${this.baseUrl}/jornadas`);
  }
}
