import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SaldoPagoResponse } from '../../data-access/pago-proveedor.models';
import { RegistrarPagoProveedorDialog } from '../registrar-pago-proveedor-dialog/registrar-pago-proveedor-dialog';
import { SaldoPagoComponent } from './saldo-pago';

const base = `${environment.apiBaseUrl}/pagos-proveedor`;
const liquidacion = { id: 'pg-1', proveedorId: 'p-1', proveedorNombre: 'Alejandro Terrones', semanaInicio: '2026-10-17', semanaFin: '2026-10-23' };
const saldo = (extra: Partial<SaldoPagoResponse> = {}): SaldoPagoResponse => ({
  pagoId: 'pg-1', proveedorId: 'p-1', semanaInicio: '2026-10-17', semanaFin: '2026-10-23', totalAPagar: 590, ajustesLitros: 0, totalConAjustes: 590, aplicado: 200, saldo: 390,
  estado: 'PARCIAL', ...extra
});

function crear(respuesta: SaldoPagoResponse[] | 'error', dialogOpen = vi.fn()) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Dialog, useValue: { open: dialogOpen } }] });
  const f = TestBed.createComponent(SaldoPagoComponent);
  f.componentRef.setInput('pago', liquidacion);
  f.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  const req = http.expectOne((r) => r.url === `${base}/saldos`);
  expect(req.request.params.get('pagoIds')).toBe('pg-1');
  if (respuesta === 'error') {
    req.flush({ mensaje: 'Error' }, { status: 500, statusText: 'Server Error' });
  } else {
    req.flush(respuesta);
  }
  f.detectChanges();
  return { f, http, dialogOpen };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;

/** El importe (<b>) de la fila cuya etiqueta es exactamente `etiqueta`. */
const valor = (f: ComponentFixture<unknown>, etiqueta: string) =>
  Array.from(el(f).querySelectorAll('.fila')).find((r) => r.querySelector('span')?.textContent?.trim() === etiqueta)?.querySelector('b')?.textContent?.replace(/\s+/g, ' ').trim();

describe('SaldoPagoComponent', () => {
  it('muestra el saldo tal como lo calcula el servidor (total, aplicado, saldo y estado)', () => {
    const { f, http } = crear([saldo()]);
    expect(valor(f, 'Total a pagar')).toBe('S/ 590.00');
    expect(valor(f, 'Aplicado (pagos vigentes)')).toBe('S/ 200.00');
    expect(el(f).querySelector('[data-testid="saldo-saldo"]')?.textContent).toContain('Saldo por pagar');
    expect(el(f).querySelector('[data-testid="saldo-saldo"]')?.textContent).toContain('S/ 390.00');
    expect(el(f).querySelector('[data-testid="saldo-estado"]')?.textContent).toContain('Pago parcial');
    expect(el(f).querySelector('[data-testid="saldo-ajustes"]')).toBeNull(); // sin ajustes de litros no hay línea
    http.verify();
  });

  it('los ajustes de litros aparecen con su signo cuando existen', () => {
    const { f, http } = crear([saldo({ ajustesLitros: -5, totalConAjustes: 585, saldo: 385 })]);
    expect(valor(f, 'Ajustes de litros posteriores')).toBe('−S/ 5.00');
    expect(valor(f, 'Total con ajustes')).toBe('S/ 585.00');
    http.verify();
  });

  it('un saldo negativo se presenta como saldo a favor del proveedor, en positivo y con texto', () => {
    const { f, http } = crear([saldo({ saldo: -5, aplicado: 595, estado: 'SALDO_A_FAVOR' })]);
    const linea = el(f).querySelector('[data-testid="saldo-saldo"]')?.textContent ?? '';
    expect(linea).toContain('Saldo a favor del proveedor');
    expect(linea).toContain('S/ 5.00');
    expect(linea).not.toContain('-');
    expect(el(f).querySelector('[data-testid="saldo-estado"]')?.textContent).toContain('Saldo a favor');
    http.verify();
  });

  it('un error al leer el saldo se muestra y se puede reintentar', () => {
    const { f, http } = crear('error');
    expect(el(f).querySelector('[data-testid="saldo-pago"]')).toBeNull();
    (f.componentInstance as unknown as { cargar: () => void }).cargar();
    http.expectOne((r) => r.url === `${base}/saldos`).flush([saldo()]);
    f.detectChanges();
    expect(el(f).querySelector('[data-testid="saldo-pago"]')).not.toBeNull();
    http.verify();
  });

  it('«Registrar pago» abre el diálogo con esta liquidación y su saldo, y al registrar vuelve a leer el saldo', () => {
    const abrir = vi.fn(() => ({ closed: of({ id: 'pp-9', proveedorNombre: 'Alejandro Terrones' }) }));
    const { f, http } = crear([saldo()], abrir);
    let emitido: unknown;
    f.componentInstance.registrado.subscribe((p) => (emitido = p));
    (el(f).querySelector('[data-testid="registrar-pago"]') as HTMLButtonElement).click();

    expect(abrir).toHaveBeenCalledWith(RegistrarPagoProveedorDialog, expect.objectContaining({
      data: { proveedorId: 'p-1', proveedorNombre: 'Alejandro Terrones', liquidacion: { pagoId: 'pg-1', semana: '2026-10-17 → 2026-10-23', saldo: 390 } }
    }));
    http.expectOne((r) => r.url === `${base}/saldos`).flush([saldo({ aplicado: 590, saldo: 0, estado: 'PAGADO' })]);
    expect(emitido).toMatchObject({ id: 'pp-9' });
    http.verify();
  });

  it('si el diálogo se cierra sin registrar no se vuelve a leer nada', () => {
    const abrir = vi.fn(() => ({ closed: of(undefined) }));
    const { f, http } = crear([saldo()], abrir);
    (el(f).querySelector('[data-testid="registrar-pago"]') as HTMLButtonElement).click();
    http.verify();
  });

  it('si cambia la liquidación mostrada, relee el saldo', () => {
    const { f, http } = crear([saldo()]);
    f.componentRef.setInput('pago', { ...liquidacion });
    f.detectChanges();
    http.expectOne((r) => r.url === `${base}/saldos`).flush([saldo()]);
    http.verify();
  });
});
