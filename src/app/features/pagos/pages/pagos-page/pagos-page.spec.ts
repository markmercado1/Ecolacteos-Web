import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { TokenStoreService } from '../../../../core/auth/token-store.service';
import { UsuarioMeResponse } from '../../../../core/auth/auth.models';
import { PaginaResponse } from '../../../../shared/models/pagina-response';
import { PagoResponse } from '../../data-access/pago.models';
import { PagoDetalleDialog } from '../../ui/pago-detalle-dialog/pago-detalle-dialog';
import { PagosPage } from './pagos-page';

const base = environment.apiBaseUrl;

const paginaVacia: PaginaResponse<PagoResponse> = { contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 };

function pago(id: string): PagoResponse {
  return {
    id, proveedorId: 'p-1', proveedorNombre: 'Juan', semanaInicio: '2026-09-07', semanaFin: '2026-09-13',
    litrosTotales: 100, precioLitro: 1.5, total: 150, comprobanteGenerado: false, registroAcopioIds: [],
    precioLitroEfectivo: 1.5, totalAPagar: 150, ajusteCalidad: 0
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
    req.flush([{ id: 'aj-1', pagoId: 'pg-1', registroAcopioId: 'r-1', correccionRegistroId: 'c-1', litrosDiferencia: 2, precioLitro: 2.3, monto: 4.6, estado: 'PENDIENTE', creadoEn: '2026-09-16', precioLitroAlCrear: 2.3, montoAlCrear: 4.6 }]);

    expect(page['ajustesPendientes']().length).toBe(1);
    expect(page['consultado']()).toBe(true);
  });

  it('el detalle recibe si el rol puede ver el historial de precios de calidad (ADMIN y RECEPCION sí)', () => {
    for (const rol of ['ADMIN', 'RECEPCION'] as const) {
      TestBed.resetTestingModule();
      const abrir = vi.fn(() => ({ closed: of(false) }));
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: Dialog, useValue: { open: abrir } }]
      });
      http = TestBed.inject(HttpTestingController);
      tokenStore = TestBed.inject(TokenStoreService);
      tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon(rol) });
      const page = TestBed.createComponent(PagosPage).componentInstance;
      http.expectOne(`${base}/proveedores/operativo`).flush([]);
      http.expectOne((r) => r.url === `${base}/pagos`).flush(paginaVacia);

      page['verDetalle'](pago('pg-1'));

      expect(abrir).toHaveBeenCalledWith(PagoDetalleDialog, expect.objectContaining({
        data: { pago: pago('pg-1'), esAdmin: rol === 'ADMIN', puedeVerHistorialCalidad: true }
      }));
      http.verify();
    }
  });

  it('la lista marca con texto los pagos con precios de calidad y no los demás', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(PagosPage);
    http.expectOne(`${base}/proveedores/operativo`).flush([]);
    http.expectOne((r) => r.url === `${base}/pagos`).flush({
      contenido: [{ ...pago('pg-1'), ajusteCalidad: -10, totalAPagar: 140 }, pago('pg-2')],
      paginaActual: 0, tamanoPagina: 20, totalElementos: 2, totalPaginas: 1
    });
    f.detectChanges();

    const filas = Array.from((f.nativeElement as HTMLElement).querySelectorAll('tbody tr')) as HTMLElement[];
    expect(filas.length).toBe(2);
    expect(filas[0].textContent).toContain('Con calidad');
    expect(filas[0].textContent).toContain('S/ 140.00');
    expect(filas[1].textContent).not.toContain('Con calidad');
  });

  it('los ajustes pendientes muestran su estado y el precio vigente que informa el servidor', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(PagosPage);
    http.expectOne(`${base}/proveedores/operativo`).flush([]);
    http.expectOne((r) => r.url === `${base}/pagos`).flush(paginaVacia);
    f.componentInstance['pestana'].set('ajustes');
    f.componentInstance['proveedorAjustes'].set('p-1');
    f.componentInstance['consultarAjustes']();
    http.expectOne((r) => r.url === `${base}/pagos/ajustes/pendientes`).flush([
      { id: 'aj-1', pagoId: 'pg-1', registroAcopioId: 'r-1', correccionRegistroId: 'c-1', litrosDiferencia: -5, precioLitro: 0.9, monto: -4.5, estado: 'PENDIENTE',
        creadoEn: '2026-09-16', precioLitroAlCrear: 1, montoAlCrear: -5 }
    ]);
    f.detectChanges();

    const monto = (f.nativeElement as HTMLElement).querySelector('[data-testid="ajuste-pendiente-monto"]')!;
    expect(monto.textContent).toContain('-4.50');
    expect(monto.textContent).toContain('PENDIENTE');
    expect(monto.textContent).toContain('Precio vigente S/ 0.90');
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
