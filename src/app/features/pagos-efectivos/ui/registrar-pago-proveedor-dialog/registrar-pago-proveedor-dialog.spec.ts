import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { RegistrarPagoDialogData, RegistrarPagoProveedorDialog } from './registrar-pago-proveedor-dialog';

const url = `${environment.apiBaseUrl}/pagos-proveedor`;
const proveedores = [{ id: 'p-1', nombre: 'Alejandro Terrones' }, { id: 'p-2', nombre: 'Irma Quiroz' }] as never[];
const respuesta = { id: 'pp-1', proveedorNombre: 'Alejandro Terrones', aplicaciones: [] };

function crear(data: RegistrarPagoDialogData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close } }
    ]
  });
  const f = TestBed.createComponent(RegistrarPagoProveedorDialog);
  f.detectChanges();
  return { f, http: TestBed.inject(HttpTestingController), close };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const comp = (f: ComponentFixture<RegistrarPagoProveedorDialog>) => f.componentInstance as unknown as Record<string, any>;
const fijo: RegistrarPagoDialogData = { proveedorId: 'p-1', proveedorNombre: 'Alejandro Terrones' };
const conLiquidacion: RegistrarPagoDialogData = { ...fijo, liquidacion: { pagoId: 'pg-1', semana: '2026-10-17 → 2026-10-23', saldo: 600 } };

describe('RegistrarPagoProveedorDialog', () => {
  it('con proveedor fijo no pide elegirlo; sin él ofrece la lista', () => {
    const a = crear(fijo);
    expect(el(a.f).querySelector('[data-testid="proveedor-fijo"]')?.textContent).toContain('Alejandro Terrones');
    expect(el(a.f).querySelector('#pp-proveedor')).toBeNull();
    TestBed.resetTestingModule();

    const b = crear({ proveedores });
    expect(el(b.f).querySelectorAll('#pp-proveedor option').length).toBe(3); // placeholder + 2
    expect(el(b.f).querySelector('[data-testid="aviso-adelanto"]')?.textContent).toContain('adelanto');
  });

  it('el efectivo no pide datos bancarios; transferencia y depósito exigen banco y operación', () => {
    const { f } = crear(fijo);
    expect(el(f).querySelector('[data-testid="datos-bancarios"]')).toBeNull();
    comp(f)['form'].patchValue({ monto: 100 });
    expect(comp(f)['form'].valid).toBe(true);

    comp(f)['form'].patchValue({ modalidad: 'TRANSFERENCIA' });
    f.detectChanges();
    expect(el(f).querySelector('[data-testid="datos-bancarios"]')).not.toBeNull();
    expect(comp(f)['form'].invalid).toBe(true);
    comp(f)['form'].patchValue({ banco: 'BCP' });
    expect(comp(f)['form'].invalid).toBe(true); // falta la operación
    comp(f)['form'].patchValue({ nroOperacion: 'OP-1' });
    expect(comp(f)['form'].valid).toBe(true);
    comp(f)['form'].patchValue({ banco: '   ' });
    expect(comp(f)['form'].invalid).toBe(true);
  });

  it('el monto debe ser positivo y tener a lo sumo 2 decimales', () => {
    const { f } = crear(fijo);
    for (const malo of [0, -5, 10.123]) {
      comp(f)['form'].patchValue({ monto: malo });
      expect(comp(f)['form'].controls.monto.invalid, String(malo)).toBe(true);
    }
    comp(f)['form'].patchValue({ monto: 10.5 });
    expect(comp(f)['form'].controls.monto.valid).toBe(true);
  });

  it('envía la solicitud limpia (sin espacios, sin campos vacíos) con el uuid del diálogo', () => {
    const { f, http, close } = crear(fijo);
    comp(f)['form'].patchValue({ modalidad: 'TRANSFERENCIA', monto: 350, banco: ' BCP ', nroOperacion: ' OP-77 ', nroRecibo: '  ', concepto: ' Adelanto ', observacion: '' });
    comp(f)['enviar']();
    const req = http.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.uuidCliente).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.request.body).toMatchObject({
      proveedorId: 'p-1', modalidad: 'TRANSFERENCIA', monto: 350, banco: 'BCP', nroOperacion: 'OP-77', concepto: 'Adelanto'
    });
    expect(req.request.body.nroRecibo).toBeUndefined();
    expect(req.request.body.observacion).toBeUndefined();
    expect(req.request.body.aplicaciones).toBeUndefined(); // sin liquidación: queda como adelanto
    req.flush(respuesta);
    expect(close).toHaveBeenCalledWith(respuesta);
    http.verify();
  });

  it('desde una liquidación puede aplicarse en el mismo registro, o dejarse como adelanto desmarcando la opción', () => {
    const a = crear(conLiquidacion);
    expect(el(a.f).querySelector('[data-testid="aplicar-liquidacion"]')?.textContent).toContain('2026-10-17 → 2026-10-23');
    comp(a.f)['form'].patchValue({ monto: 250 });
    comp(a.f)['enviar']();
    const con = a.http.expectOne(url);
    expect(con.request.body.aplicaciones).toEqual([{ pagoId: 'pg-1', monto: 250 }]);
    con.flush(respuesta);
    TestBed.resetTestingModule();

    const b = crear(conLiquidacion);
    comp(b.f)['form'].patchValue({ monto: 800, aplicar: false });
    comp(b.f)['enviar']();
    expect(b.http.expectOne(url).request.body.aplicaciones).toBeUndefined();
  });

  it('un rechazo del servidor se muestra y el diálogo sigue abierto; el reintento reutiliza el MISMO uuid', () => {
    const { f, http, close } = crear(conLiquidacion);
    comp(f)['form'].patchValue({ monto: 700 });
    comp(f)['enviar']();
    const primero = http.expectOne(url);
    const uuid = primero.request.body.uuidCliente;
    primero.flush({ mensaje: 'El monto a aplicar (700) supera el saldo de la liquidación (600)' }, { status: 409, statusText: 'Conflict' });
    f.detectChanges();
    expect(el(f).textContent).toContain('supera el saldo de la liquidación');
    expect(close).not.toHaveBeenCalled();
    expect(comp(f)['enviando']()).toBe(false);

    comp(f)['form'].patchValue({ monto: 600 });
    comp(f)['enviar']();
    const segundo = http.expectOne(url);
    expect(segundo.request.body.uuidCliente).toBe(uuid); // reenviar no crea otro pago
    segundo.flush(respuesta);
    expect(close).toHaveBeenCalledWith(respuesta);
  });

  it('el botón no se deshabilita por estar incompleto: al intentar registrar explica qué falta, sin pedir nada al servidor', () => {
    const { f, http } = crear({ proveedores });
    const boton = el(f).querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(boton.disabled).toBe(false);

    boton.click();
    f.detectChanges();
    http.expectNone(url);
    expect(el(f).querySelector('[data-testid="resumen-errores"]')?.textContent).toContain('Proveedor, Monto');
    expect(el(f).querySelector('#pp-proveedor-error')?.textContent).toContain('Completa «Proveedor»');
    expect(el(f).querySelector('#pp-monto-error')?.textContent).toContain('Completa «Monto»');
    expect(el(f).querySelector('#pp-monto')?.getAttribute('aria-invalid')).toBe('true');
    expect(el(f).querySelector('#pp-monto')?.getAttribute('aria-describedby')).toBe('pp-monto-error');
  });

  it('un monto en cero o con demasiados decimales recibe un mensaje propio; la transferencia sin banco ni operación pide ambos', () => {
    const { f } = crear(fijo);
    comp(f)['form'].patchValue({ monto: 0, modalidad: 'TRANSFERENCIA' });
    comp(f)['enviar']();
    f.detectChanges();
    expect(el(f).querySelector('#pp-monto-error')?.textContent).toContain('mayor que cero');
    expect(el(f).querySelector('#pp-banco-error')?.textContent).toContain('Indica el banco');
    expect(el(f).querySelector('#pp-operacion-error')?.textContent).toContain('número de operación');

    const monto = el(f).querySelector<HTMLInputElement>('#pp-monto')!;
    monto.value = '10.123';
    monto.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(el(f).querySelector('#pp-monto-error')?.textContent).toContain('2 decimales');
  });

  it('al corregir y volver a intentar, el resumen desaparece y se envía una sola vez', () => {
    const { f, http } = crear(fijo);
    comp(f)['enviar']();
    f.detectChanges();
    expect(el(f).querySelector('[data-testid="resumen-errores"]')).not.toBeNull();

    comp(f)['form'].patchValue({ monto: 25 });
    comp(f)['enviar']();
    f.detectChanges();
    expect(el(f).querySelector('[data-testid="resumen-errores"]')).toBeNull();
    http.expectOne(url).flush(respuesta);
    http.verify();
  });

  it('no envía un formulario inválido ni dos veces mientras envía', () => {
    const { f, http } = crear(fijo);
    comp(f)['enviar']();
    http.expectNone(url);
    comp(f)['form'].patchValue({ monto: 10 });
    comp(f)['enviar']();
    comp(f)['enviar']();
    http.expectOne(url).flush(respuesta);
    http.verify();
  });
});
