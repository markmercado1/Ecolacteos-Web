import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { AjustePagoResponse, PagoResponse } from '../../data-access/pago.models';
import { PagosApi } from '../../data-access/pagos.api';

export interface PagoDetalleDialogData {
  pago: PagoResponse;
  esAdmin: boolean;
}

@Component({
  selector: 'app-pago-detalle-dialog',
  imports: [LoadingStateComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="pago-detalle-titulo">Pago de {{ pago().proveedorNombre }}</h2>
      <button type="button" class="close" (click)="dialogRef.close(cambiado())" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="pago-detalle-titulo">
      <div class="detail-row"><span>Semana</span><b>{{ pago().semanaInicio }} → {{ pago().semanaFin }}</b></div>
      <div class="detail-row"><span>Litros liquidados</span><b>{{ pago().litrosTotales }} L</b></div>
      <div class="detail-row"><span>Precio por litro</span><b>S/ {{ pago().precioLitro }}</b></div>
      <div class="detail-row"><span>Total</span><b>S/ {{ pago().total }}</b></div>
      <div class="detail-row"><span>Registros de acopio incluidos</span><b>{{ pago().registroAcopioIds.length }}</b></div>
      <div class="detail-row">
        <span>Comprobante</span>
        <b>{{ pago().comprobanteGenerado ? 'Generado' : 'Pendiente' }}</b>
      </div>

      @if (data.esAdmin && !pago().comprobanteGenerado) {
        <button type="button" class="btn primary marcar-btn" [disabled]="marcando()" (click)="confirmarMarcarComprobante()">
          {{ marcando() ? 'Guardando…' : 'Marcar comprobante generado' }}
        </button>
      }

      <div class="section-head">
        <h2>Ajustes de este pago</h2>
        <span>GET /api/pagos/&#123;id&#125;/ajustes</span>
      </div>
      @if (cargandoAjustes()) {
        <ui-loading-state mensaje="Cargando ajustes…" />
      } @else if (errorAjustes()) {
        <ui-error-state [error]="errorAjustes()" (reintentar)="cargarAjustes()" />
      } @else if (ajustes().length === 0) {
        <ui-empty-state mensaje="Sin ajustes registrados para este pago." />
      } @else {
        @for (ajuste of ajustes(); track ajuste.id) {
          <div class="detail-row">
            <span>{{ ajuste.litrosDiferencia > 0 ? '+' : '' }}{{ ajuste.litrosDiferencia }} L</span>
            <b>S/ {{ ajuste.monto }} · {{ ajuste.estado }}</b>
          </div>
        }
      }
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="dialogRef.close(cambiado())">Cerrar</button>
    </div>
  `,
  styles: `
    :host {
      display: block; width: min(28rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 85vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .detail-row { display: flex; justify-content: space-between; gap: var(--space-3); border-bottom: 1px solid var(--color-border); padding: var(--space-3) 0; font-size: var(--font-size-sm); }
    .detail-row span { color: var(--color-text-muted); }
    .detail-row b { text-align: right; }
    .marcar-btn { width: 100%; margin: var(--space-4) 0; }
    .section-head { display: flex; justify-content: space-between; align-items: baseline; margin: var(--space-4) 0 var(--space-2); }
    .section-head h2 { font-size: var(--font-size-sm); font-weight: 800; margin: 0; }
    .section-head span { font-size: 0.65rem; color: var(--color-text-muted); }
    .dialog-foot { display: flex; justify-content: flex-end; padding: 0 var(--space-6) var(--space-6); }
  `
})
export class PagoDetalleDialog {
  protected readonly dialogRef = inject(DialogRef<boolean>);
  protected readonly data = inject<PagoDetalleDialogData>(DIALOG_DATA);
  private readonly pagosApi = inject(PagosApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly pago = signal(this.data.pago);
  protected readonly cambiado = signal(false);
  protected readonly marcando = signal(false);

  protected readonly cargandoAjustes = signal(true);
  protected readonly errorAjustes = signal<AppError | null>(null);
  protected readonly ajustes = signal<AjustePagoResponse[]>([]);

  constructor() {
    this.cargarAjustes();
  }

  protected cargarAjustes(): void {
    this.cargandoAjustes.set(true);
    this.errorAjustes.set(null);
    this.pagosApi.ajustesDePago(this.pago().id).subscribe({
      next: (ajustes) => {
        this.ajustes.set(ajustes);
        this.cargandoAjustes.set(false);
      },
      error: (error) => {
        this.errorAjustes.set(mapHttpError(error));
        this.cargandoAjustes.set(false);
      }
    });
  }

  protected confirmarMarcarComprobante(): void {
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      ariaLabel: 'Marcar comprobante generado',
      data: {
        titulo: 'Marcar comprobante generado',
        mensaje: `Esto marca el pago de "${this.pago().proveedorNombre}" como con comprobante generado. Es solo una marca administrativa, no un documento ni un desembolso.`,
        etiquetaConfirmar: 'Marcar como generado'
      }
    });
    ref.closed.subscribe((confirmado) => {
      if (!confirmado) return;
      this.marcando.set(true);
      this.pagosApi.marcarComprobante(this.pago().id).subscribe({
        next: (actualizado) => {
          this.pago.set(actualizado);
          this.cambiado.set(true);
          this.marcando.set(false);
          this.toast.exito('Comprobante marcado como generado.');
        },
        error: (error) => {
          this.marcando.set(false);
          this.toast.error(mapHttpError(error).mensaje);
        }
      });
    });
  }
}
