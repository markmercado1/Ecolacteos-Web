import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { UsuarioMeResponse } from '../../../../core/auth/auth.models';
import { TokenStoreService } from '../../../../core/auth/token-store.service';
import { CampoUnicoDialog } from '../../../../shared/ui/dialog/campo-unico-dialog';
import { PagoProveedorResponse } from '../../data-access/pago-proveedor.models';
import { AplicarPagoProveedorDialog } from '../../ui/aplicar-pago-proveedor-dialog/aplicar-pago-proveedor-dialog';
import { PagoProveedorDetalleDialog } from '../../ui/pago-proveedor-detalle-dialog/pago-proveedor-detalle-dialog';
import { RegistrarPagoProveedorDialog } from '../../ui/registrar-pago-proveedor-dialog/registrar-pago-proveedor-dialog';
import { PagosEfectivosPage } from './pagos-efectivos-page';

const base = environment.apiBaseUrl;
const url = `${base}/pagos-proveedor`;

const pago = (extra: Partial<PagoProveedorResponse> = {}): PagoProveedorResponse => ({
  id: 'pp-1', uuidCliente: 'u', proveedorId: 'p-1', proveedorNombre: 'Alejandro Terrones', fechaHora: '2026-10-22T14:05:00', modalidad: 'TRANSFERENCIA', monto: 350,
  concepto: null, banco: 'BCP', nroOperacion: 'OP-77', nroRecibo: null, observacion: null, usuarioNombre: 'Recepción Uno', estado: 'REGISTRADO',
  anuladoMotivo: null, anuladoPorNombre: null, anuladoEn: null, aplicado: 0, sinAplicar: 350, aplicaciones: [], ...extra
});

const pagina = (contenido: PagoProveedorResponse[]) => ({ contenido, paginaActual: 0, tamanoPagina: 20, totalElementos: contenido.length, totalPaginas: contenido.length ? 1 : 0 });

function usuarioCon(rolNombre: UsuarioMeResponse['rolNombre']): UsuarioMeResponse {
  return { id: 'u-1', nombre: 'Ana', email: 'ana@ecolacteos.pe', rolNombre, activo: true, unidadesResponsable: [] };
}

function crear(rol: UsuarioMeResponse['rolNombre'], contenido: PagoProveedorResponse[], dialogOpen = vi.fn()) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: Dialog, useValue: { open: dialogOpen } }]
  });
  TestBed.inject(TokenStoreService).establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon(rol) });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(PagosEfectivosPage);
  http.expectOne(`${base}/proveedores/operativo`).flush([{ id: 'p-1', nombre: 'Alejandro Terrones' }]);
  http.expectOne((r) => r.url === url).flush(pagina(contenido));
  f.detectChanges();
  return { f, http, dialogOpen };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const filas = (f: ComponentFixture<unknown>) => Array.from(el(f).querySelectorAll('tbody tr')) as HTMLElement[];
const enlace = (fila: HTMLElement, texto: string) => Array.from(fila.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto);
const comp = (f: ComponentFixture<PagosEfectivosPage>) => f.componentInstance as unknown as Record<string, any>;

describe('PagosEfectivosPage', () => {
  afterEach(() => localStorage.clear());

  it('lista los pagos con modalidad, operación, monto, lo aplicado y el adelanto sin aplicar', () => {
    const { f, http } = crear('ADMIN', [pago(), pago({ id: 'pp-2', modalidad: 'EFECTIVO', banco: null, nroOperacion: null, aplicado: 100, sinAplicar: 0, monto: 100 })]);
    const t = filas(f).map((r) => (r.textContent ?? '').replace(/\s+/g, ' '));
    expect(t.length).toBe(2);
    expect(t[0]).toContain('22/10/2026 14:05');
    expect(t[0]).toContain('Transferencia');
    expect(t[0]).toContain('BCP · OP-77');
    expect(t[0]).toContain('S/ 350.00');
    expect(t[0]).toContain('Adelanto: S/ 350.00 sin aplicar');
    expect(t[0]).toContain('Vigente');
    expect(t[1]).toContain('Efectivo');
    expect(t[1]).not.toContain('Adelanto');
    http.verify();
  });

  it('«Aplicar» solo en pagos vigentes con saldo sin aplicar; «Anular» solo ADMIN y solo en vigentes', () => {
    const lista = [pago(), pago({ id: 'pp-2', sinAplicar: 0, aplicado: 350 }), pago({ id: 'pp-3', estado: 'ANULADO', sinAplicar: 0, anuladoMotivo: 'x' })];
    const admin = crear('ADMIN', lista);
    const a = filas(admin.f);
    expect(enlace(a[0], 'Aplicar')).toBeDefined();
    expect(enlace(a[0], 'Anular')).toBeDefined();
    expect(enlace(a[1], 'Aplicar')).toBeUndefined();
    expect(enlace(a[1], 'Anular')).toBeDefined();
    expect(enlace(a[2], 'Aplicar')).toBeUndefined();
    expect(enlace(a[2], 'Anular')).toBeUndefined();
    expect(a[2].textContent).toContain('Anulado');
    TestBed.resetTestingModule();

    const recepcion = crear('RECEPCION', lista);
    const r = filas(recepcion.f);
    expect(enlace(r[0], 'Aplicar')).toBeDefined();
    expect(enlace(r[0], 'Anular')).toBeUndefined(); // RECEPCION no anula
    expect(enlace(r[0], 'Ver detalle')).toBeDefined();
  });

  it('el filtro de estado y la búsqueda se envían al servidor y vuelven a la primera página', () => {
    const { f, http } = crear('ADMIN', [pago()]);
    comp(f)['cambiarEstado']('ANULADO');
    const porEstado = http.expectOne((r) => r.url === url);
    expect(porEstado.request.params.get('estado')).toBe('ANULADO');
    expect(porEstado.request.params.get('page')).toBe('0');
    porEstado.flush(pagina([]));

    comp(f)['buscar']('op-77');
    const porTexto = http.expectOne((r) => r.url === url);
    expect(porTexto.request.params.get('busqueda')).toBe('op-77');
    expect(porTexto.request.params.get('estado')).toBe('ANULADO');
    porTexto.flush(pagina([]));

    comp(f)['cambiarEstado']('cualquiera'); // un valor desconocido equivale a «todos»
    expect(http.expectOne((r) => r.url === url).request.params.has('estado')).toBe(false);
  });

  it('«Registrar pago» abre el diálogo con los proveedores y, al registrar, recarga desde la primera página', () => {
    const abrir = vi.fn(() => ({ closed: of(pago()) }));
    const { f, http } = crear('RECEPCION', [], abrir);
    comp(f)['registrar']();
    expect(abrir).toHaveBeenCalledWith(RegistrarPagoProveedorDialog, expect.objectContaining({ data: { proveedores: [{ id: 'p-1', nombre: 'Alejandro Terrones' }] } }));
    http.expectOne((r) => r.url === url).flush(pagina([pago()]));
    http.verify();
  });

  it('cerrar el diálogo de registro sin guardar no recarga', () => {
    const abrir = vi.fn(() => ({ closed: of(undefined) }));
    const { f, http } = crear('ADMIN', [pago()], abrir);
    comp(f)['registrar']();
    http.verify();
  });

  it('«Ver detalle» y «Aplicar» abren sus diálogos con ese pago; aplicar recarga', () => {
    const abrir = vi.fn((componente: unknown) => ({ closed: of(componente === AplicarPagoProveedorDialog ? pago({ aplicado: 350, sinAplicar: 0 }) : undefined) }));
    const { f, http } = crear('ADMIN', [pago()], abrir);
    comp(f)['verDetalle'](pago());
    expect(abrir).toHaveBeenCalledWith(PagoProveedorDetalleDialog, expect.objectContaining({ data: { pago: pago() } }));
    comp(f)['aplicar'](pago());
    expect(abrir).toHaveBeenCalledWith(AplicarPagoProveedorDialog, expect.objectContaining({ data: { pago: pago() } }));
    http.expectOne((r) => r.url === url).flush(pagina([pago({ aplicado: 350, sinAplicar: 0 })]));
    http.verify();
  });

  it('«Anular» pide el motivo en un diálogo y la acción llama a la API con ese motivo; al terminar recarga', () => {
    const abrir = vi.fn(() => ({ closed: of({ id: 'pp-1' }) }));
    const { f, http } = crear('ADMIN', [pago()], abrir);
    comp(f)['anular'](pago());
    const llamada = (abrir.mock.calls as unknown as [unknown, { data: { guardar: (m: string) => { subscribe: (o: unknown) => void } } }][])[0];
    expect(llamada[0]).toBe(CampoUnicoDialog);
    llamada[1].data.guardar('Se registró dos veces').subscribe({});
    const req = http.expectOne(`${url}/pp-1/anular`);
    expect(req.request.body).toEqual({ motivo: 'Se registró dos veces' });
    req.flush({});
    http.expectOne((r) => r.url === url).flush(pagina([]));
    http.verify();
  });

  it('un error del servidor al listar se muestra y no se confunde con una lista vacía', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    TestBed.inject(TokenStoreService).establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(PagosEfectivosPage);
    http.expectOne(`${base}/proveedores/operativo`).flush([]);
    http.expectOne((r) => r.url === url).flush({ mensaje: 'Error' }, { status: 500, statusText: 'Server Error' });
    f.detectChanges();
    expect(comp(f)['error']()).not.toBeNull();
    expect(el(f).textContent).not.toContain('Todavía no se registró ningún pago');
  });
});
