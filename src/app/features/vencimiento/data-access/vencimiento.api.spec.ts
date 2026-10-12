import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { VencimientoApi } from './vencimiento.api';

const base = environment.apiBaseUrl;

describe('VencimientoApi', () => {
  let api: VencimientoApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(VencimientoApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('productosConControl() hace GET a /control-vencimiento/productos', () => {
    let ids: string[] | undefined;
    api.productosConControl().subscribe((r) => (ids = r.productoIds));
    const req = http.expectOne(`${base}/control-vencimiento/productos`);
    expect(req.request.method).toBe('GET');
    req.flush({ productoIds: ['p-1', 'p-2'] });
    expect(ids).toEqual(['p-1', 'p-2']);
  });

  it('activar() hace PUT sin cuerpo y desactivar() hace DELETE sobre /admin/productos/{id}/control-vencimiento', () => {
    api.activar('p-1').subscribe();
    const put = http.expectOne(`${base}/admin/productos/p-1/control-vencimiento`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toBeNull();
    put.flush({ productoId: 'p-1', controlaVencimiento: true, presentaciones: [] });

    api.desactivar('p-1').subscribe();
    const del = http.expectOne(`${base}/admin/productos/p-1/control-vencimiento`);
    expect(del.request.method).toBe('DELETE');
    del.flush({ productoId: 'p-1', controlaVencimiento: false, presentaciones: [] });
  });

  it('regularizar() hace POST a /admin/presentaciones/{id}/regularizaciones con cantidad, fecha y motivo', () => {
    api.regularizar('pr-1', { cantidad: 15, fechaVencimiento: '2026-11-20', motivo: 'Etiqueta' }).subscribe();
    const req = http.expectOne(`${base}/admin/presentaciones/pr-1/regularizaciones`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ cantidad: 15, fechaVencimiento: '2026-11-20', motivo: 'Etiqueta' });
    req.flush({});
  });
});
