import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { EstadoCarga } from '../core/state/catalogo.store';

/**
 * Envoltorio de estados de una carga remota: cargando (esqueleto), error con «Reintentar» y, si todo salió bien, el contenido.
 * Los estados «vacío» los decide cada página (cada una tiene su propio mensaje).
 */
@Component({
  selector: 'pub-estado-carga',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (estado()) {
      @case ('cargando') {
        <div class="esqueleto" role="status" aria-live="polite">
          <span class="visually-hidden">{{ mensaje() }}</span>
          @for (i of fantasmas; track i) { <div class="card ghost"></div> }
        </div>
      }
      @case ('error') {
        <div class="alert alert-error error" role="alert">
          <p><strong>No pudimos cargar la información.</strong></p>
          <p>{{ error() }}</p>
          <button type="button" class="btn btn-sm" (click)="reintentar.emit()">Reintentar</button>
        </div>
      }
      @case ('inicial') {
        <div class="esqueleto" role="status"><span class="visually-hidden">{{ mensaje() }}</span></div>
      }
      @default { <ng-content /> }
    }
  `,
  styles: `
    .esqueleto { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 1.25rem; }
    .ghost { height: 20rem; background: linear-gradient(90deg, #efede3 25%, #f7f5ee 50%, #efede3 75%); background-size: 200% 100%; animation: brillo 1.4s infinite linear; }
    @keyframes brillo { to { background-position: -200% 0; } }
    .error { max-width: 36rem; }
    .error p { margin: 0 0 0.6rem; }
  `
})
export class EstadoCargaComponent {
  readonly estado = input.required<EstadoCarga>();
  readonly error = input<string | null>(null);
  readonly mensaje = input('Cargando…');
  readonly reintentar = output<void>();
  protected readonly fantasmas = [1, 2, 3, 4];
}
