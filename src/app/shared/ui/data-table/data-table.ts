import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ContentChild, TemplateRef, input, output } from '@angular/core';
import { AppError } from '../../../core/http/app-error';
import { EmptyStateComponent } from '../state/empty-state';
import { ErrorStateComponent } from '../state/error-state';
import { LoadingStateComponent } from '../state/loading-state';

export interface ColumnaTabla {
  clave: string;
  etiqueta: string;
  alinearFin?: boolean;
}

/**
 * Tabla genérica: el encabezado sale de columnas(), y cada celda se resuelve
 * con la plantilla proyectada marcada como #celda, usando { $implicit: fila,
 * columna }. Sin plantilla proyectada, muestra fila[columna] como texto.
 *
 * La plantilla de celda se busca por el nombre de referencia local `#celda`
 * (no por tipo `TemplateRef` a secas): un `@ContentChild(TemplateRef)` sin
 * selector encuentra CUALQUIER TemplateRef proyectado, incluido el que
 * generan internamente los bloques `@for`/`@if` de un toolbar proyectado
 * (p. ej. las `<option>` de un `<select>` de filtro). Cuando eso ocurre, la
 * tabla reutiliza esa plantilla ajena como si fuera la de celda, con el
 * contexto de la fila, y por eso columnas distintas terminan mostrando el
 * mismo campo (bug real reproducido en data-table.spec.ts). Exigir `#celda`
 * hace la búsqueda inequívoca sin importar qué más haya proyectado.
 */
@Component({
  selector: 'ui-data-table',
  imports: [NgTemplateOutlet, LoadingStateComponent, EmptyStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card table-card">
      @if (titulo()) {
        <div class="table-toolbar">
          <div>
            <h2>{{ titulo() }}</h2>
            @if (subtitulo()) { <p>{{ subtitulo() }}</p> }
          </div>
          <ng-content select="[toolbar]"></ng-content>
        </div>
      }
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              @for (columna of columnas(); track columna.clave) {
                <th [class.align-end]="columna.alinearFin">{{ columna.etiqueta }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @if (cargando()) {
              <tr><td [attr.colspan]="columnas().length"><ui-loading-state /></td></tr>
            } @else if (error()) {
              <tr><td [attr.colspan]="columnas().length">
                <ui-error-state [error]="error()" (reintentar)="reintentar.emit()" />
              </td></tr>
            } @else if (filas().length === 0) {
              <tr><td [attr.colspan]="columnas().length">
                <ui-empty-state [mensaje]="mensajeVacio()" />
              </td></tr>
            } @else {
              @for (fila of filas(); track trackByFn()(fila)) {
                <tr>
                  @for (columna of columnas(); track columna.clave) {
                    <td [class.align-end]="columna.alinearFin">
                      <ng-container
                        *ngTemplateOutlet="celda ?? celdaPorDefecto; context: { $implicit: fila, columna: columna.clave }">
                      </ng-container>
                    </td>
                  }
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
      <ng-template #celdaPorDefecto let-fila let-columna="columna">{{ fila[columna] }}</ng-template>
      @if (piePagina()) {
        <div class="table-foot">
          <span>{{ piePagina() }}</span>
          <ng-content select="[paginacion]"></ng-content>
        </div>
      }
    </div>
  `,
  styles: `
    .table-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-4);
      border-bottom: 1px solid var(--color-border);
      flex-wrap: wrap;
    }
    .table-toolbar h2 { font-size: var(--font-size-base); font-weight: 800; margin: 0; }
    .table-toolbar p { font-size: 0.75rem; color: var(--color-text-muted); margin: var(--space-1) 0 0; }
    .table-scroll { overflow: auto; }
    table { border-collapse: collapse; width: 100%; min-width: 40rem; text-align: left; }
    th {
      background: var(--color-surface-soft);
      color: var(--color-text-muted);
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: var(--space-3) var(--space-4);
      font-weight: 800;
      white-space: nowrap;
    }
    td {
      padding: var(--space-3) var(--space-4);
      border-top: 1px solid var(--color-surface-soft);
      font-size: var(--font-size-sm);
      color: var(--color-text);
    }
    td small {
      display: block;
      color: var(--color-text-muted);
      font-size: 0.7rem;
      margin-top: 0.15rem;
    }
    th.align-end, td.align-end { text-align: right; }
    tbody tr:hover { background: var(--color-surface-soft); }
    .table-foot {
      padding: var(--space-3) var(--space-4);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      border-top: 1px solid var(--color-border);
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }
  `
})
export class DataTableComponent<T = unknown> {
  readonly columnas = input.required<ColumnaTabla[]>();
  readonly filas = input<T[]>([]);
  readonly cargando = input(false);
  readonly error = input<AppError | null>(null);
  readonly mensajeVacio = input('No hay resultados para mostrar.');
  readonly titulo = input<string>();
  readonly subtitulo = input<string>();
  readonly piePagina = input<string>();
  readonly identificarFila = input<(fila: T) => unknown>((fila) => fila);
  readonly reintentar = output<void>();

  @ContentChild('celda', { read: TemplateRef }) celda?: TemplateRef<{ $implicit: T; columna: string }>;

  trackByFn(): (fila: T) => unknown {
    return this.identificarFila();
  }
}
