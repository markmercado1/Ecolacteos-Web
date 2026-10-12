import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { RecetasApi } from './recetas.api';

const base = environment.apiBaseUrl;

describe('RecetasApi', () => {
  let api: RecetasApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(RecetasApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() pide solo activas por defecto e incluye inactivas cuando se indica', () => {
    api.listar().subscribe();
    expect(http.expectOne((r) => r.url === `${base}/recetas`).request.params.get('incluirInactivas')).toBe('false');
    api.listar(true).subscribe();
    expect(http.expectOne((r) => r.url === `${base}/recetas`).request.params.get('incluirInactivas')).toBe('true');
  });

  it('calcular() consulta GET /recetas/{id}/calculo?litros=', () => {
    api.calcular('r1', 1000).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/recetas/r1/calculo`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('litros')).toBe('1000');
    req.flush({});
  });

  it('crear/actualizar/desactivar/reactivar usan el verbo y la ruta del contrato', () => {
    const datos = { nombre: 'R', productoId: 'p', presentacionId: 'pr', litrosBase: 100, rendimientoBase: 1, insumos: [] };
    api.crear(datos).subscribe();
    expect(http.expectOne(`${base}/recetas`).request.method).toBe('POST');
    api.actualizar('r1', datos).subscribe();
    expect(http.expectOne(`${base}/recetas/r1`).request.method).toBe('PUT');
    api.desactivar('r1').subscribe();
    expect(http.expectOne(`${base}/recetas/r1`).request.method).toBe('DELETE');
    api.reactivar('r1').subscribe();
    expect(http.expectOne(`${base}/recetas/r1/reactivar`).request.method).toBe('PATCH');
  });
});
