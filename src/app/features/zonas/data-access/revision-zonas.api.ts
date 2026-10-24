import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RevisionZonasResponse } from './revision-zonas.models';

/** Fuente: docs/ENDPOINTS.md, RevisionZonasController.java. Solo lectura, solo ADMIN. */
@Injectable({ providedIn: 'root' })
export class RevisionZonasApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  obtener(): Observable<RevisionZonasResponse> {
    return this.http.get<RevisionZonasResponse>(`${this.baseUrl}/admin/zonas/revision`);
  }
}
