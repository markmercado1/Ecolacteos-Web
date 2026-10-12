import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { InsumosApi } from './insumos.api';

const base = environment.apiBaseUrl;

describe('InsumosApi', () => {
  let api: InsumosApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(InsumosApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('crear() envía InsumoRequest exacto', () => {
    api.crear({ nombre: 'Cuajo', unidadMedida: 'unidades' }).subscribe();
    const req = http.expectOne(`${base}/admin/insumos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nombre: 'Cuajo', unidadMedida: 'unidades' });
    req.flush({ id: 'i-1', nombre: 'Cuajo', unidadMedida: 'unidades', activo: true });
  });

  it('actualizar() hace PUT por id', () => {
    api.actualizar('i-1', { nombre: 'Sal', unidadMedida: 'sacos' }).subscribe();
    const req = http.expectOne(`${base}/admin/insumos/i-1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('desactivar() hace DELETE por id', () => {
    api.desactivar('i-1').subscribe();
    const req = http.expectOne(`${base}/admin/insumos/i-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('listarOperativo() usa GET /sync/cambios y extrae solo insumos', () => {
    let resultado: unknown;
    api.listarOperativo().subscribe((r) => (resultado = r));
    const req = http.expectOne(`${base}/sync/cambios`);
    expect(req.request.method).toBe('GET');
    req.flush({
      generadoEn: '2026-09-17T00:00:00Z',
      proveedores: [],
      precioLitroVigente: 1.5,
      comunicados: [],
      prediccionesProveedor: [],
      motivosObservacion: [],
      productos: [],
      unidades: [],
      insumos: [{ id: 'i-1', nombre: 'Cuajo', unidadMedida: 'unidades', activo: true }]
    });
    expect(resultado).toEqual([{ id: 'i-1', nombre: 'Cuajo', unidadMedida: 'unidades', activo: true }]);
  });
});
