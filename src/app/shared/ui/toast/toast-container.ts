import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'ui-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-toast-stack" aria-live="polite">
      @for (aviso of toasts.avisos(); track aviso.id) {
        <div class="ui-toast" [class]="aviso.tipo" role="status">
          <span>{{ aviso.mensaje }}</span>
          <button type="button" (click)="toasts.cerrar(aviso.id)" aria-label="Cerrar aviso">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .ui-toast-stack {
      position: fixed;
      right: var(--space-6);
      bottom: var(--space-6);
      z-index: var(--z-toast);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      max-width: 22rem;
    }
    .ui-toast {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      background: var(--color-primary);
      color: var(--color-on-primary);
      border-radius: var(--radius-control);
      padding: var(--space-3) var(--space-4);
      font-size: var(--font-size-sm);
      font-weight: 600;
      box-shadow: var(--shadow-overlay);
      animation: ui-toast-in var(--motion-normal) ease-out;
    }
    .ui-toast.exito { background: var(--color-success); }
    .ui-toast.error { background: var(--color-danger); }
    .ui-toast button {
      background: transparent;
      border: 0;
      color: inherit;
      font-size: 1.1rem;
      line-height: 1;
    }
    @keyframes ui-toast-in {
      from { transform: translateY(8px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ui-toast { animation: none; }
    }
  `
})
export class ToastContainerComponent {
  protected readonly toasts = inject(ToastService);
}
