import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { PagoProveedorResponse } from '../../data-access/pago-proveedor.models';
import { PagoProveedorDetalleDialog } from './pago-proveedor-detalle-dialog';

const base: PagoProveedorResponse = {
  id: 'pp-1', uuidCliente: 'u', proveedorId: 'p-1', proveedorNombre: 'Alejandro Terrones', fechaHora: '2026-10-22T14:05:00', modalidad: 'TRANSFERENCIA', monto: 350,
  concepto: 'Adelanto de octubre', banco: 'BCP', nroOperacion: 'OP-77', nroRecibo: null, observacion: null, usuarioNombre: 'Recepción Uno', estado: 'REGISTRADO',
  anuladoMotivo: null, anuladoPorNombre: null, anuladoEn: null, aplicado: 300, sinAplicar: 50,
  aplicaciones: [{ id: 'a-1', pagoId: 'pg-1', semanaInicio: '2026-10-17', semanaFin: '2026-10-23', monto: 300, usuarioNombre: 'Recepción Uno', creadoEn: '2026-10-22T14:06:00' }]
};

function crear(pago: PagoProveedorResponse) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [{ provide: DIALOG_DATA, useValue: { pago } }, { provide: DialogRef, useValue: { close } }]
  });
  const f = TestBed.createComponent(PagoProveedorDetalleDialog);
  f.detectChanges();
  return { el: f.nativeElement as HTMLElement, close };
}

const texto = (el: HTMLElement) => (el.textContent ?? '').replace(/\s+/g, ' ');

describe('PagoProveedorDetalleDialog', () => {
  it('muestra los datos del pago, lo aplicado, lo que queda sin aplicar y a qué liquidación se aplicó', () => {
    const { el } = crear(base);
    const t = texto(el);
    expect(t).toContain('Transferencia');
    expect(t).toContain('S/ 350.00');
    expect(t).toContain('S/ 300.00');
    expect(t).toContain('Sin aplicar (adelanto)');
    expect(t).toContain('S/ 50.00');
    expect(t).toContain('BCP');
    expect(t).toContain('OP-77');
    expect(t).toContain('22/10/2026 14:05');
    expect(el.querySelectorAll('[data-testid="aplicacion"]').length).toBe(1);
    expect(texto(el.querySelector('[data-testid="aplicacion"]') as HTMLElement)).toContain('Semana 2026-10-17 → 2026-10-23');
    expect(el.querySelector('[data-testid="anulado"]')).toBeNull();
  });

  it('un pago anulado lo dice con texto: quién, cuándo y por qué, y que se conserva', () => {
    const { el } = crear({ ...base, estado: 'ANULADO', anuladoMotivo: 'Se registró dos veces', anuladoPorNombre: 'Administrador', anuladoEn: '2026-10-23T09:00:00', sinAplicar: 0 });
    const anulado = texto(el.querySelector('[data-testid="anulado"]') as HTMLElement);
    expect(anulado).toContain('Pago anulado');
    expect(anulado).toContain('23/10/2026 09:00');
    expect(anulado).toContain('Administrador');
    expect(anulado).toContain('Se registró dos veces');
    expect(anulado).toContain('ya no cuenta en los saldos');
  });

  it('sin aplicaciones lo indica y no muestra datos bancarios que no hay', () => {
    const { el } = crear({ ...base, modalidad: 'EFECTIVO', banco: null, nroOperacion: null, concepto: null, aplicado: 0, sinAplicar: 350, aplicaciones: [] });
    expect(el.querySelector('[data-testid="sin-aplicaciones"]')).not.toBeNull();
    expect(texto(el)).not.toContain('Banco');
    expect(texto(el)).not.toContain('N.º de operación');
  });

  it('es solo de lectura: únicamente el botón de cerrar', () => {
    const { el, close } = crear(base);
    const botones = Array.from(el.querySelectorAll('button'));
    expect(botones.every((b) => b.textContent?.trim() === '×' || b.textContent?.trim() === 'Cerrar')).toBe(true);
    botones[botones.length - 1].click();
    expect(close).toHaveBeenCalled();
  });
});
