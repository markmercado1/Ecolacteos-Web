import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { AjusteCalidadEntregaResponse, LineaPagoResponse, PagoResponse } from '../../data-access/pago.models';
import { EntregasPagoDialog } from './entregas-pago-dialog';
import { PrecioCalidadDialog } from '../precio-calidad-dialog/precio-calidad-dialog';

const base = environment.apiBaseUrl;

const pago: PagoResponse = {
  id: 'pg-1', proveedorId: 'p-1', proveedorNombre: 'Alejandro Terrones Huamán', semanaInicio: '2026-10-14', semanaFin: '2026-10-21',
  litrosTotales: 190, precioLitro: 1, total: 190, comprobanteGenerado: false, registroAcopioIds: ['r-1', 'r-2'], precioLitroEfectivo: 1,
  totalAPagar: 180, ajusteCalidad: -10
};

/** Corregida (100 → 90 antes de liquidar, 85 hoy), con un ajuste de litros y con precio de calidad propio. */
const corregida: LineaPagoResponse = {
  registroAcopioId: 'r-1', fechaHora: '2026-10-15T06:00:00', litrosOriginales: 100, litrosLiquidados: 90, litrosContabilizados: 85,
  litrosEfectivosActuales: 85, precioBase: 1, precioAplicado: 0.9, correccionAplicadaId: 'c-1', precioPropioDeCalidad: true,
  analisisCalidadId: 'a-1', motivoAjusteCalidad: 'Agua en la leche'
};
/** Sin ninguna corrección ni precio propio. */
const normal: LineaPagoResponse = {
  registroAcopioId: 'r-2', fechaHora: '2026-10-16T06:00:00', litrosOriginales: 100, litrosLiquidados: 100, litrosContabilizados: 100,
  litrosEfectivosActuales: 100, precioBase: 1, precioAplicado: 1, correccionAplicadaId: null, precioPropioDeCalidad: false,
  analisisCalidadId: null, motivoAjusteCalidad: null
};

function setup(esAdmin: boolean, lineas: LineaPagoResponse[] | 'error' = [corregida, normal], dialogOpen = vi.fn()) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { pago, esAdmin } },
      { provide: DialogRef, useValue: { close } },
      { provide: Dialog, useValue: { open: dialogOpen } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(EntregasPagoDialog);
  const req = http.expectOne(`${base}/pagos/pg-1/lineas`);
  expect(req.request.method).toBe('GET');
  if (lineas === 'error') {
    req.flush({ mensaje: 'Error' }, { status: 500, statusText: 'Server Error' });
  } else {
    req.flush(lineas);
  }
  f.detectChanges();
  return { f, http, close, dialogOpen };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const texto = (f: ComponentFixture<unknown>) => (el(f).textContent ?? '').replace(/\s+/g, ' ');
const filas = (f: ComponentFixture<unknown>) => Array.from(el(f).querySelectorAll('[data-testid="entrega"]')) as HTMLElement[];
const celda = (fila: HTMLElement, id: string) => (fila.querySelector(`[data-testid="${id}"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim();
const comp = (f: ComponentFixture<EntregasPagoDialog>) => f.componentInstance as unknown as Record<string, any>;

describe('EntregasPagoDialog', () => {
  afterEach(() => vi.restoreAllMocks());

  it('distingue recibidos, efectivos hoy, liquidados y contabilizados con los valores del servidor', () => {
    const { f, http } = setup(true);
    const [primera, segunda] = filas(f);

    expect(celda(primera, 'originales')).toBe('100');
    expect(celda(primera, 'efectivos')).toBe('85');
    expect(celda(primera, 'liquidados')).toBe('90');
    expect(celda(primera, 'contabilizados')).toContain('85');
    expect(celda(primera, 'normal')).toBe('1.00');
    expect(celda(primera, 'aplicado')).toContain('0.90');
    expect(celda(segunda, 'originales')).toBe('100');
    expect(celda(segunda, 'liquidados')).toBe('100');
    http.verify();
  });

  it('muestra las entregas ordenadas por fecha aunque el servidor las envíe en otro orden', () => {
    const tarde = { ...normal, registroAcopioId: 'r-3', fechaHora: '2026-10-21T06:00:00' };
    const temprano = { ...normal, registroAcopioId: 'r-4', fechaHora: '2026-10-14T06:00:00' };
    const { f, http } = setup(true, [tarde, corregida, temprano]);
    const fechas = filas(f).map((fila) => (fila.children[0].textContent ?? '').trim().slice(0, 10));
    expect(fechas).toEqual(['14/10/2026', '15/10/2026', '21/10/2026']);
    http.verify();
  });

  it('explica cada concepto en una leyenda y rotula las columnas', () => {
    const { f, http } = setup(true);
    const t = texto(f);
    for (const concepto of ['Recibidos', 'Efectivos hoy', 'Liquidados', 'Contabilizados']) {
      expect(t, concepto).toContain(concepto);
    }
    expect(t).toContain('No cambia nunca');
    expect(t).toContain('Lo que se pagó cuando se generó este pago');
    http.verify();
  });

  it('marca con texto (no solo color) las entregas corregidas, con ajuste de litros y con precio de calidad', () => {
    const { f, http } = setup(true);
    const [primera, segunda] = filas(f);
    expect(primera.textContent).toContain('Corregida');
    expect(primera.textContent).toContain('Con ajuste');
    expect(primera.textContent).toContain('Calidad');
    expect(primera.querySelector('.badge[title^="Precio de calidad"]')?.getAttribute('title')).toContain('Agua en la leche');
    expect(segunda.textContent).not.toContain('Corregida');
    expect(segunda.textContent).not.toContain('Con ajuste');
    expect(segunda.textContent).not.toContain('Calidad');
    http.verify();
  });

  it('solo ADMIN ve la acción «Precio de calidad»; RECEPCION solo consulta', () => {
    const admin = setup(true);
    expect(Array.from(el(admin.f).querySelectorAll('button')).filter((b) => b.textContent?.includes('Precio de calidad')).length).toBe(2);
    admin.http.verify();

    TestBed.resetTestingModule();
    const recepcion = setup(false);
    expect(Array.from(el(recepcion.f).querySelectorAll('button')).some((b) => b.textContent?.includes('Precio de calidad'))).toBe(false);
    recepcion.http.verify();
  });

  it('un pago sin entregas muestra el estado vacío y un fallo permite reintentar', () => {
    const vacio = setup(true, []);
    expect(texto(vacio.f)).toContain('Este pago no tiene entregas registradas.');
    vacio.http.verify();

    TestBed.resetTestingModule();
    const fallo = setup(true, 'error');
    expect(comp(fallo.f)['error']()).not.toBeNull();
    expect(filas(fallo.f).length).toBe(0);
    comp(fallo.f)['cargar']();
    fallo.http.expectOne(`${base}/pagos/pg-1/lineas`).flush([normal]);
    fallo.f.detectChanges();
    expect(filas(fallo.f).length).toBe(1);
    fallo.http.verify();
  });

  it('«Precio de calidad» abre el diálogo con el pago y la entrega elegida; al guardar avisa con el efecto que informó el servidor y relee', () => {
    const respuesta: AjusteCalidadEntregaResponse = {
      id: 'ac-1', pagoId: 'pg-1', registroAcopioId: 'r-2', analisisCalidadId: 'a-9', analisisFolio: 'F-9', analisisResultado: 'OBSERVADO', litrosLiquidados: 100,
      precioNormal: 1, precioAnterior: 1, precioLitroNuevo: 0.9, efectoEnElTotal: -10, motivo: 'Agua', usuarioNombre: 'Admin', creadoEn: '2026-10-21T10:00:00'
    };
    const abrir = vi.fn(() => ({ closed: of(respuesta) }));
    const { f, http } = setup(true, [corregida, normal], abrir);
    const exito = vi.spyOn(TestBed.inject(ToastService), 'exito');

    comp(f)['fijarPrecio'](normal);

    expect(abrir).toHaveBeenCalledWith(PrecioCalidadDialog, expect.objectContaining({
      data: { pagoId: 'pg-1', proveedorNombre: 'Alejandro Terrones Huamán', linea: normal }
    }));
    expect(exito).toHaveBeenCalledWith(expect.stringContaining('−S/ 10.00'));
    expect(comp(f)['cambiado']()).toBe(true);
    http.expectOne(`${base}/pagos/pg-1/lineas`).flush([corregida, { ...normal, precioAplicado: 0.9, precioPropioDeCalidad: true }]); // lo relee del servidor
    f.detectChanges();
    expect(celda(filas(f)[1], 'aplicado')).toContain('0.90');
    http.verify();
  });

  it('si se cancela el diálogo de precio no avisa, no relee ni marca cambios', () => {
    const abrir = vi.fn(() => ({ closed: of(undefined) }));
    const { f, http } = setup(true, [corregida, normal], abrir);
    const exito = vi.spyOn(TestBed.inject(ToastService), 'exito');

    comp(f)['fijarPrecio'](normal);

    expect(exito).not.toHaveBeenCalled();
    expect(comp(f)['cambiado']()).toBe(false);
    http.verify(); // ninguna petición adicional
  });

  it('un usuario que no es ADMIN no puede abrir el diálogo de precio aunque llame al método', () => {
    const abrir = vi.fn();
    const { f, http } = setup(false, [normal], abrir);
    comp(f)['fijarPrecio'](normal);
    expect(abrir).not.toHaveBeenCalled();
    http.verify();
  });

  it('cerrar devuelve si hubo cambios para que el detalle relea el pago', () => {
    const { f, http, close } = setup(true);
    el(f).querySelector<HTMLButtonElement>('.dialog-foot .btn')!.click();
    expect(close).toHaveBeenCalledWith(false);
    http.verify();
  });
});
