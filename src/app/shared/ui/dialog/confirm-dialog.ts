import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

export interface ConfirmDialogData {
  titulo: string;
  mensaje: string;
  etiquetaConfirmar?: string;
  peligroso?: boolean;
}

/**
 * Diálogo genérico de confirmación para acciones sensibles (desactivar,
 * reactivar, liquidar, etc.). El texto siempre nombra el objeto concreto y
 * la consecuencia (docs/DISENO.md); eso lo arma quien abre el diálogo, no
 * este componente.
 */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="confirm-titulo">{{ data.titulo }}</h2>
    </div>
    <div class="dialog-body">
      <p>{{ data.mensaje }}</p>
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="dialogRef.close(false)">Cancelar</button>
      <button
        type="button"
        class="btn"
        [class.primary]="!data.peligroso"
        [class.danger]="data.peligroso"
        (click)="dialogRef.close(true)"
      >
        {{ data.etiquetaConfirmar ?? 'Confirmar' }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: min(26rem, 100%);
      background: var(--color-surface);
      border-radius: var(--radius-dialog);
      box-shadow: var(--shadow-overlay);
    }
    .dialog-head { padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .dialog-body p { margin: 0; color: var(--color-text); line-height: 1.5; }
    .dialog-foot {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      padding: 0 var(--space-6) var(--space-6);
    }
  `
})
export class ConfirmDialog {
  protected readonly dialogRef = inject(DialogRef<boolean>);
  protected readonly data = inject<ConfirmDialogData>(DIALOG_DATA);
}
