import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { rangoMostrado, ventanaPaginas } from '../../util/paginacion';

/**
 * Paginador único del sistema: lo usa `ui-data-table` en el pie de TODAS las tablas y lo usan directamente las listas
 * que no son tabla (tarjetas, diálogos). Muestra qué filas se ven («Mostrando 21–40 de 87 proveedores»), «Anterior» /
 * «Siguiente», los números de página con «…» donde hay saltos, y —si se le pasan `tamanos`— el selector «Filas».
 * Emite la página destino (base 0); quien lo usa decide si recarga. Con una sola página no dibuja los controles.
 */
@Component({
  selector: 'ui-paginador',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-paginador">
      <span class="resumen" data-testid="resumen">{{ resumen() }}</span>
      <div class="controles">
        @if (tamanos().length > 0) {
          <label class="tamano">
            Filas
            <select [value]="tamano()" [disabled]="deshabilitado()" (change)="cambiarTamano.emit(+$any($event.target).value)">
              @for (opcion of tamanos(); track opcion) {
                <option [value]="opcion" [selected]="opcion === tamano()">{{ opcion }}</option>
              }
            </select>
          </label>
        }
        @if (totalPaginas() > 1) {
          <nav class="paginacion" aria-label="Paginación">
            <button
              type="button"
              class="page-btn texto"
              [disabled]="deshabilitado() || pagina() === 0"
              (click)="cambiar.emit(pagina() - 1)"
              aria-label="Página anterior"
            >‹ Anterior</button>
            @for (p of ventana(); track $index) {
              @if (p === null) {
                <span class="salto" aria-hidden="true">…</span>
              } @else {
                <button
                  type="button"
                  class="page-btn"
                  [class.activa]="p === pagina()"
                  [attr.aria-current]="p === pagina() ? 'page' : null"
                  [attr.aria-label]="'Página ' + (p + 1)"
                  [disabled]="deshabilitado()"
                  (click)="p !== pagina() && cambiar.emit(p)"
                >{{ p + 1 }}</button>
              }
            }
            <button
              type="button"
              class="page-btn texto"
              [disabled]="deshabilitado() || pagina() + 1 >= totalPaginas()"
              (click)="cambiar.emit(pagina() + 1)"
              aria-label="Página siguiente"
            >Siguiente ›</button>
          </nav>
        }
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
      width: 100%;
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }
    .controles {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }
    .tamano {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .tamano select {
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      border-radius: var(--radius-control);
      min-height: 2rem;
      padding: 0 var(--space-2);
      font-size: 0.75rem;
      color: var(--color-text);
    }
    .paginacion {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      flex-wrap: wrap;
    }
    /* Mismos botones .page-btn del sistema; los de texto crecen, el de la página actual se rellena. */
    .page-btn.texto {
      width: auto;
      padding: 0 var(--space-3);
      font-weight: 700;
    }
    .page-btn.activa {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #fff;
    }
    .page-btn.activa:disabled {
      opacity: 1;
    }
    .salto {
      width: 1.25rem;
      text-align: center;
      color: var(--color-text-muted);
    }
    @media (max-width: 600px) {
      .ui-paginador { justify-content: center; }
      .resumen { width: 100%; text-align: center; }
    }
  `
})
export class PaginadorComponent {
  /** Página actual, empieza en 0. */
  readonly pagina = input.required<number>();
  readonly totalPaginas = input.required<number>();
  readonly totalElementos = input.required<number>();
  /** Filas por página: se usa para el rango «21–40 de 87» y para el selector. */
  readonly tamano = input(20);
  /** Sustantivo plural para el texto: "comunicados", "entregas"... */
  readonly unidad = input('resultados');
  /** Tamaños que ofrece el selector «Filas». Vacío = sin selector. */
  readonly tamanos = input<number[]>([]);
  readonly deshabilitado = input(false);
  readonly cambiar = output<number>();
  readonly cambiarTamano = output<number>();

  protected readonly ventana = computed(() => ventanaPaginas(this.pagina(), this.totalPaginas()));

  protected readonly resumen = computed(() => {
    const total = this.totalElementos();
    if (total <= 0) return `Sin ${this.unidad()}`;
    const { desde, hasta } = rangoMostrado(this.pagina(), this.tamano(), total);
    return `Mostrando ${desde}–${hasta} de ${total} ${this.unidad()}`;
  });
}
