import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { UnidadesApi } from './unidades.api';
import { UnidadResponse } from './unidad.models';

const base = environment.apiBaseUrl;
const unidad: UnidadResponse = {
  id: 'un-1', placa: 'W6P-814', capacidadTon: 5, zonaId: 'z-1', responsableId: 'u-1', responsableNombre: 'Ana'
};

describe('UnidadesApi', () => {
  let api: UnidadesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(UnidadesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() hace GET /admin/unidades', () => {
    api.listar().subscribe();
    const req = http.expectOne(`${base}/admin/unidades`);
    expect(req.request.method).toBe('GET');
    req.flush([unidad]);
  });

  it('listarOperativo() hace GET /unidades/operativo', () => {
    api.listarOperativo().subscribe();
    const req = http.expectOne(`${base}/unidades/operativo`);
    expect(req.request.method).toBe('GET');
    req.flush([unidad]);
  });

  it('crear() envía UnidadRequest exacto por POST, incluido responsableId', () => {
    api.crear({ placa: 'W6P-814', capacidadTon: 5, zonaId: 'z-1', responsableId: 'u-1' }).subscribe();
    const req = http.expectOne(`${base}/admin/unidades`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ placa: 'W6P-814', capacidadTon: 5, zonaId: 'z-1', responsableId: 'u-1' });
    req.flush(unidad);
  });

  it('actualizar() hace PUT por id', () => {
    api.actualizar('un-1', { placa: 'W6P-814', capacidadTon: null, zonaId: null, responsableId: 'u-2' }).subscribe();
    const req = http.expectOne(`${base}/admin/unidades/un-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.responsableId).toBe('u-2');
    req.flush(unidad);
  });
});
