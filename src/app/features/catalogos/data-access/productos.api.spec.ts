import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ProductosApi } from './productos.api';

const base = environment.apiBaseUrl;

describe('ProductosApi', () => {
  let api: ProductosApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ProductosApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() hace GET /admin/productos', () => {
    api.listar().subscribe();
    const req = http.expectOne(`${base}/admin/productos`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('listarOperativo() hace GET /sync/cambios y devuelve solo el campo productos', () => {
    let resultado: unknown;
    api.listarOperativo().subscribe((r) => (resultado = r));
    const req = http.expectOne(`${base}/sync/cambios`);
    expect(req.request.method).toBe('GET');
    req.flush({ productos: [{ id: 'p-1', nombre: 'Queso Fresco' }], proveedores: [] });
    expect(resultado).toEqual([{ id: 'p-1', nombre: 'Queso Fresco' }]);
  });

  it('crear() hace POST /admin/productos', () => {
    api.crear({ nombre: 'Yogurt de fresa', familiaId: 'f-1' }).subscribe();
    const req = http.expectOne(`${base}/admin/productos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nombre: 'Yogurt de fresa', familiaId: 'f-1' });
    req.flush({ id: 'p-1', nombre: 'Yogurt de fresa', familiaId: 'f-1', familiaNombre: 'Yogurt', rendimientoEsperadoPct: null, cicloCapital: null, activo: true, presentaciones: [] });
  });

  it('desactivar() hace DELETE por id', () => {
    api.desactivar('p-1').subscribe();
    const req = http.expectOne(`${base}/admin/productos/p-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('crearPresentacion() hace POST anidado bajo el producto', () => {
    api.crearPresentacion('p-1', { nombre: 'Botella 1 L', unidadConteo: 'botella' }).subscribe();
    const req = http.expectOne(`${base}/admin/productos/p-1/presentaciones`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'pr-1', productoId: 'p-1', nombre: 'Botella 1 L', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'botella', activo: true });
  });

  it('desactivarPresentacion() hace DELETE anidado bajo el producto', () => {
    api.desactivarPresentacion('p-1', 'pr-1').subscribe();
    const req = http.expectOne(`${base}/admin/productos/p-1/presentaciones/pr-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('reactivarPresentacion() hace PATCH a /reactivar anidado bajo el producto', () => {
    api.reactivarPresentacion('p-1', 'pr-1').subscribe();
    const req = http.expectOne(`${base}/admin/productos/p-1/presentaciones/pr-1/reactivar`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ id: 'pr-1', productoId: 'p-1', nombre: 'Botella 1 L', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'botella', activo: true });
  });

  it('subirFotoProducto() hace PUT multipart con el archivo en el campo "file"', () => {
    const archivo = new File([new Uint8Array(3)], 'foto.jpg', { type: 'image/jpeg' });
    api.subirFotoProducto('p-1', archivo).subscribe();
    const req = http.expectOne(`${base}/admin/productos/p-1/foto`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('file')).toBeInstanceOf(File);
    req.flush({ id: 'p-1', fotoUrl: '/api/catalogo/fotos/x.jpg' });
  });

  it('quitarFotoProducto() hace DELETE anidado', () => {
    api.quitarFotoProducto('p-1').subscribe();
    const req = http.expectOne(`${base}/admin/productos/p-1/foto`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ id: 'p-1', fotoUrl: null });
  });

  it('subirFotoPresentacion() y quitarFotoPresentacion() usan la ruta anidada de la presentación', () => {
    const archivo = new File([new Uint8Array(3)], 'foto.png', { type: 'image/png' });
    api.subirFotoPresentacion('p-1', 'pr-1', archivo).subscribe();
    const subida = http.expectOne(`${base}/admin/productos/p-1/presentaciones/pr-1/foto`);
    expect(subida.request.method).toBe('PUT');
    expect((subida.request.body as FormData).get('file')).toBeInstanceOf(File);
    subida.flush({ id: 'pr-1' });

    api.quitarFotoPresentacion('p-1', 'pr-1').subscribe();
    const baja = http.expectOne(`${base}/admin/productos/p-1/presentaciones/pr-1/foto`);
    expect(baja.request.method).toBe('DELETE');
    baja.flush({ id: 'pr-1' });
  });
});
