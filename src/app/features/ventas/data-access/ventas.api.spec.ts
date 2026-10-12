import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { VentasApi } from './ventas.api';

const base = environment.apiBaseUrl;

describe('VentasApi', () => {
  let api: VentasApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(VentasApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() envía page/size siempre y omite fecha/tipoCliente si no se piden', () => {
    api.listar({ page: 0, size: 20 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/ventas`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.has('fecha')).toBe(false);
    expect(req.request.params.has('tipoCliente')).toBe(false);
    req.flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });

  it('listar() incluye fecha y tipoCliente cuando se filtran, y reinicia page a 0 si así se pide', () => {
    api.listar({ page: 0, size: 20, fecha: '2026-09-17', tipoCliente: 'MAYORISTA' }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/ventas`);
    expect(req.request.params.get('fecha')).toBe('2026-09-17');
    expect(req.request.params.get('tipoCliente')).toBe('MAYORISTA');
    req.flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });

  it('obtener() hace GET por id', () => {
    api.obtener('v-1').subscribe();
    const req = http.expectOne(`${base}/ventas/v-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('crearCarrito() hace POST a /ventas/carrito con uuidCliente, fecha, tipoCliente y detalles', () => {
    const datos = {
      uuidCliente: 'uuid-1',
      fecha: '2026-09-17',
      tipoCliente: 'PUBLICO' as const,
      detalles: [
        { presentacionId: 'pres-1', cantidad: 3 },
        { presentacionId: 'pres-2', cantidad: 1 }
      ]
    };
    api.crearCarrito(datos).subscribe();
    const req = http.expectOne(`${base}/ventas/carrito`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(datos);
    req.flush({
      id: 'v-1', fecha: '2026-09-17', tipoCliente: 'PUBLICO',
      detalles: [
        { presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoNombre: 'Yogurt', cantidad: 3, precioUnitario: 10, subtotal: 30 },
        { presentacionId: 'pres-2', presentacionNombre: 'Unidad', productoNombre: 'Queso', cantidad: 1, precioUnitario: 12, subtotal: 12 }
      ],
      total: 42
    });
  });

  it('precioVigente() hace GET con presentacionId, tipoCliente y fecha como query params', () => {
    api.precioVigente('pres-1', 'MAYORISTA', '2026-09-17').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/ventas/precio-vigente`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('presentacionId')).toBe('pres-1');
    expect(req.request.params.get('tipoCliente')).toBe('MAYORISTA');
    expect(req.request.params.get('fecha')).toBe('2026-09-17');
    req.flush({ id: 'p-1', presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoId: 'prod-1', productoNombre: 'Yogurt', modalidad: 'MAYORISTA', precio: 13.5, vigenteDesde: '2026-09-01' });
  });
});
