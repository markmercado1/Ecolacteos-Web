import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CardComponent } from '../card/card';

interface DatosModuloPendiente {
  titulo: string;
  subtitulo: string;
  fase: number;
  endpoints: string[];
}

/**
 * Página compartida por los módulos que aún no se implementan (Fases 2-5).
 * No simula datos de negocio: solo identifica el módulo, su fase y los
 * endpoints reales que va a consumir (docs/ALCANCE.md, docs/FASES.md).
 */
@Component({
  selector: 'app-pending-feature-page',
  imports: [CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">FASE {{ datos()?.fase }} · EN PREPARACIÓN</div>
        <h1>{{ datos()?.titulo }}</h1>
        <p>{{ datos()?.subtitulo }}</p>
      </div>
    </div>
    <ui-card titulo="Este módulo todavía no está implementado">
      <p>
        Se habilitará en la Fase {{ datos()?.fase }} del proyecto, según
        <code>docs/FASES.md</code>. No se muestran datos de ejemplo mientras tanto.
      </p>
      @if (datos()?.endpoints?.length) {
        <p class="ui-endpoints-label">Consumirá estos endpoints reales:</p>
        <ul class="ui-endpoints">
          @for (endpoint of datos()?.endpoints; track endpoint) {
            <li><code>{{ endpoint }}</code></li>
          }
        </ul>
      }
    </ui-card>
  `,
  styles: `
    .page-heading { margin-bottom: var(--space-6); }
    .eyebrow {
      font-size: 0.6875rem; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--brand-500); font-weight: 800;
    }
    h1 { font-size: clamp(1.4rem, 2.2vw, 1.9rem); margin: var(--space-2) 0 var(--space-1); }
    .page-heading p { margin: 0; color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .ui-endpoints-label { font-weight: 700; margin-bottom: var(--space-2); }
    .ui-endpoints { margin: 0; padding-left: var(--space-6); font-size: var(--font-size-sm); color: var(--color-text-muted); }
    .ui-endpoints li { margin-bottom: var(--space-1); }
    code { background: var(--color-surface-soft); padding: 0.1rem 0.4rem; border-radius: 0.25rem; }
  `
})
export class PendingFeaturePage {
  private readonly route = inject(ActivatedRoute);
  readonly datos = toSignal(
    this.route.data.pipe(map((data) => data as DatosModuloPendiente))
  );
}
