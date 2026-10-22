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

  it('ajustarPrecio() hace POST del precio nuevo y el motivo sobre ese pago', () => {
    api.ajustarPrecio('pg-1', { precioLitroNuevo: 1.2, motivo: 'Reconocimiento por calidad' }).subscribe();
    const req = http.expectOne(`${base}/pagos/pg-1/ajuste-precio`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ precioLitroNuevo: 1.2, motivo: 'Reconocimiento por calidad' });
    req.flush({});
  });

  it('ajustesDePrecio() lee el historial de cambios de precio del pago', () => {
    api.ajustesDePrecio('pg-1').subscribe();
    const req = http.expectOne(`${base}/pagos/pg-1/ajustes-precio`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('boleta() pide el PDF como blob por GET', () => {
    let recibido: Blob | undefined;
    api.boleta('pg-1').subscribe((b) => (recibido = b));
    const req = http.expectOne(`${base}/pagos/pg-1/boleta`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect(recibido?.type).toBe('application/pdf');
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

  it('listar() envía la búsqueda recortada solo si hay texto', () => {
    api.listar({ page: 0, size: 20, busqueda: '  huaman ' }).subscribe();
    const con = http.expectOne((r) => r.url === `${base}/pagos`);
    expect(con.request.params.get('busqueda')).toBe('huaman');
    con.flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });

    api.listar({ page: 0, size: 20, busqueda: '   ' }).subscribe();
    const sin = http.expectOne((r) => r.url === `${base}/pagos`);
    expect(sin.request.params.has('busqueda')).toBe(false);
    sin.flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });

  it('historialPorProveedor() usa la variante /paginado (la lista completa queda para la app móvil)', () => {
    api.historialPorProveedor('p-1', { page: 0, size: 10 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/pagos/proveedor/p-1/paginado`);
    expect(req.request.params.get('size')).toBe('10');
    req.flush({ contenido: [], paginaActual: 0, tamanoPagina: 10, totalElementos: 0, totalPaginas: 0 });
  });
});
