import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { RutasApi } from './rutas.api';

const base = environment.apiBaseUrl;

describe('RutasApi', () => {
  let api: RutasApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(RutasApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() hace GET /zonas/{zonaId}/ruta', () => {
    api.listar('z-1').subscribe();
    const req = http.expectOne(`${base}/zonas/z-1/ruta`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('definir() hace PUT con el arreglo de items exacto', () => {
    const items = [{ proveedorId: 'p-1', orden: 1, horaEstimada: '07:30' }];
    api.definir('z-1', { items }).subscribe();
    const req = http.expectOne(`${base}/zonas/z-1/ruta`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ items });
    req.flush([]);
  });
});
