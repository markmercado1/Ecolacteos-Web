import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BuscadorComponent } from './buscador';

@Component({
  selector: 'app-host-buscador',
  imports: [BuscadorComponent],
  template: `<ui-buscador placeholder="Buscar proveedor" [espera]="350" [valorInicial]="inicial" (buscar)="emitidos.push($event)" />`
})
class HostComponent {
  inicial = '';
  emitidos: string[] = [];
}

function crear(inicial = '') {
  const f = TestBed.createComponent(HostComponent);
  f.componentInstance.inicial = inicial;
  f.detectChanges();
  const input = f.nativeElement.querySelector('input') as HTMLInputElement;
  const escribir = (v: string) => {
    input.value = v;
    input.dispatchEvent(new Event('input'));
    f.detectChanges();
  };
  return { f, input, escribir, emitidos: () => f.componentInstance.emitidos };
}

describe('BuscadorComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('espera a que el usuario deje de teclear y emite el texto recortado una sola vez', () => {
    const { escribir, emitidos } = crear();
    escribir('h');
    vi.advanceTimersByTime(200);
    escribir('hua');
    vi.advanceTimersByTime(200);
    expect(emitidos()).toEqual([]); // sigue escribiendo: nada todavía
    escribir('  huaman ');
    vi.advanceTimersByTime(350);
    expect(emitidos()).toEqual(['huaman']);
  });

  it('no repite una búsqueda que no cambió', () => {
    const { escribir, emitidos } = crear();
    escribir('queso');
    vi.advanceTimersByTime(400);
    escribir('queso ');
    vi.advanceTimersByTime(400);
    expect(emitidos()).toEqual(['queso']);
  });

  it('vaciar el texto emite al instante, sin esperar', () => {
    const { escribir, emitidos } = crear();
    escribir('queso');
    vi.advanceTimersByTime(400);
    escribir('');
    expect(emitidos()).toEqual(['queso', '']);
  });

  it('Enter aplica la búsqueda ya, sin esperar', () => {
    const { input, escribir, emitidos } = crear();
    escribir('yogurt');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(emitidos()).toEqual(['yogurt']);
    vi.advanceTimersByTime(500);
    expect(emitidos()).toEqual(['yogurt']); // la espera pendiente no la repite
  });

  it('el botón × y Escape limpian y emiten vacío', () => {
    const { f, input, escribir, emitidos } = crear();
    escribir('queso');
    vi.advanceTimersByTime(400);
    (f.nativeElement.querySelector('.limpiar') as HTMLButtonElement).click();
    f.detectChanges();
    expect(input.value).toBe('');
    expect(emitidos()).toEqual(['queso', '']);

    escribir('otro');
    vi.advanceTimersByTime(400);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    f.detectChanges();
    expect(emitidos()).toEqual(['queso', '', 'otro', '']);
  });

  it('solo muestra el botón × cuando hay texto', () => {
    const { f, escribir } = crear();
    expect(f.nativeElement.querySelector('.limpiar')).toBeNull();
    escribir('a');
    expect(f.nativeElement.querySelector('.limpiar')).not.toBeNull();
  });

  it('arranca con el valor inicial y no lo vuelve a emitir', () => {
    const { input, emitidos, escribir } = crear('ana');
    expect(input.value).toBe('ana');
    escribir('ana ');
    vi.advanceTimersByTime(400);
    expect(emitidos()).toEqual([]);
  });

  it('tiene etiqueta accesible (placeholder por defecto)', () => {
    const { input } = crear();
    expect(input.getAttribute('aria-label')).toBe('Buscar proveedor');
  });
});
