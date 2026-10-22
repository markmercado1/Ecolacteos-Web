import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PaginadorComponent } from './paginador';

@Component({
  selector: 'app-host-paginador',
  imports: [PaginadorComponent],
  template: `
    <ui-paginador
      [pagina]="pagina"
      [totalPaginas]="totalPaginas"
      [totalElementos]="totalElementos"
      [tamano]="tamano"
      unidad="proveedores"
      [tamanos]="tamanos"
      [deshabilitado]="deshabilitado"
      (cambiar)="paginas.push($event)"
      (cambiarTamano)="tamanosElegidos.push($event)"
    />
  `
})
class HostComponent {
  pagina = 1;
  totalPaginas = 5;
  totalElementos = 87;
  tamano = 20;
  tamanos: number[] = [];
  deshabilitado = false;
  paginas: number[] = [];
  tamanosElegidos: number[] = [];
}

function crear(ajustes: Partial<HostComponent> = {}) {
  const f = TestBed.createComponent(HostComponent);
  Object.assign(f.componentInstance, ajustes);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const botones = () => Array.from(el.querySelectorAll<HTMLButtonElement>('button'));
  const boton = (texto: string) => botones().find((b) => b.textContent?.trim() === texto);
  return { f, el, botones, boton, host: f.componentInstance };
}

describe('PaginadorComponent', () => {
  it('muestra el rango de filas y el total con la unidad', () => {
    const { el } = crear();
    expect(el.querySelector('[data-testid="resumen"]')?.textContent).toBe('Mostrando 21–40 de 87 proveedores');
  });

  it('en la última página el rango se corta en el total', () => {
    const { el } = crear({ pagina: 4 });
    expect(el.querySelector('[data-testid="resumen"]')?.textContent).toBe('Mostrando 81–87 de 87 proveedores');
  });

  it('sin resultados dice «Sin proveedores» y no dibuja controles', () => {
    const { el, botones } = crear({ pagina: 0, totalPaginas: 0, totalElementos: 0 });
    expect(el.querySelector('[data-testid="resumen"]')?.textContent).toBe('Sin proveedores');
    expect(botones()).toHaveLength(0);
  });

  it('con una sola página muestra el resumen pero no los botones', () => {
    const { el, botones } = crear({ pagina: 0, totalPaginas: 1, totalElementos: 7 });
    expect(el.querySelector('[data-testid="resumen"]')?.textContent).toBe('Mostrando 1–7 de 7 proveedores');
    expect(botones()).toHaveLength(0);
  });

  it('Anterior y Siguiente emiten la página destino', () => {
    const { boton, host } = crear();
    boton('‹ Anterior')!.click();
    boton('Siguiente ›')!.click();
    expect(host.paginas).toEqual([0, 2]);
  });

  it('en la primera página Anterior está deshabilitado; en la última, Siguiente', () => {
    expect(crear({ pagina: 0 }).boton('‹ Anterior')!.disabled).toBe(true);
    expect(crear({ pagina: 4 }).boton('Siguiente ›')!.disabled).toBe(true);
  });

  it('dibuja los números de página, marca la actual y permite saltar a otra', () => {
    const { el, boton, host } = crear({ pagina: 1 });
    const actual = el.querySelector('.page-btn.activa');
    expect(actual?.textContent?.trim()).toBe('2');
    expect(actual?.getAttribute('aria-current')).toBe('page');
    boton('4')!.click();
    expect(host.paginas).toEqual([3]);
  });

  it('pulsar la página actual no emite nada', () => {
    const { el, host } = crear({ pagina: 1 });
    (el.querySelector('.page-btn.activa') as HTMLButtonElement).click();
    expect(host.paginas).toEqual([]);
  });

  it('con muchas páginas usa «…» para los saltos', () => {
    const { el } = crear({ pagina: 5, totalPaginas: 12, totalElementos: 240 });
    expect(Array.from(el.querySelectorAll('.salto'))).toHaveLength(2);
    expect(Array.from(el.querySelectorAll('.page-btn:not(.texto)')).map((b) => b.textContent?.trim())).toEqual(['1', '5', '6', '7', '12']);
  });

  it('el selector «Filas» solo aparece si se pasan tamaños y emite el elegido', () => {
    expect(crear().el.querySelector('select')).toBeNull();
    const { el, host, f } = crear({ tamanos: [10, 20, 50] });
    const select = el.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('20');
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(host.tamanosElegidos).toEqual([50]);
  });

  it('deshabilitado bloquea todos los botones (mientras carga)', () => {
    const { botones } = crear({ deshabilitado: true });
    expect(botones().every((b) => b.disabled)).toBe(true);
  });
});
