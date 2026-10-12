import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { KardexApi } from './kardex.api';

const base = `${environment.apiBaseUrl}/inventario`;

describe('KardexApi', () => {
  let api: KardexApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(KardexApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('arma la ruta de cada kardex y envía el período solo si se indica', () => {
    api.kardex('LECHE', null, { page: 0, size: 50 }).subscribe();
    const leche = http.expectOne((r) => r.url === `${base}/kardex/leche`);
    expect(leche.request.params.has('desde')).toBe(false);
    expect(leche.request.params.get('size')).toBe('50');

    api.kardex('INSUMO', 'i1', { page: 1, size: 50, desde: '2026-10-01', hasta: '2026-10-31' }).subscribe();
    const insumo = http.expectOne((r) => r.url === `${base}/kardex/insumos/i1`);
    expect(insumo.request.params.get('desde')).toBe('2026-10-01');
    expect(insumo.request.params.get('hasta')).toBe('2026-10-31');
    expect(insumo.request.params.get('page')).toBe('1');

    api.kardex('PRESENTACION', 'pr1', { page: 0, size: 50 }).subscribe();
    http.expectOne((r) => r.url === `${base}/kardex/presentaciones/pr1`);
  });

  it('ingreso y ajuste de insumo usan POST a su ruta, sin costos', () => {
    api.registrarIngreso('i1', { cantidad: 14, referencia: 'Guía 1' }).subscribe();
    const ingreso = http.expectOne(`${base}/insumos/i1/ingresos`);
    expect(ingreso.request.method).toBe('POST');
    expect(Object.keys(ingreso.request.body)).not.toContain('costo');

    api.ajustarInsumo('i1', { cantidadFisica: 4, motivo: 'Conteo' }).subscribe();
    expect(http.expectOne(`${base}/insumos/i1/ajustes`).request.body).toEqual({ cantidadFisica: 4, motivo: 'Conteo' });

    api.listarInsumos().subscribe();
    expect(http.expectOne(`${base}/insumos`).request.method).toBe('GET');
  });
});
