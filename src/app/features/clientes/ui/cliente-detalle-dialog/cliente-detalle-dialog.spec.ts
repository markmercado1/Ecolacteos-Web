import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { ClienteResponse } from '../../data-access/cliente.models';
import { ClienteDetalleDialog } from './cliente-detalle-dialog';

const base = environment.apiBaseUrl;

const sinAutorizar = { vigente: false, estado: null, medios: [], forma: null, desde: null, avisoVersion: null, avisoCompleto: false };
const cliente: ClienteResponse = {
  id: 'c-1', tipoPersona: 'NATURAL', nombre: 'Rosa Quispe', razonSocial: null, dni: null, ruc: null, correo: null,
  telefonos: ['••• ••• 321'], mayorista: false, tiposHabilitados: [], activo: true, fusionadoEnId: null, creadoEn: '2026-10-24T10:00:00', datosCompletos: false,
  registro: { ...sinAutorizar, vigente: true, estado: 'OTORGADO', forma: 'VERBAL_PRESENCIAL', desde: '2026-10-24T10:00:00', avisoVersion: '2026-10-24' },
  comunicaciones: { vigente: true, estado: 'OTORGADO', medios: ['WHATSAPP'], forma: 'VERBAL_PRESENCIAL', desde: '2026-10-24T10:00:00', avisoVersion: '2026-10-24', avisoCompleto: false },
  canalHabitual: 'PUBLICO',
  reservas: { pendientes: 1, confirmadas: 1, activas: 2, total: 3, proximoRetiro: '2026-10-26' }
};

function crear(esAdmin: boolean, c: ClienteResponse = cliente) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DIALOG_DATA, useValue: { id: c.id, esAdmin } }, { provide: DialogRef, useValue: { close: vi.fn() } }]
  });
  const f = TestBed.createComponent(ClienteDetalleDialog);
  const http = TestBed.inject(HttpTestingController);
  http.expectOne((r) => r.url.endsWith('/tipos-precio')).flush([{ codigo: 'MAYORISTA', nombre: 'Mayorista', descripcion: '', activo: true, protegido: false, reglaComprador: 'CLIENTE_HABILITADO', ultimoCambio: null }, { codigo: 'PROVEEDOR', nombre: 'Proveedor', descripcion: '', activo: true, protegido: false, reglaComprador: 'PROVEEDOR_PADRON', ultimoCambio: null }, { codigo: 'PUBLICO', nombre: 'Público', descripcion: '', activo: true, protegido: false, reglaComprador: 'CUALQUIERA', ultimoCambio: null }]);
  http.expectOne(`${base}/clientes/c-1`).flush(c);
  http.expectOne(`${base}/clientes/c-1/historial`).flush({
    compras: { anio: 2026, totalCompras: 2, montoTotal: 30, comprasAnio: 2, montoAnio: 30, ultimaCompra: '2026-10-20', desdeReserva: 1 },
    reservas: [{ id: 'r-1', codigo: 'ABC123', estado: 'RETIRADA', fechaRetiro: '2026-10-20', total: 20, ventaId: 'v-1' }]
  });
  http.expectOne((r) => r.url === `${base}/clientes/c-1/compras`).flush({ contenido: [], paginaActual: 0, tamanoPagina: 10, totalElementos: 0, totalPaginas: 0 });
  http.expectOne(`${base}/clientes/c-1/consentimientos`).flush([]);
  f.detectChanges();
  return { f, http, comp: f.componentInstance as unknown as Record<string, any> };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;

describe('ClienteDetalleDialog (Fase H)', () => {
  it('muestra los indicadores del año y las reservas, con datos ocultos para VENTAS y sin acciones de ADMIN', () => {
    const { f, http } = crear(false);
    const texto = el(f).textContent ?? '';
    expect(el(f).querySelector('[data-testid="historial"]')?.textContent).toContain('2 compras');
    expect(texto).toContain('ABC123');
    expect(texto).toContain('Retirada'); // estado legible, no el código
    expect(el(f).querySelector('[data-testid="resumen-reservas"]')?.textContent).toContain('1 pendiente y 1 confirmada; próximo retiro 26/10/2026 (3 en total)');
    expect(el(f).querySelector('[data-testid="canal-habitual"]')?.textContent).toContain('Público');
    expect(texto).toContain('ADMIN los ve completos');
    expect(texto).not.toContain('Habilitar mayorista');
    expect(texto).not.toContain('Fusionar');
    http.verify();
  });

  it('revocar las promociones es un clic, sin justificación, y queda registrado', () => {
    const { f, http } = crear(false);
    const boton = Array.from(el(f).querySelectorAll('button')).find((b) => b.textContent?.includes('Ya no quiere recibirlas')) as HTMLButtonElement;
    boton.click();
    const req = http.expectOne(`${base}/clientes/c-1/comunicaciones`);
    expect(req.request.body).toEqual({ otorgada: false, forma: 'VERBAL_PRESENCIAL' });
    req.flush({ ...cliente, comunicaciones: { ...cliente.comunicaciones, vigente: false, estado: 'REVOCADO', medios: [] } });
    http.expectOne(`${base}/clientes/c-1/consentimientos`).flush([]);
    f.detectChanges();
    expect(el(f).querySelector('[data-testid="promociones"]')?.textContent).toContain('Retiró su autorización');
    http.verify();
  });

  it('ADMIN puede habilitar como mayorista con motivo', () => {
    const { f, http, comp } = crear(true);
    expect(el(f).querySelector('[data-testid="habilitacion"]')?.textContent).toContain('Mayorista');
    expect(el(f).querySelector('[data-testid="cambiar-habilitacion"]')?.textContent).toContain('Habilitar');
    comp['motivoMayorista'].set('Compra por mayor');
    comp['cambiarHabilitacion'](cliente, 'MAYORISTA');
    const req = http.expectOne(`${base}/clientes/c-1/tipos-precio/MAYORISTA`);
    expect(req.request.body).toEqual({ habilitado: true, motivo: 'Compra por mayor' });
    req.flush({ ...cliente, mayorista: true });
    http.expectOne(`${base}/clientes/c-1/consentimientos`).flush([]);
    http.verify();
  });

  it('otorgar promociones es un paso: marcar medios y guardar (con la versión vigente del aviso)', () => {
    const sinPromos: ClienteResponse = { ...cliente, comunicaciones: { ...cliente.comunicaciones, vigente: false, estado: null, medios: [] } };
    const { f, http, comp } = crear(false, sinPromos);
    comp['alternarMedio']('SMS');
    f.detectChanges();
    (Array.from(el(f).querySelectorAll('button')).find((b) => b.textContent?.includes('acepta promociones')) as HTMLButtonElement).click();
    http.expectOne(`${base}/catalogo/privacidad`).flush({ version: '2026-10-24' });
    const req = http.expectOne(`${base}/clientes/c-1/comunicaciones`);
    expect(req.request.body).toEqual({ otorgada: true, medios: ['SMS'], forma: 'VERBAL_PRESENCIAL', avisoVersion: '2026-10-24' });
    req.flush(cliente);
    http.expectOne(`${base}/clientes/c-1/consentimientos`).flush([]);
    http.verify();
  });

  it('ADMIN cambia el canal habitual de un mayorista sin tocar sus demás datos', () => {
    const mayorista: ClienteResponse = { ...cliente, mayorista: true };
    const { f, http, comp } = crear(true, mayorista);
    expect(el(f).querySelector('#cd-canal')).toBeTruthy();
    comp['cambiarCanal'](mayorista, 'MAYORISTA');
    const req = http.expectOne(`${base}/clientes/c-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ tipoPersona: 'NATURAL', nombre: 'Rosa Quispe', correo: null, dni: null, ruc: null, razonSocial: null, canalHabitual: 'MAYORISTA' });
    req.flush({ ...mayorista, canalHabitual: 'MAYORISTA' });
    http.expectOne(`${base}/clientes/c-1/consentimientos`).flush([]);
    http.verify();
  });

  it('sin reservas vinculadas lo dice, y VENTAS no ve el cambio de canal', () => {
    const { f, http } = crear(false, { ...cliente, reservas: { pendientes: 0, confirmadas: 0, activas: 0, total: 0, proximoRetiro: null } });
    expect(el(f).querySelector('[data-testid="resumen-reservas"]')?.textContent).toContain('Sin reservas vinculadas');
    expect(el(f).querySelector('#cd-canal')).toBeNull();
    http.verify();
  });
});
