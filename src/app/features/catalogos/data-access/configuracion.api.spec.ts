import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ConfiguracionApi } from './configuracion.api';

const base = environment.apiBaseUrl;

describe('ConfiguracionApi', () => {
  let api: ConfiguracionApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ConfiguracionApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() hace GET /admin/configuracion', () => {
    api.listar().subscribe();
    const req = http.expectOne(`${base}/admin/configuracion`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('actualizar() codifica la clave en la URL y envía solo { valor }', () => {
    api.actualizar('UMBRAL CONCILIACION', { valor: '5' }).subscribe();
    const req = http.expectOne(`${base}/admin/configuracion/UMBRAL%20CONCILIACION`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ valor: '5' });
    req.flush({ clave: 'UMBRAL CONCILIACION', valor: '5', descripcion: 'x' });
  });
});
