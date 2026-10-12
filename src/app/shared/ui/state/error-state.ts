import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AppError } from '../../../core/http/app-error';

@Component({
  selector: 'ui-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-error" role="alert">
      <p>{{ error()?.mensaje ?? mensaje() }}</p>
      @if (mostrarReintentar()) {
        <button type="button" class="btn small" (click)="reintentar.emit()">Reintentar</button>
      }
    </div>
  `,
  styles: `
    .ui-error {
      padding: var(--space-8) var(--space-4);
      text-align: center;
      color: var(--color-danger);
      font-size: var(--font-size-sm);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
    }
  `
})
export class ErrorStateComponent {
  readonly error = input<AppError | null>(null);
  readonly mensaje = input('Ocurrió un error inesperado.');
  readonly mostrarReintentar = input(true);
  readonly reintentar = output<void>();
}
