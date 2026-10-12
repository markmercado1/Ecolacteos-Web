import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { MotivosApi } from './motivos.api';

const base = environment.apiBaseUrl;

describe('MotivosApi', () => {
  let api: MotivosApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(MotivosApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('crear() envía { descripcion } por POST', () => {
    api.crear({ descripcion: 'Envase no conforme' }).subscribe();
    const req = http.expectOne(`${base}/admin/motivos-observacion`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ descripcion: 'Envase no conforme' });
    req.flush({ id: 'm-1', descripcion: 'Envase no conforme' });
  });

  it('desactivar() hace DELETE por id', () => {
    api.desactivar('m-1').subscribe();
    const req = http.expectOne(`${base}/admin/motivos-observacion/m-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
