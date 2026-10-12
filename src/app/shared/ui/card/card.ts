import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Tarjeta base: usa .card/.card-pad de src/styles.css, que a su vez leen theme.css. */
@Component({
  selector: 'ui-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" [class.card-pad]="padded()" [class.tinted]="tinted()">
      @if (titulo()) {
        <header class="ui-card-head">
          <h2>{{ titulo() }}</h2>
          @if (subtitulo()) { <p>{{ subtitulo() }}</p> }
        </header>
      }
      <ng-content></ng-content>
    </div>
  `,
  styles: `
    .ui-card-head {
      margin-bottom: var(--space-4);
    }
    .ui-card-head h2 {
      font-size: var(--font-size-lg);
      font-weight: 800;
      margin: 0 0 var(--space-1);
    }
    .ui-card-head p {
      margin: 0;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .card.tinted {
      background: var(--color-surface-soft);
      border-color: var(--brand-accent);
    }
  `
})
export class CardComponent {
  readonly titulo = input<string>();
  readonly subtitulo = input<string>();
  readonly padded = input(true);
  readonly tinted = input(false);
}
