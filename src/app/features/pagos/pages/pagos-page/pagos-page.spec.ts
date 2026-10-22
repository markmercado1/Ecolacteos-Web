import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { TokenStoreService } from '../../../../core/auth/token-store.service';
import { UsuarioMeResponse } from '../../../../core/auth/auth.models';
import { PaginaResponse } from '../../../../shared/models/pagina-response';
import { PagoResponse } from '../../data-access/pago.models';
import { PagosPage } from './pagos-page';

const base = environment.apiBaseUrl;

const paginaVacia: PaginaResponse<PagoResponse> = { contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 };

function pago(id: string): PagoResponse {
  return {
    id, proveedorId: 'p-1', proveedorNombre: 'Juan', semanaInicio: '2026-09-07', semanaFin: '2026-09-13',
    litrosTotales: 100, precioLitro: 1.5, total: 150, comprobanteGenerado: false, registroAcopioIds: [],
    precioLitroEfectivo: 1.5, totalAPagar: 150
  };
}

function usuarioCon(rolNombre: UsuarioMeResponse['rolNombre']): UsuarioMeResponse {
  return { id: 'u-1', nombre: 'Ana', email: 'ana@ecolacteos.pe', rolNombre, activo: true, unidadesResponsable: [] };
}

describe('PagosPage', () => {
  let http: HttpTestingController;
  let tokenStore: TokenStoreService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    tokenStore = TestBed.inject(TokenStoreService);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('esAdmin() es true solo para el rol ADMIN', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const page = TestBed.createComponent(PagosPage).componentInstance;
    http.expectOne(`${base}/proveedores/operativo`).flush([]);
    http.expectOne((r) => r.url === `${base}/pagos`).flush(paginaVacia);

    expect(page['esAdmin']()).toBe(true);
  });

  it('esAdmin() es false para RECEPCION, que solo puede leer', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('RECEPCION') });
    const page = TestBed.createComponent(PagosPage).componentInstance;
    http.expectOne(`${base}/proveedores/operativo`).flush([]);
    http.expectOne((r) => r.url === `${base}/pagos`).flush(paginaVacia);

    expect(page['esAdmin']()).toBe(false);
  });

  it('consultarAjustes() pide los ajustes del proveedor seleccionado', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const page = TestBed.createComponent(PagosPage).componentInstance;
    http.expectOne(`${base}/proveedores/operativo`).flush([]);
    http.expectOne((r) => r.url === `${base}/pagos`).flush(paginaVacia);

    page['proveedorAjustes'].set('p-1');
    page['consultarAjustes']();
    const req = http.expectOne((r) => r.url === `${base}/pagos/ajustes/pendientes`);
    expect(req.request.params.get('proveedorId')).toBe('p-1');
    req.flush([{ id: 'aj-1', pagoId: 'pg-1', registroAcopioId: 'r-1', correccionRegistroId: 'c-1', litrosDiferencia: 2, precioLitro: 2.3, monto: 4.6, estado: 'PENDIENTE', creadoEn: '2026-09-16' }]);

    expect(page['ajustesPendientes']().length).toBe(1);
    expect(page['consultado']()).toBe(true);
  });

  describe('paginación', () => {
    let page: PagosPage;

    beforeEach(() => {
      tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
      page = TestBed.createComponent(PagosPage).componentInstance;
      http.expectOne(`${base}/proveedores/operativo`).flush([]);
      const req = http.expectOne((r) => r.url === `${base}/pagos`);
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('20');
      req.flush({ contenido: [pago('pg-1')], paginaActual: 0, tamanoPagina: 20, totalElementos: 45, totalPaginas: 3 });
    });

    it('guarda los totales del servidor, no el tamaño de la página visible', () => {
      expect(page['pagos']().length).toBe(1);
      expect(page['totalElementos']()).toBe(45);
      expect(page['totalPaginas']()).toBe(3);
    });

    it('cambiarPagina pide la página indicada y no sale del rango', () => {
      page['cambiarPagina'](1);
      const req = http.expectOne((r) => r.url === `${base}/pagos`);
      expect(req.request.params.get('page')).toBe('1');
      req.flush({ contenido: [pago('pg-2')], paginaActual: 1, tamanoPagina: 20, totalElementos: 45, totalPaginas: 3 });

      page['cambiarPagina'](-1);
      page['cambiarPagina'](3);
      http.expectNone((r) => r.url === `${base}/pagos`);
      expect(page['pagina']()).toBe(1);
    });

    it('buscar manda el texto al servidor y vuelve a la página 0; vaciar lo quita', () => {
      page['cambiarPagina'](1);
      http.expectOne((r) => r.url === `${base}/pagos`).flush({ contenido: [], paginaActual: 1, tamanoPagina: 20, totalElementos: 45, totalPaginas: 3 });

      page['buscar']('huaman');
      const req = http.expectOne((r) => r.url === `${base}/pagos`);
      expect(req.request.params.get('busqueda')).toBe('huaman');
      expect(req.request.params.get('page')).toBe('0');
      req.flush({ contenido: [pago('pg-9')], paginaActual: 0, tamanoPagina: 20, totalElementos: 1, totalPaginas: 1 });

      page['buscar']('');
      const sin = http.expectOne((r) => r.url === `${base}/pagos`);
      expect(sin.request.params.has('busqueda')).toBe(false);
      sin.flush(paginaVacia);
    });

    it('cambiarTamano pide la primera página con el nuevo tamaño', () => {
      page['cambiarTamano'](50);
      const req = http.expectOne((r) => r.url === `${base}/pagos`);
      expect(req.request.params.get('size')).toBe('50');
      expect(req.request.params.get('page')).toBe('0');
      req.flush(paginaVacia);
    });

    it('si la página quedó fuera de rango vuelve a pedir la última válida', () => {
      page['pagina'].set(2);
      page['cargar']();
      http.expectOne((r) => r.url === `${base}/pagos` && r.params.get('page') === '2')
        .flush({ contenido: [], paginaActual: 2, tamanoPagina: 20, totalElementos: 40, totalPaginas: 2 });

      const reintento = http.expectOne((r) => r.url === `${base}/pagos`);
      expect(reintento.request.params.get('page')).toBe('1');
      reintento.flush({ contenido: [pago('pg-40')], paginaActual: 1, tamanoPagina: 20, totalElementos: 40, totalPaginas: 2 });
      expect(page['pagina']()).toBe(1);
      expect(page['pagos']().length).toBe(1);
    });

    it('un error de carga queda expuesto y deja de cargar', () => {
      page['cambiarPagina'](1);
      http.expectOne((r) => r.url === `${base}/pagos`).flush({ mensaje: 'boom' }, { status: 500, statusText: 'Error' });
      expect(page['error']()).not.toBeNull();
      expect(page['cargando']()).toBe(false);
    });
  });
});
