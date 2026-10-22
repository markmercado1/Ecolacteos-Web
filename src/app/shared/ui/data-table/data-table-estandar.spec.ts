import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ListaLocal } from '../../util/lista-local';
import { ColumnaTabla, DataTableComponent } from './data-table';

interface Fila {
  id: string;
  nombre: string;
}

const COLUMNAS: ColumnaTabla[] = [{ clave: 'nombre', etiqueta: 'Nombre' }];

@Component({
  selector: 'app-host-estandar',
  imports: [DataTableComponent],
  template: `
    <ui-data-table
      [columnas]="columnas"
      [filas]="filas"
      [cargando]="cargando"
      titulo="Directorio"
      [buscable]="buscable"
      placeholderBusqueda="Buscar por nombre"
      [pagina]="pagina"
      [totalPaginas]="totalPaginas"
      [totalElementos]="totalElementos"
      [tamano]="20"
      unidad="registros"
      [tamanos]="[10, 20, 50]"
      [resaltarFila]="resaltar"
      [piePagina]="pie"
      (buscar)="buscados.push($event)"
      (cambiarPagina)="paginas.push($event)"
      (cambiarTamano)="tamanos.push($event)"
    />
  `
})
class HostComponent {
  columnas = COLUMNAS;
  filas: Fila[] = [{ id: 'a', nombre: 'Ana' }, { id: 'b', nombre: 'Beto' }];
  cargando = false;
  buscable = true;
  pagina = 0;
  totalPaginas: number | null = 3;
  totalElementos = 45;
  pie: string | undefined;
  resaltar = (f: Fila) => f.id === 'b';
  buscados: string[] = [];
  paginas: number[] = [];
  tamanos: number[] = [];
}

function crear(ajustes: Partial<HostComponent> = {}) {
  const f = TestBed.createComponent(HostComponent);
  Object.assign(f.componentInstance, ajustes);
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement, host: f.componentInstance };
}

describe('DataTableComponent · estándar de tablas', () => {
  it('con totalPaginas muestra el paginador único en el pie y emite los cambios de página', () => {
    const { el, host } = crear();
    expect(el.querySelector('ui-paginador')).not.toBeNull();
    expect(el.querySelector('[data-testid="resumen"]')?.textContent).toBe('Mostrando 1–20 de 45 registros');
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Siguiente')) as HTMLButtonElement).click();
    expect(host.paginas).toEqual([1]);
  });

  it('emite el cambio de «Filas»', () => {
    const { el, host, f } = crear();
    const select = el.querySelector('ui-paginador select') as HTMLSelectElement;
    select.value = '10';
    select.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(host.tamanos).toEqual([10]);
  });

  it('sin totalPaginas no hay paginador y se usa el pie de texto', () => {
    const { el } = crear({ totalPaginas: null, pie: '2 registros' });
    expect(el.querySelector('ui-paginador')).toBeNull();
    expect(el.querySelector('.table-foot')?.textContent?.trim()).toBe('2 registros');
  });

  it('mientras carga no muestra el paginador', () => {
    expect(crear({ cargando: true }).el.querySelector('ui-paginador')).toBeNull();
  });

  it('buscable pone el buscador en la barra de la tabla y reemite lo que se busca', () => {
    vi.useFakeTimers();
    try {
      const { el, host, f } = crear();
      const input = el.querySelector('ui-buscador input') as HTMLInputElement;
      expect(input.getAttribute('placeholder')).toBe('Buscar por nombre');
      input.value = 'ana';
      input.dispatchEvent(new Event('input'));
      f.detectChanges();
      vi.advanceTimersByTime(400);
      expect(host.buscados).toEqual(['ana']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sin buscable no hay buscador', () => {
    expect(crear({ buscable: false }).el.querySelector('ui-buscador')).toBeNull();
  });

  it('resalta solo la fila indicada', () => {
    const { el } = crear();
    const filas = Array.from(el.querySelectorAll('tbody tr'));
    expect(filas[0].classList.contains('resaltada')).toBe(false);
    expect(filas[1].classList.contains('resaltada')).toBe(true);
  });
});

@Component({
  selector: 'app-host-lista',
  imports: [DataTableComponent],
  template: `<ui-data-table [columnas]="columnas" [lista]="lista" titulo="Catálogo" unidad="zonas" mensajeVacio="Sin zonas" />`
})
class HostListaComponent {
  columnas = COLUMNAS;
  fuente = signal<Fila[]>(Array.from({ length: 25 }, (_, i) => ({ id: `z${i}`, nombre: `Zona ${i + 1}` })));
  lista = new ListaLocal(this.fuente, { campos: (f) => [f.nombre], id: (f) => f.id });
}

describe('DataTableComponent · [lista] (ListaLocal)', () => {
  function crearLista() {
    const f = TestBed.createComponent(HostListaComponent);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement, host: f.componentInstance };
  }

  it('toma de la lista las filas de la página, el buscador y el paginador', () => {
    const { el } = crearLista();
    expect(el.querySelectorAll('tbody tr')).toHaveLength(20);
    expect(el.querySelector('ui-buscador')).not.toBeNull();
    expect(el.querySelector('[data-testid="resumen"]')?.textContent).toBe('Mostrando 1–20 de 25 zonas');
  });

  it('cambiar de página y de tamaño actúa sobre la lista', () => {
    const { f, el, host } = crearLista();
    host.lista.irA(1);
    f.detectChanges();
    expect(el.querySelectorAll('tbody tr')).toHaveLength(5);
    host.lista.cambiarTamano(10);
    f.detectChanges();
    expect(el.querySelectorAll('tbody tr')).toHaveLength(10);
  });

  it('con una búsqueda sin coincidencias lo dice con el texto buscado', () => {
    const { f, el, host } = crearLista();
    host.lista.buscar('inexistente');
    f.detectChanges();
    expect(el.textContent).toContain('Ningún resultado coincide con «inexistente».');
  });

  it('resalta la fila revelada', () => {
    vi.useFakeTimers();
    try {
      const { f, el, host } = crearLista();
      host.lista.revelar('z12');
      f.detectChanges();
      const resaltadas = el.querySelectorAll('tbody tr.resaltada');
      expect(resaltadas).toHaveLength(1);
      expect(resaltadas[0].textContent).toContain('Zona 13');
    } finally {
      vi.useRealTimers();
    }
  });
});
