import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { PagoProveedorResponse, SaldoPagoResponse } from '../../data-access/pago-proveedor.models';
import { AplicarPagoProveedorDialog } from './aplicar-pago-proveedor-dialog';

const base = `${environment.apiBaseUrl}/pagos-proveedor`;

const pago = { id: 'pp-1', proveedorId: 'p-1', proveedorNombre: 'Alejandro Terrones', monto: 250, sinAplicar: 250 } as PagoProveedorResponse;
const saldo = (id: string, semana: string, valor: number, estado: SaldoPagoResponse['estado']): SaldoPagoResponse => ({
  pagoId: id, proveedorId: 'p-1', semanaInicio: semana, semanaFin: semana, totalAPagar: 600, ajustesLitros: 0, totalConAjustes: 600, aplicado: 600 - valor, saldo: valor, estado
});

function crear(liquidaciones: SaldoPagoResponse[] | 'error') {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { pago } },
      { provide: DialogRef, useValue: { close } }
    ]
  });
  const f = TestBed.createComponent(AplicarPagoProveedorDialog);
  const http = TestBed.inject(HttpTestingController);
  const req = http.expectOne(`${base}/proveedor/p-1/saldo`);
  if (liquidaciones === 'error') {
    req.flush({ mensaje: 'Proveedor no encontrado' }, { status: 404, statusText: 'Not Found' });
  } else {
    req.flush({ proveedorId: 'p-1', proveedorNombre: 'Alejandro Terrones', liquidaciones, saldoLiquidaciones: 0, adelantosSinAplicar: 250, saldoNeto: 0 });
  }
  f.detectChanges();
  return { f, http, close };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const comp = (f: ComponentFixture<AplicarPagoProveedorDialog>) => f.componentInstance as unknown as Record<string, any>;

describe('AplicarPagoProveedorDialog', () => {
  it('muestra cuánto queda por aplicar y solo las liquidaciones con saldo por pagar', () => {
    const { f, http } = crear([saldo('pg-1', '2026-10-17', 350, 'PARCIAL'), saldo('pg-2', '2026-10-10', 0, 'PAGADO'), saldo('pg-3', '2026-10-03', -5, 'SALDO_A_FAVOR')]);
    expect(el(f).querySelector('[data-testid="resumen-pago"]')?.textContent).toContain('queda por aplicar S/ 250.00');
    const opciones = Array.from(el(f).querySelectorAll('#ap-liquidacion option')) as HTMLOptionElement[];
    expect(opciones.length).toBe(2); // placeholder + la única con saldo
    expect(opciones[1].textContent).toContain('saldo S/ 350.00');
    expect(opciones[1].textContent).toContain('Pago parcial');
    http.verify();
  });

  it('sin liquidaciones por pagar lo dice y no deja aplicar', () => {
    const { f, http } = crear([saldo('pg-2', '2026-10-10', 0, 'PAGADO')]);
    expect(el(f).querySelector('[data-testid="sin-pendientes"]')).not.toBeNull();
    expect((el(f).querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    http.verify();
  });

  it('aplica el monto a la liquidación elegida y cierra con el pago actualizado', () => {
    const { f, http, close } = crear([saldo('pg-1', '2026-10-17', 350, 'PENDIENTE')]);
    comp(f)['form'].setValue({ pagoId: 'pg-1', monto: 200 });
    comp(f)['enviar']();
    const req = http.expectOne(`${base}/pp-1/aplicaciones`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ aplicaciones: [{ pagoId: 'pg-1', monto: 200 }] });
    req.flush({ ...pago, aplicado: 200, sinAplicar: 50 });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ aplicado: 200 }));
    http.verify();
  });

  it('si el servidor rechaza (409) muestra el motivo y no cierra', () => {
    const { f, http, close } = crear([saldo('pg-1', '2026-10-17', 100, 'PENDIENTE')]);
    comp(f)['form'].setValue({ pagoId: 'pg-1', monto: 250 });
    comp(f)['enviar']();
    http.expectOne(`${base}/pp-1/aplicaciones`).flush({ mensaje: 'El monto a aplicar (250) supera el saldo de la liquidación' }, { status: 409, statusText: 'Conflict' });
    f.detectChanges();
    expect(el(f).textContent).toContain('supera el saldo de la liquidación');
    expect(close).not.toHaveBeenCalled();
    http.verify();
  });

  it('un error al leer las liquidaciones se muestra y permite reintentar', () => {
    const { f, http } = crear('error');
    expect(comp(f)['errorCarga']()).not.toBeNull();
    comp(f)['cargar']();
    http.expectOne(`${base}/proveedor/p-1/saldo`).flush({ proveedorId: 'p-1', proveedorNombre: 'A', liquidaciones: [saldo('pg-1', '2026-10-17', 10, 'PENDIENTE')], saldoLiquidaciones: 10, adelantosSinAplicar: 0, saldoNeto: 10 });
    f.detectChanges();
    expect(comp(f)['errorCarga']()).toBeNull();
    expect(comp(f)['pendientes']().length).toBe(1);
    http.verify();
  });
});
