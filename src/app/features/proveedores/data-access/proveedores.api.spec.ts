import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ProveedoresApi } from './proveedores.api';

const base = environment.apiBaseUrl;

describe('ProveedoresApi', () => {
  let api: ProveedoresApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ProveedoresApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() envía page/size siempre y omite zonaId/activo si no se piden', () => {
    api.listar({ page: 0, size: 20 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/proveedores`);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.has('zonaId')).toBe(false);
    expect(req.request.params.has('activo')).toBe(false);
    req.flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });

  it('listar() incluye zonaId y activo cuando se filtran', () => {
    api.listar({ page: 1, size: 20, zonaId: 'z-1', activo: true }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/proveedores`);
    expect(req.request.params.get('zonaId')).toBe('z-1');
    expect(req.request.params.get('activo')).toBe('true');
    req.flush({ contenido: [], paginaActual: 1, tamanoPagina: 20, totalElementos: 0, totalPaginas: 1 });
  });

  it('reasignarZona() hace PUT a /zona con zonaId como query param, sin cuerpo', () => {
    api.reasignarZona('p-1', 'z-2').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/proveedores/p-1/zona`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.params.get('zonaId')).toBe('z-2');
    expect(req.request.body).toBeNull();
    req.flush({});
  });

  it('reasignarZona() envía el motivo recortado cuando existe y no lo envía si falta o está en blanco', () => {
    api.reasignarZona('p-1', 'z-2', '  Cambió su ruta  ').subscribe();
    const conMotivo = http.expectOne((r) => r.url === `${base}/proveedores/p-1/zona`);
    expect(conMotivo.request.params.get('motivo')).toBe('Cambió su ruta');
    conMotivo.flush({});

    api.reasignarZona('p-1', 'z-2', '   ').subscribe();
    const sinMotivo = http.expectOne((r) => r.url === `${base}/proveedores/p-1/zona`);
    expect(sinMotivo.request.params.has('motivo')).toBe(false);
    sinMotivo.flush({});
  });

  it('obtenerPorCodigoQr() codifica el código en la URL', () => {
    api.obtenerPorCodigoQr('PRV 001').subscribe();
    const req = http.expectOne(`${base}/proveedores/qr/PRV%20001`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'p-1', nombre: 'x', zonaActualId: null, zonaActualNombre: null, codigoQr: 'PRV 001' });
  });

  it('actualizar() no envía zona en el cuerpo (ProveedorUpdateRequest)', () => {
    api.actualizar('p-1', { nombre: 'Ana', dni: '123', telefono: null }).subscribe();
    const req = http.expectOne(`${base}/proveedores/p-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nombre: 'Ana', dni: '123', telefono: null });
    req.flush({});
  });

  it('listar() envía la búsqueda recortada y la omite si está en blanco', () => {
    api.listar({ page: 0, size: 20, busqueda: '  Rosa ' }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/proveedores`);
    expect(req.request.params.get('busqueda')).toBe('Rosa');
    req.flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });

    api.listar({ page: 0, size: 20, busqueda: '   ' }).subscribe();
    const sinBusqueda = http.expectOne((r) => r.url === `${base}/proveedores`);
    expect(sinBusqueda.request.params.has('busqueda')).toBe(false);
    sinBusqueda.flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });
});
