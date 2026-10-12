import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { PreciosQuesoApi } from './precios-queso.api';

const base = environment.apiBaseUrl;

describe('PreciosQuesoApi', () => {
  let api: PreciosQuesoApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(PreciosQuesoApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() sin argumentos hace GET a /admin/precios-queso sin filtrar (histórico completo)', () => {
    api.listar().subscribe();
    const req = http.expectOne(`${base}/admin/precios-queso`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('presentacionId')).toBe(false);
    req.flush([]);
  });

  it('listar(presentacionId) filtra al histórico de esa sola presentación', () => {
    api.listar('pres-9').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/admin/precios-queso`);
    expect(req.request.params.get('presentacionId')).toBe('pres-9');
    req.flush([]);
  });

  it('listarPaginado() hace GET paginado a /admin/precios-queso/presentaciones con familiaId y busqueda opcionales', () => {
    api.listarPaginado({ page: 1, size: 10, familiaId: 'fam-1', busqueda: 'botella' }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('familiaId')).toBe('fam-1');
    expect(req.request.params.get('busqueda')).toBe('botella');
    req.flush({ contenido: [], paginaActual: 1, tamanoPagina: 10, totalElementos: 0, totalPaginas: 0 });
  });

  it('listarPaginado() sin familiaId/busqueda no envía esos parámetros', () => {
    api.listarPaginado({ page: 0, size: 20 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`);
    expect(req.request.params.has('familiaId')).toBe(false);
    expect(req.request.params.has('busqueda')).toBe(false);
    req.flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });

  it('crear() envía exactamente los cuatro campos del contrato, identificando la presentación (no el producto)', () => {
    const datos = { presentacionId: 'pres-1', modalidad: 'PUBLICO' as const, precio: 15, vigenteDesde: '2026-09-18' };
    api.crear(datos).subscribe();
    const req = http.expectOne(`${base}/admin/precios-queso`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(datos);
    req.flush({
      id: 'pq-1',
      presentacionId: 'pres-1',
      presentacionNombre: 'Botella 1 L',
      productoId: 'p-1',
      productoNombre: 'Fresco',
      modalidad: 'PUBLICO',
      precio: 15,
      vigenteDesde: '2026-09-18'
    });
  });
});
