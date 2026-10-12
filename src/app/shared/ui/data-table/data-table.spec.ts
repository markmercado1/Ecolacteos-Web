import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColumnaTabla, DataTableComponent } from './data-table';

interface FilaPrueba {
  nombre: string;
  zona: string | null;
  telefono: string | null;
}

const COLUMNAS: ColumnaTabla[] = [
  { clave: 'nombre', etiqueta: 'Nombre' },
  { clave: 'zona', etiqueta: 'Zona' },
  { clave: 'telefono', etiqueta: 'Teléfono' }
];

/**
 * Reproduce la forma real de contenido proyectado de usuarios-page.html y
 * proveedores-page.html: un div[toolbar] con un @for generando <option> y,
 * además, un @if, seguido del <ng-template #celda> que arma cada celda.
 * Antes de la corrección, @ContentChild(TemplateRef) sin selector capturaba
 * el TemplateRef del @for del toolbar en vez de #celda, y toda columna
 * terminaba mostrando el campo de la primera opción del filtro.
 */
@Component({
  selector: 'app-host-toolbar-con-bloques',
  imports: [DataTableComponent],
  template: `
    <ui-data-table [columnas]="columnas" [filas]="filas">
      <div toolbar>
        @if (mostrarAyuda) {
          <span>Ayuda</span>
        }
        <select>
          <option value="TODOS">Todos</option>
          @for (op of opciones; track op) {
            <option [value]="op">{{ op }}</option>
          }
        </select>
      </div>
      <ng-template #celda let-fila let-columna="columna">
        @switch (columna) {
          @case ('nombre') { <strong class="c-nombre">{{ fila.nombre }}</strong> }
          @case ('zona') { <span class="c-zona">{{ fila.zona ?? 'Sin zona' }}</span> }
          @case ('telefono') { <span class="c-telefono">{{ fila.telefono ?? 'No registrado' }}</span> }
        }
      </ng-template>
    </ui-data-table>
  `
})
class HostToolbarConBloquesComponent {
  mostrarAyuda = true;
  opciones = ['a', 'b', 'c'];
  columnas = COLUMNAS;
  filas: FilaPrueba[] = [{ nombre: 'Ana Torres', zona: 'Huancayo Norte', telefono: null }];
}

@Component({
  selector: 'app-host-sin-plantilla',
  imports: [DataTableComponent],
  template: `<ui-data-table [columnas]="columnas" [filas]="filas" />`
})
class HostSinPlantillaComponent {
  columnas = COLUMNAS;
  filas: FilaPrueba[] = [{ nombre: 'Ana Torres', zona: 'Huancayo Norte', telefono: null }];
}

describe('DataTableComponent', () => {
  it('cada columna muestra su propio campo aunque el toolbar proyectado tenga @for/@if antes del #celda', () => {
    const fixture = TestBed.createComponent(HostToolbarConBloquesComponent);
    fixture.detectChanges();
    const celdas = fixture.nativeElement.querySelectorAll('tbody td');

    expect(celdas.length).toBe(3);
    expect(celdas[0].querySelector('.c-nombre')?.textContent).toBe('Ana Torres');
    expect(celdas[1].querySelector('.c-zona')?.textContent).toBe('Huancayo Norte');
    expect(celdas[2].querySelector('.c-telefono')?.textContent).toBe('No registrado');
  });

  it('sin ninguna plantilla #celda proyectada, usa fila[columna] como texto por defecto', () => {
    const fixture = TestBed.createComponent(HostSinPlantillaComponent);
    fixture.detectChanges();
    const celdas = fixture.nativeElement.querySelectorAll('tbody td');

    expect(celdas[0].textContent.trim()).toBe('Ana Torres');
    expect(celdas[1].textContent.trim()).toBe('Huancayo Norte');
  });
});
