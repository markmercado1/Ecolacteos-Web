import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { ProveedorDetalleDialog } from './proveedor-detalle-dialog';
import { ProveedorAdminResponse } from '../../data-access/proveedor.models';
import { PagoDetalleDialog } from '../../../pagos/ui/pago-detalle-dialog/pago-detalle-dialog';
import { HistorialProveedorDialog } from '../../../acopios/historial-proveedor-dialog';
import { HistorialConsolidadoDialog } from '../../../historial-proveedor/ui/historial-consolidado-dialog/historial-consolidado-dialog';

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
  tipoPersona: 'NATURAL',
  ruc: null,
  razonSocial: null,
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

  it('el historial de zona muestra la hora, de dónde venía, el motivo y quién lo hizo, y señala los periodos pendientes de revisión', () => {
    const { f, http, c } = crear();
    f.detectChanges();
    http.expectOne(`${base}/innovacion/score/p1`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne(`${base}/innovacion/prediccion/p1`).flush({}, { status: 404, statusText: 'Not Found' });

    c['activarZonas']();
    http.expectOne(`${base}/proveedores/p1/historial-zona`).flush([
      { id: 'h3', zonaId: 'z3', zonaNombre: 'Bambamarca', desde: '2026-10-22', hasta: null, inicioEn: '2026-10-22T14:05:00', finEn: null,
        zonaOrigenNombre: 'Chugur', motivo: 'Cambió su ruta de recojo', usuarioNombre: 'Administrador', requiereRevision: false, notaRevision: null },
      { id: 'h2', zonaId: 'z2', zonaNombre: 'Chugur', desde: '2026-09-30', hasta: '2026-09-29', inicioEn: '2026-09-30T00:00:00', finEn: '2026-09-30T00:00:00',
        zonaOrigenNombre: null, motivo: null, usuarioNombre: null, requiereRevision: true, notaRevision: 'Periodo invertido (hasta anterior a desde)' },
      { id: 'h1', zonaId: 'z1', zonaNombre: 'Sorochuco', desde: '2024-06-25', hasta: '2026-07-19', inicioEn: '2024-06-25T00:00:00', finEn: '2026-07-20T00:00:00',
        zonaOrigenNombre: null, motivo: 'Periodo anterior a la historia detallada', usuarioNombre: null, requiereRevision: false, notaRevision: null }
    ]);
    f.detectChanges();

    const items = Array.from((f.nativeElement as HTMLElement).querySelectorAll('[data-testid="zona-item"]')) as HTMLElement[];
    expect(items.length).toBe(3);
    const actual = items[0].textContent!.replace(/\s+/g, ' ');
    expect(actual).toContain('Bambamarca');
    expect(actual).toContain('22/10/2026 14:05 → actual');
    expect(actual).toContain('Venía de Chugur');
    expect(actual).toContain('Cambió su ruta de recojo');
    expect(actual).toContain('Administrador');
    const marcado = items[1].textContent!.replace(/\s+/g, ' ');
    expect(marcado).toContain('Pendiente de revisión'); // texto, no solo color
    expect(marcado).toContain('2026-09-30 → 2026-09-29'); // fechas tal cual vienen: no se reinterpretan
    expect(marcado).toContain('Periodo invertido');
    expect(marcado).toContain('No determina la zona histórica de las entregas.');
    expect(items[2].textContent!.replace(/\s+/g, ' ')).toContain('24/06/2024 19:00'.replace('24/06/2024 19:00', '25/06/2024 00:00 → 20/07/2026 00:00'));
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

  it('"Historial consolidado" abre el historial de zonas, calidad y pagos del proveedor', () => {
    const { f, http, c } = crear();
    f.detectChanges();
    http.expectOne(`${base}/innovacion/score/p1`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne(`${base}/innovacion/prediccion/p1`).flush({}, { status: 404, statusText: 'Not Found' });
    expect((f.nativeElement as HTMLElement).querySelector('[data-testid="historial-consolidado"]')).not.toBeNull();

    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    c['abrirHistorialConsolidado']();
    expect(abrirSpy.mock.calls[0][0]).toBe(HistorialConsolidadoDialog);
    expect(abrirSpy.mock.calls[0][1]?.data).toEqual({ proveedorId: 'p1', proveedorNombre: 'Máximo Quispe' });
    http.verify();
  });
});
