import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { AjustarStockDialog, AjustarStockDialogData } from './ajustar-stock-dialog';

const base = environment.apiBaseUrl;

function crear(data: AjustarStockDialogData) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const dialogRef = TestBed.inject(DialogRef) as unknown as { close: ReturnType<typeof vi.fn> };
  const f = TestBed.createComponent(AjustarStockDialog);
  const c = f.componentInstance;
  return { f, http, c, dialogRef };
}

const DATA: AjustarStockDialogData = {
  presentacionId: 'pres-1',
  presentacionNombre: 'Botella 1 L',
  productoNombre: 'Yogurt de fresa',
  stockActual: 100
};

describe('AjustarStockDialog', () => {
  it('precarga la cantidad física con el stock actual del sistema', () => {
    const { c } = crear(DATA);
    expect(c['form'].controls.cantidadFisica.value).toBe(100);
    expect(c['data'].presentacionNombre).toBe('Botella 1 L');
  });

  it('enviar() hace POST con presentacionId, cantidadFisica y motivo, y cierra el diálogo con la respuesta', () => {
    const { c, http, dialogRef } = crear(DATA);
    c['form'].controls.cantidadFisica.setValue(95);
    c['form'].controls.motivo.setValue('Conteo físico: faltan 5 unidades.');

    c['enviar']();
    expect(c['enviando']()).toBe(true);

    const req = http.expectOne(`${base}/inventario/ajustes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      presentacionId: 'pres-1',
      cantidadFisica: 95,
      motivo: 'Conteo físico: faltan 5 unidades.'
    });

    const respuesta = {
      id: 'aj-1', presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoNombre: 'Yogurt de fresa',
      cantidadAnterior: 100, cantidadCorregida: 95, delta: -5, motivo: 'Conteo físico: faltan 5 unidades.',
      usuarioNombre: 'Ana Admin', creadoEn: '2026-09-28T10:00:00'
    };
    req.flush(respuesta);

    expect(dialogRef.close).toHaveBeenCalledWith(respuesta);
  });

  it('no envía nada si falta el motivo, y marca los campos como tocados', () => {
    const { c, http } = crear(DATA);

    c['enviar']();

    http.expectNone(`${base}/inventario/ajustes`);
    expect(c['form'].controls.motivo.touched).toBe(true);
    expect(c['form'].invalid).toBe(true);
  });

  it('un rechazo del servidor muestra el error y NO cierra el diálogo', () => {
    const { c, http, dialogRef } = crear(DATA);
    c['form'].controls.cantidadFisica.setValue(95);
    c['form'].controls.motivo.setValue('Rotura de botellas');

    c['enviar']();
    http.expectOne(`${base}/inventario/ajustes`).flush(
      { mensaje: 'El conteo físico coincide con el stock del sistema' },
      { status: 422, statusText: 'Unprocessable Entity' }
    );

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(c['enviando']()).toBe(false);
    expect(c['errorServidor']()).toBeTruthy();
  });

  it('cerrar sin enviar cierra el diálogo sin resultado', () => {
    const { c, dialogRef } = crear(DATA);
    c['dialogRef'].close();
    expect(dialogRef.close).toHaveBeenCalledWith();
  });
});
