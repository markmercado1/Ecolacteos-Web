import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { etiquetaEstadoSaldo, etiquetaModalidad, exigeDatosBancarios } from './pago-proveedor.models';
import { PagosProveedorApi } from './pagos-proveedor.api';

const base = `${environment.apiBaseUrl}/pagos-proveedor`;

describe('PagosProveedorApi', () => {
  let api: PagosProveedorApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(PagosProveedorApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('registrar() envía la solicitud exacta por POST (incluido el uuidCliente y las aplicaciones)', () => {
    const solicitud = {
      uuidCliente: 'u-1', proveedorId: 'p-1', modalidad: 'TRANSFERENCIA' as const, monto: 120, banco: 'BCP', nroOperacion: 'OP-1',
      aplicaciones: [{ pagoId: 'pg-1', monto: 120 }]
    };
    api.registrar(solicitud).subscribe();
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(solicitud);
    req.flush({});
  });

  it('listar() pagina y solo envía los filtros que tienen valor', () => {
    api.listar({ page: 2, size: 10, proveedorId: 'p-1', estado: 'ANULADO', busqueda: '  OP-9 ' }).subscribe();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('proveedorId')).toBe('p-1');
    expect(req.request.params.get('estado')).toBe('ANULADO');
    expect(req.request.params.get('busqueda')).toBe('OP-9');
    req.flush({});

    api.listar({ page: 0, size: 20, estado: '', busqueda: '   ' }).subscribe();
    const sin = http.expectOne((r) => r.url === base);
    expect(sin.request.params.has('estado')).toBe(false);
    expect(sin.request.params.has('busqueda')).toBe(false);
    expect(sin.request.params.has('proveedorId')).toBe(false);
    sin.flush({});
  });

  it('obtener(), aplicar() y anular() usan la URL del pago (codificada) y el cuerpo esperado', () => {
    api.obtener('a b').subscribe();
    http.expectOne(`${base}/a%20b`).flush({});

    api.aplicar('pp-1', [{ pagoId: 'pg-1', monto: 50 }]).subscribe();
    const aplicar = http.expectOne(`${base}/pp-1/aplicaciones`);
    expect(aplicar.request.method).toBe('POST');
    expect(aplicar.request.body).toEqual({ aplicaciones: [{ pagoId: 'pg-1', monto: 50 }] });
    aplicar.flush({});

    api.anular('pp-1', 'Monto mal digitado').subscribe();
    const anular = http.expectOne(`${base}/pp-1/anular`);
    expect(anular.request.method).toBe('POST');
    expect(anular.request.body).toEqual({ motivo: 'Monto mal digitado' });
    anular.flush({});
  });

  it('saldos() pide varias liquidaciones separadas por coma y saldoDelProveedor() lee el saldo del proveedor', () => {
    api.saldos(['a', 'b']).subscribe();
    const saldos = http.expectOne((r) => r.url === `${base}/saldos`);
    expect(saldos.request.params.get('pagoIds')).toBe('a,b');
    saldos.flush([]);

    api.saldoDelProveedor('p 1').subscribe();
    http.expectOne(`${base}/proveedor/p%201/saldo`).flush({});
  });
});

describe('etiquetas de pagos a proveedores', () => {
  it('traducen modalidad y estado del saldo, y dejan pasar un valor desconocido sin inventarlo', () => {
    expect(etiquetaModalidad('DEPOSITO')).toBe('Depósito');
    expect(etiquetaModalidad('CHEQUE')).toBe('CHEQUE');
    expect(etiquetaEstadoSaldo('PARCIAL')).toBe('Pago parcial');
    expect(etiquetaEstadoSaldo('SALDO_A_FAVOR')).toBe('Saldo a favor');
    expect(etiquetaEstadoSaldo('RARO')).toBe('RARO');
  });

  it('solo el efectivo no exige datos bancarios', () => {
    expect(exigeDatosBancarios('EFECTIVO')).toBe(false);
    expect(exigeDatosBancarios('TRANSFERENCIA')).toBe(true);
    expect(exigeDatosBancarios('DEPOSITO')).toBe(true);
  });
});
