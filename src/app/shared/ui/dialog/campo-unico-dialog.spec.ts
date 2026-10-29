import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { CampoUnicoDialog } from './campo-unico-dialog';

function crear(valorInicial = '') {
  const guardar = vi.fn(() => of({ ok: true }));
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: { titulo: 'Nueva zona', etiquetaCampo: 'Nombre de la zona', valorInicial, guardar } },
      { provide: DialogRef, useValue: { close } }
    ]
  });
  const f = TestBed.createComponent(CampoUnicoDialog);
  f.detectChanges();
  return { f, guardar, close, el: f.nativeElement as HTMLElement };
}

describe('CampoUnicoDialog — validación', () => {
  it('el botón no se deshabilita por estar vacío: al intentar guardar dice qué falta y no guarda', () => {
    const { f, guardar, el } = crear();
    const boton = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(boton.disabled).toBe(false);

    boton.click();
    f.detectChanges();
    expect(guardar).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="resumen-errores"]')?.textContent).toContain('Valor');
    expect(el.querySelector('.field .error')?.textContent).toContain('Completa «Nombre de la zona»');
  });

  it('con el campo completo guarda y cierra una sola vez', () => {
    const { f, guardar, close, el } = crear('Chugur');
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    f.detectChanges();
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith({ ok: true });
  });
});
