import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { FamiliasApi } from './familias.api';

const base = environment.apiBaseUrl;

describe('FamiliasApi', () => {
  let api: FamiliasApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(FamiliasApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() hace GET /admin/familias', () => {
    api.listar().subscribe();
    const req = http.expectOne(`${base}/admin/familias`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('crear() hace POST /admin/familias', () => {
    api.crear({ nombre: 'Yogurt' }).subscribe();
    const req = http.expectOne(`${base}/admin/familias`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nombre: 'Yogurt' });
    req.flush({ id: 'f-1', nombre: 'Yogurt', activo: true });
  });

  it('desactivar() hace DELETE por id', () => {
    api.desactivar('f-1').subscribe();
    const req = http.expectOne(`${base}/admin/familias/f-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('reactivar() hace PATCH a /reactivar', () => {
    api.reactivar('f-1').subscribe();
    const req = http.expectOne(`${base}/admin/familias/f-1/reactivar`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ id: 'f-1', nombre: 'Yogurt', activo: true });
  });
});
