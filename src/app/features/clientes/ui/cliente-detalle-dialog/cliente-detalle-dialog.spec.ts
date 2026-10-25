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
  telefonos: ['••• ••• 321'], mayorista: false, activo: true, fusionadoEnId: null, creadoEn: '2026-10-24T10:00:00', datosCompletos: false,
  registro: { ...sinAutorizar, vigente: true, estado: 'OTORGADO', forma: 'VERBAL_PRESENCIAL', desde: '2026-10-24T10:00:00', avisoVersion: '2026-10-24' },
  comunicaciones: { vigente: true, estado: 'OTORGADO', medios: ['WHATSAPP'], forma: 'VERBAL_PRESENCIAL', desde: '2026-10-24T10:00:00', avisoVersion: '2026-10-24', avisoCompleto: false }
};

function crear(esAdmin: boolean, c: ClienteResponse = cliente) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DIALOG_DATA, useValue: { id: c.id, esAdmin } }, { provide: DialogRef, useValue: { close: vi.fn() } }]
  });
  const f = TestBed.createComponent(ClienteDetalleDialog);
  const http = TestBed.inject(HttpTestingController);
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
    expect(texto).toContain('ADMIN los ve completos');
    expect(texto).not.toContain('Habilitar mayorista');
    expect(texto).not.toContain('Fusionar');
    http.verify();
  });

  it('revocar las promociones es un clic, sin justificación, y queda registrado', () => {
    const { f, http } = crear(false);
    const boton = Array.from(el(f).querySelectorAll('button')).find((b) => b.textContent?.includes('ya no quiere recibirlas')) as HTMLButtonElement;
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
    expect(el(f).textContent).toContain('Habilitar mayorista');
    comp['motivoMayorista'].set('Compra por mayor');
    comp['cambiarMayorista'](cliente);
    const req = http.expectOne(`${base}/clientes/c-1/mayorista`);
    expect(req.request.body).toEqual({ mayorista: true, motivo: 'Compra por mayor' });
    req.flush({ ...cliente, mayorista: true });
    http.expectOne(`${base}/clientes/c-1/consentimientos`).flush([]);
    http.verify();
  });
});
