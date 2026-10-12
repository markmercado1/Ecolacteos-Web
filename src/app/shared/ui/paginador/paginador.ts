import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { textoPie } from '../../util/paginacion';

/**
 * Pie de paginación para listas que no usan ui-data-table (tarjetas, diálogos). Mismos botones ‹ › y mismo
 * texto que el pie de ventas-page. Emite la página destino; quien lo usa decide si recarga.
 */
@Component({
  selector: 'ui-paginador',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-paginador">
      <span>{{ texto() }}</span>
      <div class="paginacion">
        <button
          type="button"
          class="page-btn"
          [disabled]="deshabilitado() || pagina() === 0"
          (click)="cambiar.emit(pagina() - 1)"
          aria-label="Página anterior"
        >‹</button>
        <button
          type="button"
          class="page-btn"
          [disabled]="deshabilitado() || pagina() + 1 >= totalPaginas()"
          (click)="cambiar.emit(pagina() + 1)"
          aria-label="Página siguiente"
        >›</button>
      </div>
    </div>
  `,
  styles: `
    .ui-paginador {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      flex-wrap: wrap;
      padding: var(--space-3) 0;
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }
  `
})
export class PaginadorComponent {
  /** Página actual, empieza en 0. */
  readonly pagina = input.required<number>();
  readonly totalPaginas = input.required<number>();
  readonly totalElementos = input.required<number>();
  /** Sustantivo plural para el texto: "comunicados", "entregas"... */
  readonly unidad = input('resultados');
  readonly deshabilitado = input(false);
  readonly cambiar = output<number>();

  protected readonly texto = computed(() =>
    textoPie(this.pagina(), this.totalPaginas(), this.totalElementos(), this.unidad())
  );
}
