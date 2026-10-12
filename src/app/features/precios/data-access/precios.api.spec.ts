import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { PreciosApi } from './precios.api';

const base = environment.apiBaseUrl;

describe('PreciosApi', () => {
  let api: PreciosApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(PreciosApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('crear() envía precio y vigenteDesde exactos por POST', () => {
    api.crear({ precio: 2.3, vigenteDesde: '2026-09-01' }).subscribe();
    const req = http.expectOne(`${base}/admin/precios-litro`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ precio: 2.3, vigenteDesde: '2026-09-01' });
    req.flush({ id: 'pr-1', precio: 2.3, vigenteDesde: '2026-09-01' });
  });

  it('listar() hace GET /admin/precios-litro paginado', () => {
    api.listar({ page: 2, size: 20 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/admin/precios-litro`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    req.flush({ contenido: [], paginaActual: 2, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });

  it('vigente() hace GET /admin/precios-litro/vigente y entrega null si el servidor responde 204', () => {
    let resultado: unknown = 'sin respuesta';
    api.vigente().subscribe((p) => (resultado = p));
    http.expectOne(`${base}/admin/precios-litro/vigente`).flush(null, { status: 204, statusText: 'No Content' });
    expect(resultado).toBeNull();
  });
});
