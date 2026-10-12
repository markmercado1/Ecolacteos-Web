import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { ExistenciasPresentacionResponse } from '../../data-access/inventario.models';
import { LotesPresentacionDialog, LotesPresentacionDialogData } from './lotes-presentacion-dialog';

const base = environment.apiBaseUrl;
const urlExistencias = `${base}/inventario/presentaciones/pr-1/existencias`;

const EXISTENCIAS: ExistenciasPresentacionResponse = {
  presentacionId: 'pr-1', controlaVencimiento: true, stockFisico: 100, stockVendible: 70, stockVencido: 10,
  stockSinTrazabilidad: 20, fechaReferencia: '2026-10-11',
  lotes: [
    { origen: 'LOTE', id: 'd-1', loteProduccionId: 'l-1', fechaLote: '2026-09-01', fechaVencimiento: '2026-10-10', saldo: 10, vencido: true, diasParaVencer: -1 },
    { origen: 'LOTE', id: 'd-2', loteProduccionId: 'l-2', fechaLote: '2026-10-01', fechaVencimiento: '2026-10-11', saldo: 5, vencido: false, diasParaVencer: 0 },
    { origen: 'REGULARIZACION', id: 'r-1', loteProduccionId: null, fechaLote: '2026-10-05', fechaVencimiento: '2026-11-01', saldo: 65, vencido: false, diasParaVencer: 21 }
  ]
};

function abrir(puedeRegularizar: boolean) {
  const cerrar = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DialogRef, useValue: { close: cerrar } },
      {
        provide: DIALOG_DATA,
        useValue: { presentacionId: 'pr-1', presentacionNombre: 'Botella 1 L', productoNombre: 'Yogurt', puedeRegularizar } satisfies LotesPresentacionDialogData
      }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(LotesPresentacionDialog);
  fixture.detectChanges();
  return { fixture, http, cerrar, dialog: fixture.componentInstance };
}

describe('LotesPresentacionDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('muestra lo físico, vendible, vencido y sin trazabilidad, y cada lote con su estado', () => {
    const { fixture, http } = abrir(false);
    http.expectOne(urlExistencias).flush(EXISTENCIAS);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('En inventario');
    expect(texto).toContain('100');
    expect(texto).toContain('70');
    expect(texto).toContain('Vencido hace 1 d');
    expect(texto).toContain('Vence hoy');
    expect(texto).toContain('Vence en 21 d');
    expect(texto).toContain('Regularizado');
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(3);
  });

  it('sin permiso de regularizar (no ADMIN) no muestra el formulario aunque haya existencias sin trazabilidad', () => {
    const { fixture, http } = abrir(false);
    http.expectOne(urlExistencias).flush(EXISTENCIAS);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form.regularizar')).toBeNull();
  });

  it('ADMIN sin existencias sin trazabilidad tampoco ve el formulario', () => {
    const { fixture, http } = abrir(true);
    http.expectOne(urlExistencias).flush({ ...EXISTENCIAS, stockSinTrazabilidad: 0, stockFisico: 80 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form.regularizar')).toBeNull();
  });

  it('ADMIN regulariza: envía cantidad, fecha y motivo, recarga las existencias y cierra con true', () => {
    const { fixture, http, cerrar, dialog } = abrir(true);
    http.expectOne(urlExistencias).flush(EXISTENCIAS);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form.regularizar')).not.toBeNull();

    dialog['form'].setValue({ cantidad: 15, fechaVencimiento: '2026-11-20', motivo: '  Etiqueta del lote viejo  ' });
    dialog['regularizar']();

    const req = http.expectOne(`${base}/admin/presentaciones/pr-1/regularizaciones`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ cantidad: 15, fechaVencimiento: '2026-11-20', motivo: 'Etiqueta del lote viejo' });
    req.flush({
      id: 'r-2', presentacionId: 'pr-1', cantidad: 15, fechaVencimiento: '2026-11-20', vencido: false,
      motivo: 'Etiqueta del lote viejo', creadoEn: '2026-10-11T10:00:00', sinTrazabilidadRestante: 5
    });
    http.expectOne(urlExistencias).flush({ ...EXISTENCIAS, stockSinTrazabilidad: 5, stockVendible: 85 });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Se regularizaron 15 unidades');
    dialog['cerrar']();
    expect(cerrar).toHaveBeenCalledWith(true);
  });

  it('no envía una cantidad mayor a lo sin trazabilidad, ni un formulario incompleto', () => {
    const { fixture, http, dialog } = abrir(true);
    http.expectOne(urlExistencias).flush(EXISTENCIAS);
    fixture.detectChanges();

    dialog['form'].setValue({ cantidad: 21, fechaVencimiento: '2026-11-20', motivo: 'x' });
    dialog['regularizar']();
    dialog['form'].setValue({ cantidad: 5, fechaVencimiento: '', motivo: 'x' });
    dialog['regularizar']();
    dialog['form'].setValue({ cantidad: 5, fechaVencimiento: '2026-11-20', motivo: '' });
    dialog['regularizar']();

    http.expectNone(`${base}/admin/presentaciones/pr-1/regularizaciones`);
  });

  it('un rechazo del backend se muestra en el diálogo y no cierra ni recarga', () => {
    const { fixture, http, dialog, cerrar } = abrir(true);
    http.expectOne(urlExistencias).flush(EXISTENCIAS);
    fixture.detectChanges();

    dialog['form'].setValue({ cantidad: 5, fechaVencimiento: '2026-11-20', motivo: 'x' });
    dialog['regularizar']();
    http.expectOne(`${base}/admin/presentaciones/pr-1/regularizaciones`)
      .flush({ mensaje: 'Solo hay 3 unidades sin trazabilidad' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Solo hay 3 unidades sin trazabilidad');
    expect(cerrar).not.toHaveBeenCalled();
  });

  it('cerrar sin haber regularizado devuelve false', () => {
    const { http, dialog, cerrar } = abrir(true);
    http.expectOne(urlExistencias).flush(EXISTENCIAS);

    dialog['cerrar']();

    expect(cerrar).toHaveBeenCalledWith(false);
  });

  it('un error de carga muestra el mensaje y permite reintentar', () => {
    const { fixture, http } = abrir(false);
    http.expectOne(urlExistencias).flush({ mensaje: 'Presentacion no encontrada' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Presentacion no encontrada');

    (fixture.nativeElement.querySelector('button.small') as HTMLButtonElement).click();
    http.expectOne(urlExistencias).flush(EXISTENCIAS);
  });
});
