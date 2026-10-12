import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-empty">
      <p>{{ mensaje() }}</p>
      <ng-content></ng-content>
    </div>
  `,
  styles: `
    .ui-empty {
      padding: var(--space-8) var(--space-4);
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
  `
})
export class EmptyStateComponent {
  readonly mensaje = input('No hay datos para mostrar.');
}
