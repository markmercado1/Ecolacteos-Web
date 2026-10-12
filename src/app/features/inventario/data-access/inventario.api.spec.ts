import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { InventarioApi } from './inventario.api';

const base = environment.apiBaseUrl;

describe('InventarioApi', () => {
  let api: InventarioApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(InventarioApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('obtenerStock() hace GET a /inventario/stock', () => {
    api.obtenerStock().subscribe();
    const req = http.expectOne(`${base}/inventario/stock`);
    expect(req.request.method).toBe('GET');
    req.flush([{ productoId: 'tq-1', producto: 'Fresco', unidadesDisponibles: 90 }]);
  });

  it('obtenerSaldoLeche() hace GET a /inventario/leche/saldo', () => {
    let resultado: { litrosDisponibles: number } | undefined;
    api.obtenerSaldoLeche().subscribe((r) => (resultado = r));
    const req = http.expectOne(`${base}/inventario/leche/saldo`);
    expect(req.request.method).toBe('GET');
    req.flush({ litrosDisponibles: 150.5 });
    expect(resultado).toEqual({ litrosDisponibles: 150.5 });
  });

  it('obtenerExistencias() hace GET a /inventario/presentaciones/{id}/existencias', () => {
    let vendible: number | undefined;
    api.obtenerExistencias('pres-1').subscribe((r) => (vendible = r.stockVendible));
    const req = http.expectOne(`${base}/inventario/presentaciones/pres-1/existencias`);
    expect(req.request.method).toBe('GET');
    req.flush({
      presentacionId: 'pres-1', controlaVencimiento: true, stockFisico: 100, stockVendible: 70, stockVencido: 10,
      stockSinTrazabilidad: 20, fechaReferencia: '2026-10-11', lotes: []
    });
    expect(vendible).toBe(70);
  });

  it('listarAjustes() pide una página del historial de una presentación', () => {
    api.listarAjustes('pres-1', { page: 1, size: 10 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/inventario/ajustes`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('presentacionId')).toBe('pres-1');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('10');
    req.flush({ contenido: [], paginaActual: 1, tamanoPagina: 10, totalElementos: 0, totalPaginas: 0 });
  });
});
