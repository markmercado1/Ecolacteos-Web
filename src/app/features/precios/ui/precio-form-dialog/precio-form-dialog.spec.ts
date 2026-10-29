import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DialogRef } from '@angular/cdk/dialog';
import { PrecioFormDialog } from './precio-form-dialog';

function crear() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DialogRef, useValue: { close } }]
  });
  const f = TestBed.createComponent(PrecioFormDialog);
  f.detectChanges();
  return { f, http: TestBed.inject(HttpTestingController), close, el: f.nativeElement as HTMLElement };
}

describe('PrecioFormDialog — validación', () => {
  it('sin precio ni fecha no deshabilita el botón: explica cada campo, resume y no envía', () => {
    const { f, http, el } = crear();
    const boton = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(boton.disabled).toBe(false);

    boton.click();
    f.detectChanges();
    http.expectNone(() => true);
    expect(el.querySelector('[data-testid="resumen-errores"]')?.textContent).toContain('Precio por litro, Vigente desde');
    const mensajes = Array.from(el.querySelectorAll('.field .error')).map((e) => e.textContent?.trim());
    expect(mensajes).toContain('Ingresa un precio mayor que 0.');
    expect(mensajes).toContain('Indica desde qué fecha rige el precio.');
  });

  it('con los datos completos envía una sola vez aunque se pulse dos veces', () => {
    const { f, http, el } = crear();
    f.componentInstance['form'].patchValue({ precio: 1.5, vigenteDesde: '2026-11-01' });
    const boton = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    boton.click();
    f.detectChanges();
    expect(boton.disabled).toBe(true);
    boton.click();
    http.expectOne((r) => r.method === 'POST').flush({ id: 'p-1' });
    http.verify();
  });
});
