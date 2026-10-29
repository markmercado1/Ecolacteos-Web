import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { GenerarPagoDialog } from './generar-pago-dialog';

function crear() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { proveedores: [{ id: 'p-1', nombre: 'Alejandro Terrones' }] } },
      { provide: DialogRef, useValue: { close } }
    ]
  });
  const f = TestBed.createComponent(GenerarPagoDialog);
  f.detectChanges();
  return { f, http: TestBed.inject(HttpTestingController), close };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const comp = (f: ComponentFixture<GenerarPagoDialog>) => f.componentInstance as unknown as Record<string, any>;

describe('GenerarPagoDialog — validación', () => {
  it('el botón no se deshabilita por estar incompleto: al intentar generar explica qué falta, sin llamar al servidor', () => {
    const { f, http } = crear();
    const boton = el(f).querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(boton.disabled).toBe(false);

    boton.click();
    f.detectChanges();
    http.expectNone(() => true);
    expect(el(f).querySelector('[data-testid="resumen-errores"]')?.textContent).toContain('Proveedor, Inicio de semana, Fin de semana');
    expect(el(f).querySelector('#proveedorId-error')?.textContent).toContain('Completa «Proveedor»');
    expect(el(f).querySelector('#semanaFin-error')?.textContent).toContain('Completa «Fin de semana»');
    expect(el(f).querySelector('#semanaInicio')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('con los datos completos envía una sola vez y el botón se deshabilita mientras envía', () => {
    const { f, http } = crear();
    comp(f)['form'].patchValue({ proveedorId: 'p-1', semanaInicio: '2026-10-19', semanaFin: '2026-10-25' });
    comp(f)['enviar']();
    f.detectChanges();
    expect(el(f).querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    comp(f)['enviar']();
    http.expectOne((r) => r.method === 'POST').flush({ id: 'pg-1' });
    http.verify();
  });
});
