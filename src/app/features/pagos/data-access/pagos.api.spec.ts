import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { PagosApi } from './pagos.api';

const base = environment.apiBaseUrl;

describe('PagosApi', () => {
  let api: PagosApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(PagosApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('generar() envía GenerarPagoRequest exacto por POST', () => {
    api.generar({ proveedorId: 'p-1', semanaInicio: '2026-09-01', semanaFin: '2026-09-07' }).subscribe();
    const req = http.expectOne(`${base}/pagos/generar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ proveedorId: 'p-1', semanaInicio: '2026-09-01', semanaFin: '2026-09-07' });
    req.flush({});
  });

  it('marcarComprobante() hace PATCH sin cuerpo relevante', () => {
    api.marcarComprobante('pg-1').subscribe();
    const req = http.expectOne(`${base}/pagos/pg-1/comprobante`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('ajustesPendientes() exige proveedorId como query param', () => {
    api.ajustesPendientes('p-1').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/pagos/ajustes/pendientes`);
    expect(req.request.params.get('proveedorId')).toBe('p-1');
    req.flush([]);
  });

  it('liquidarAjuste() hace PATCH por id', () => {
    api.liquidarAjuste('aj-1').subscribe();
    const req = http.expectOne(`${base}/pagos/ajustes/aj-1/liquidar`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('listar() pide la página indicada de GET /pagos', () => {
    api.listar({ page: 1, size: 20 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/pagos`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('20');
    req.flush({ contenido: [], paginaActual: 1, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });

  it('historialPorProveedor() usa la variante /paginado (la lista completa queda para la app móvil)', () => {
    api.historialPorProveedor('p-1', { page: 0, size: 10 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/pagos/proveedor/p-1/paginado`);
    expect(req.request.params.get('size')).toBe('10');
    req.flush({ contenido: [], paginaActual: 0, tamanoPagina: 10, totalElementos: 0, totalPaginas: 0 });
  });
});
