import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-loading-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-loading" role="status">
      <span class="ui-spinner" aria-hidden="true"></span>
      <span>{{ mensaje() }}</span>
    </div>
  `,
  styles: `
    .ui-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-8) var(--space-4);
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .ui-spinner {
      width: 1.1rem;
      height: 1.1rem;
      border-radius: 50%;
      border: 2px solid var(--color-border);
      border-top-color: var(--color-primary);
      animation: ui-spin var(--motion-normal, 220ms) linear infinite;
      animation-duration: 700ms;
    }
    @keyframes ui-spin {
      to { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ui-spinner { animation: none; }
    }
  `
})
export class LoadingStateComponent {
  readonly mensaje = input('Cargando…');
}
