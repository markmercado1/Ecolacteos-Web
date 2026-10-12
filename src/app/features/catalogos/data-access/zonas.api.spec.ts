import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ZonasApi } from './zonas.api';

const base = environment.apiBaseUrl;

describe('ZonasApi', () => {
  let api: ZonasApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ZonasApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listarAdmin() hace GET /admin/zonas', () => {
    api.listarAdmin().subscribe();
    const req = http.expectOne(`${base}/admin/zonas`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('listarOperativo() hace GET /zonas/operativo (accesible a ACOPIADOR)', () => {
    api.listarOperativo().subscribe();
    const req = http.expectOne(`${base}/zonas/operativo`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('desactivar() hace DELETE por id', () => {
    api.desactivar('z-1').subscribe();
    const req = http.expectOne(`${base}/admin/zonas/z-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('reactivar() hace PATCH a /reactivar', () => {
    api.reactivar('z-1').subscribe();
    const req = http.expectOne(`${base}/admin/zonas/z-1/reactivar`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ id: 'z-1', nombre: 'Huancayo Norte', activa: true });
  });
});
