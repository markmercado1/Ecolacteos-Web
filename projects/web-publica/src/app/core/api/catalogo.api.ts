import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from './api-url';
import { CatalogoResponse } from './catalogo.models';

/** Endpoint público (sin token): GET /api/catalogo/productos. */
@Injectable({ providedIn: 'root' })
export class CatalogoApi {
  private readonly http = inject(HttpClient);

  listar(): Observable<CatalogoResponse> {
    return this.http.get<CatalogoResponse>(apiUrl('/catalogo/productos'));
  }
}
