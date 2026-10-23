import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { ProveedorDetalleDialog } from './proveedor-detalle-dialog';
import { ProveedorAdminResponse } from '../../data-access/proveedor.models';
import { PagoDetalleDialog } from '../../../pagos/ui/pago-detalle-dialog/pago-detalle-dialog';
import { HistorialProveedorDialog } from '../../../acopios/historial-proveedor-dialog';

const base = environment.apiBaseUrl;

const proveedor: ProveedorAdminResponse = {
  id: 'p1',
  nombre: 'Máximo Quispe',
  dni: '111',
  telefono: '987654321',
  zonaActualId: 'z1',
  zonaActualNombre: 'Huancayo Norte',
  codigoQr: 'QR-1',
  activo: true,
};

function crear() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { proveedor } },
      { provide: DialogRef, useValue: { close: vi.fn() } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(ProveedorDetalleDialog);
  return { f, http, c: f.componentInstance };
}

describe('ProveedorDetalleDialog (perfil integral)', () => {
  it('la pestaña General muestra los datos ya disponibles sin pedirlos, y carga score/predicción al abrir', () => {
    const { f, http } = crear();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('111');
    expect(f.nativeElement.textContent).toContain('QR-1');
    expect(f.nativeElement.textContent).toContain('Huancayo Norte');

    http.expectOne(`${base}/innovacion/score/p1`).flush({ proveedorId: 'p1', periodo: '2026-09-14', score: 88, componenteCalidad: 90, componenteRegularidad: 85, componenteAnomalias: 100 });
    http.expectOne(`${base}/innovacion/prediccion/p1`).flush({ proveedorId: 'p1', fechaPrevista: '2026-09-24', litrosEstimadosMin: 10, litrosEstimadosMax: 20 });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('88');
    expect(f.nativeElement.textContent).toContain('20');
    expect(f.componentInstance['datosComponentesScore']()).toEqual([
      { etiqueta: 'Calidad', valor: 90 },
      { etiqueta: 'Regularidad', valor: 85 },
      { etiqueta: 'Anomalías', valor: 100 },
    ]);
    expect(f.nativeElement.querySelector('ui-bar-chart')).toBeTruthy();
    http.verify();
  });

  it('score/predicción 404 se muestran como "aún no calculado", no como error ni como cero', () => {
    const { f, http, c } = crear();
    f.detectChanges();
    http.expectOne(`${base}/innovacion/score/p1`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne(`${base}/innovacion/prediccion/p1`).flush({}, { status: 404, statusText: 'Not Found' });
    expect(c['sinScore']()).toBe(true);
    expect(c['sinPrediccion']()).toBe(true);
    expect(c['errorScore']()).toBeNull();
    expect(c['errorPrediccion']()).toBeNull();
    f.detectChanges();
    expect(f.nativeElement.querySelector('ui-bar-chart')).toBeNull();
    http.verify();
  });

  it('un error real (no 404) de score se muestra como error recuperable', () => {
    const { f, http, c } = crear();
    f.detectChanges();
    http.expectOne(`${base}/innovacion/score/p1`).flush({}, { status: 500, statusText: 'Server Error' });
    http.expectOne(`${base}/innovacion/prediccion/p1`).flush({}, { status: 404, statusText: 'Not Found' });
    expect(c['errorScore']()?.status).toBe(500);
    expect(c['sinScore']()).toBe(false);
    http.verify();
  });

  it('la pestaña Zonas no pide el historial hasta activarla, y no lo repite al reactivarla', () => {
    const { f, http, c } = crear();
    f.detectChanges();
    http.expectOne(`${base}/innovacion/score/p1`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne(`${base}/innovacion/prediccion/p1`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectNone(`${base}/proveedores/p1/historial-zona`);

    c['activarZonas']();
    http
      .expectOne(`${base}/proveedores/p1/historial-zona`)
      .flush([{ id: 'h1', zonaId: 'z1', zonaNombre: 'Huancayo Norte', desde: '2026-01-01', hasta: null }]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Huancayo Norte');

    c['pestana'].set('general');
    c['activarZonas']();
    http.expectNone(`${base}/proveedores/p1/historial-zona`);
    http.verify();
  });

  it('la pestaña Pagos carga historial y ajustes pendientes solo al activarla; "Ver detalle" abre PagoDetalleDialog', () => {
    const { f, http, c } = crear();
    f.detectChanges();
    http.expectOne(`${base}/innovacion/score/p1`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne(`${base}/innovacion/prediccion/p1`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectNone((r) => r.url.startsWith(`${base}/pagos/proveedor/p1`));
    http.expectNone((r) => r.url === `${base}/pagos/ajustes/pendientes`);

    c['activarPagos']();
    const pago = { id: 'pg1', proveedorId: 'p1', proveedorNombre: 'Máximo Quispe', semanaInicio: '2026-09-01', semanaFin: '2026-09-07', litrosTotales: 100, precioLitro: 2, total: 200, comprobanteGenerado: false, registroAcopioIds: ['r1'], precioLitroEfectivo: 2, totalAPagar: 200, ajusteCalidad: 0 };
    const reqPagos = http.expectOne((r) => r.url === `${base}/pagos/proveedor/p1/paginado`);
    expect(reqPagos.request.params.get('page')).toBe('0');
    expect(reqPagos.request.params.get('size')).toBe('10');
    reqPagos.flush({ contenido: [pago], paginaActual: 0, tamanoPagina: 10, totalElementos: 11, totalPaginas: 2 });
    const reqAjustes = http.expectOne((r) => r.url === `${base}/pagos/ajustes/pendientes`);
    expect(reqAjustes.request.params.get('proveedorId')).toBe('p1');
    reqAjustes.flush([]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('200');
    expect(f.nativeElement.textContent).toContain('Mostrando 1–10 de 11 pagos');

    c['irAPaginaPagos'](1);
    const reqPagina2 = http.expectOne((r) => r.url === `${base}/pagos/proveedor/p1/paginado`);
    expect(reqPagina2.request.params.get('page')).toBe('1');
    reqPagina2.flush({ contenido: [{ ...pago, id: 'pg2' }], paginaActual: 1, tamanoPagina: 10, totalElementos: 11, totalPaginas: 2 });
    c['irAPaginaPagos'](2);
    http.expectNone((r) => r.url === `${base}/pagos/proveedor/p1/paginado`);

    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    c['abrirPago'](pago);
    expect(abrirSpy.mock.calls[0][0]).toBe(PagoDetalleDialog);
    expect(abrirSpy.mock.calls[0][1]?.data).toEqual({ pago, esAdmin: true });
    http.verify();
  });

  it('un error al cargar zonas no afecta a la pestaña Pagos ni al resto del perfil', () => {
    const { f, http, c } = crear();
    f.detectChanges();
    http.expectOne(`${base}/innovacion/score/p1`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne(`${base}/innovacion/prediccion/p1`).flush({}, { status: 404, statusText: 'Not Found' });

    c['activarZonas']();
    http.expectOne(`${base}/proveedores/p1/historial-zona`).flush({}, { status: 500, statusText: 'Server Error' });
    expect(c['errorZonas']()?.status).toBe(500);

    c['activarPagos']();
    http.expectOne((r) => r.url === `${base}/pagos/proveedor/p1/paginado`)
      .flush({ contenido: [], paginaActual: 0, tamanoPagina: 10, totalElementos: 0, totalPaginas: 0 });
    http.expectOne((r) => r.url === `${base}/pagos/ajustes/pendientes`).flush([]);
    expect(c['errorPagos']()).toBeNull();
    http.verify();
  });

  it('"Ver historial de entregas" abre HistorialProveedorDialog con el proveedor correcto', () => {
    const { f, http, c } = crear();
    f.detectChanges();
    http.expectOne(`${base}/innovacion/score/p1`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne(`${base}/innovacion/prediccion/p1`).flush({}, { status: 404, statusText: 'Not Found' });

    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    c['abrirHistorialEntregas']();
    expect(abrirSpy.mock.calls[0][0]).toBe(HistorialProveedorDialog);
    expect(abrirSpy.mock.calls[0][1]?.data).toEqual({ proveedorId: 'p1', proveedorNombre: 'Máximo Quispe' });
    http.verify();
  });
});
