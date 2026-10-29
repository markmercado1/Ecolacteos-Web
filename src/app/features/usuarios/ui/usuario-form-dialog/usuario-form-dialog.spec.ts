import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { UsuarioFormDialog, UsuarioFormDialogData } from './usuario-form-dialog';

function crear(data: UsuarioFormDialogData) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const f = TestBed.createComponent(UsuarioFormDialog);
  f.detectChanges();
  return { f, http: TestBed.inject(HttpTestingController), el: f.nativeElement as HTMLElement };
}

const roles = [{ id: 'r-1', nombre: 'VENTAS' }] as never[];

describe('UsuarioFormDialog — validación', () => {
  it('un alta incompleta no deshabilita el botón: explica qué falta junto a cada campo y no pide nada al servidor', () => {
    const { f, http, el } = crear({ roles });
    const boton = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(boton.disabled).toBe(false);

    boton.click();
    f.detectChanges();
    http.expectNone(() => true);
    expect(el.querySelector('[data-testid="resumen-errores"]')?.textContent).toContain('Nombre completo, Correo electrónico, Rol, Contraseña');
    const mensajes = Array.from(el.querySelectorAll('.field .error')).map((e) => e.textContent?.trim());
    expect(mensajes).toContain('El nombre es obligatorio.');
    expect(mensajes).toContain('El correo es obligatorio.');
    expect(mensajes).toContain('Elige un rol.');
    expect(mensajes).toContain('Escribe una contraseña.');
  });

  it('un correo mal escrito se explica y no se envía', () => {
    const { f, http, el } = crear({ roles });
    f.componentInstance['form'].patchValue({ nombre: 'Ana', email: 'ana', rolNombre: 'VENTAS', password: '12345678' });
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    f.detectChanges();
    http.expectNone(() => true);
    expect(Array.from(el.querySelectorAll('.field .error')).map((e) => e.textContent?.trim())).toContain('Ingresa un correo válido.');
  });
});
