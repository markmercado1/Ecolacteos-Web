import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { MovimientoInsumoDialog, MovimientoInsumoDialogData } from './movimiento-insumo-dialog';

const base = `${environment.apiBaseUrl}/inventario/insumos/i-sal`;
const sal = { id: 'i-sal', nombre: 'Sal', unidadMedida: 'kg', activo: true, stock: 6 };

function crear(modo: MovimientoInsumoDialogData['modo']) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { modo, insumo: sal } },
      { provide: DialogRef, useValue: { close } }
    ]
  });
  const f = TestBed.createComponent(MovimientoInsumoDialog);
  f.detectChanges();
  return { f, c: f.componentInstance, http: TestBed.inject(HttpTestingController), close };
}

describe('MovimientoInsumoDialog', () => {
  it('ingreso: envía cantidad, referencia y observación (sin costo) y cierra con el movimiento', () => {
    const { c, http, close } = crear('INGRESO');
    c['form'].setValue({ cantidad: 14, texto: ' Guía 001 ', observacion: '' });
    c['enviar']();
    const req = http.expectOne(`${base}/ingresos`);
    expect(req.request.body).toEqual({ cantidad: 14, referencia: 'Guía 001', observacion: null });
    req.flush({ id: 'm1', tipoMovimiento: 'INGRESO', saldoAnterior: 6, saldoResultante: 20 });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ saldoResultante: 20 }));
  });

  it('ingreso: rechaza cantidad 0 o con más de dos decimales sin llamar al backend', () => {
    const { c, http } = crear('INGRESO');
    c['form'].setValue({ cantidad: 0, texto: '', observacion: '' });
    c['enviar']();
    c['form'].setValue({ cantidad: 1.234, texto: '', observacion: '' });
    c['enviar']();
    http.expectNone(`${base}/ingresos`);
  });

  it('conteo físico: envía el CONTEO real y el motivo; muestra la variación estimada', () => {
    const { f, c, http } = crear('AJUSTE');
    c['form'].controls.cantidad.setValue(4.5);
    f.detectChanges();
    expect(c['variacion']()).toBe(-1.5);
    expect(f.nativeElement.textContent).toContain('Variación estimada');
    expect(f.nativeElement.textContent).toContain('Conteo físico');
    expect(f.nativeElement.textContent).toContain('Registrar salida');
    expect(f.nativeElement.textContent).not.toContain('Ajustar')
    c['form'].controls.texto.setValue('Merma');
    c['enviar']();
    expect(http.expectOne(`${base}/ajustes`).request.body).toEqual({ cantidadFisica: 4.5, motivo: 'Merma' });
  });

  it('conteo físico: el motivo es obligatorio y el conteo puede ser 0', () => {
    const { c, http } = crear('AJUSTE');
    c['form'].setValue({ cantidad: 0, texto: '   ', observacion: '' });
    c['enviar']();
    http.expectNone(`${base}/ajustes`);
    c['form'].controls.texto.setValue('Se agotó');
    c['enviar']();
    expect(http.expectOne(`${base}/ajustes`).request.body.cantidadFisica).toBe(0);
  });

  it('muestra el mensaje del servidor (p. ej. sin diferencia que ajustar)', () => {
    const { c, http } = crear('AJUSTE');
    c['form'].setValue({ cantidad: 6, texto: 'Conteo', observacion: '' });
    c['enviar']();
    http.expectOne(`${base}/ajustes`).flush({ mensaje: 'El conteo físico coincide con el stock del sistema' },
      { status: 400, statusText: 'Bad Request' });
    expect(c['errorServidor']()).toContain('coincide');
  });
});
