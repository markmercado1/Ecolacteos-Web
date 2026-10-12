import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ComunicadoConfirmacionResponse, ComunicadoResponse } from '../../data-access/comunicado.models';
import { ComunicadosApi } from '../../data-access/comunicados.api';

export interface ConfirmacionesDialogData {
  comunicado: ComunicadoResponse;
}

@Component({
  selector: 'app-confirmaciones-dialog',
  imports: [LoadingStateComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="confirmaciones-titulo">Confirmaciones</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="confirmaciones-titulo">
      <p class="mensaje-original">"{{ data.comunicado.mensaje }}"</p>
      <p class="zonas">{{ data.comunicado.zonasNombres.join(', ') }} · {{ data.comunicado.fecha }}</p>

      @if (cargando()) {
        <ui-loading-state mensaje="Cargando confirmaciones…" />
      } @else if (error()) {
        <ui-error-state [error]="error()" (reintentar)="cargar()" />
      } @else if (confirmaciones().length === 0) {
        <ui-empty-state mensaje="Ningún acopiador ha confirmado este comunicado todavía." />
      } @else {
        @for (item of confirmaciones(); track item.id) {
          <div class="confirmacion-item">
            <strong>{{ item.proveedorNombre }}</strong>
            <small>Confirmado por {{ item.acopiadorNombre }} · {{ item.confirmadoEn }}</small>
          </div>
        }
      }
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="dialogRef.close()">Cerrar</button>
    </div>
  `,
  styles: `
    :host {
      display: block; width: min(26rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 85vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .mensaje-original { font-size: var(--font-size-sm); font-style: italic; margin: 0; }
    .zonas { font-size: 0.75rem; color: var(--color-text-muted); margin: var(--space-1) 0 var(--space-4); }
    .confirmacion-item { border-top: 1px solid var(--color-border); padding: var(--space-3) 0; }
    .confirmacion-item strong { display: block; font-size: var(--font-size-sm); }
    .confirmacion-item small { color: var(--color-text-muted); font-size: 0.7rem; }
    .dialog-foot { display: flex; justify-content: flex-end; padding: 0 var(--space-6) var(--space-6); }
  `
})
export class ConfirmacionesDialog {
  protected readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<ConfirmacionesDialogData>(DIALOG_DATA);
  private readonly comunicadosApi = inject(ComunicadosApi);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly confirmaciones = signal<ComunicadoConfirmacionResponse[]>([]);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.comunicadosApi.confirmaciones(this.data.comunicado.id).subscribe({
      next: (confirmaciones) => {
        this.confirmaciones.set(confirmaciones);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(mapHttpError(error));
        this.cargando.set(false);
      }
    });
  }
}
