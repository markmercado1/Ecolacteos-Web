import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ComunicadosApi } from './comunicados.api';

const base = environment.apiBaseUrl;

describe('ComunicadosApi', () => {
  let api: ComunicadosApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ComunicadosApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('crear() envía mensaje y zonaIds exactos', () => {
    api.crear({ mensaje: 'Aviso', zonaIds: ['z-1', 'z-2'] }).subscribe();
    const req = http.expectOne(`${base}/comunicados`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ mensaje: 'Aviso', zonaIds: ['z-1', 'z-2'] });
    req.flush({ id: 'c-1', mensaje: 'Aviso', fecha: '2026-09-16', zonasNombres: ['Huancayo Norte'] });
  });

  it('confirmaciones() hace GET al sub-recurso del comunicado', () => {
    api.confirmaciones('c-1').subscribe();
    const req = http.expectOne(`${base}/comunicados/c-1/confirmaciones`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('listar() pide la página indicada de GET /comunicados', () => {
    api.listar({ page: 2, size: 20 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/comunicados`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    req.flush({ contenido: [], paginaActual: 2, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });
});
