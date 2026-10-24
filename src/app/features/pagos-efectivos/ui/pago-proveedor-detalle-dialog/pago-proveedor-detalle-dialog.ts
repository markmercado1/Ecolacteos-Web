import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { PagoProveedorResponse, etiquetaModalidad } from '../../data-access/pago-proveedor.models';

export interface PagoProveedorDetalleDialogData {
  pago: PagoProveedorResponse;
}

/** Detalle de solo lectura de un pago a proveedor: datos, aplicaciones a liquidaciones y, si se anuló, quién, cuándo y por qué. */
@Component({
  selector: 'app-pago-proveedor-detalle-dialog',
  imports: [DecimalPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="pp-detalle-titulo">Pago a {{ pago.proveedorNombre }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="pp-detalle-titulo">
      @if (pago.estado === 'ANULADO') {
        <div class="anulado" data-testid="anulado" role="status">
          <b>Pago anulado</b> el {{ pago.anuladoEn | date: 'dd/MM/yyyy HH:mm' }} por {{ pago.anuladoPorNombre }}.
          <span>Motivo: {{ pago.anuladoMotivo }}</span>
          <small>Se conserva el registro; ya no cuenta en los saldos.</small>
        </div>
      }
      <div class="detail-row"><span>Fecha</span><b>{{ pago.fechaHora | date: 'dd/MM/yyyy HH:mm' }}</b></div>
      <div class="detail-row"><span>Modalidad</span><b>{{ modalidad() }}</b></div>
      <div class="detail-row"><span>Monto</span><b>S/ {{ pago.monto | number: '1.2-2' }}</b></div>
      <div class="detail-row"><span>Aplicado a liquidaciones</span><b>S/ {{ pago.aplicado | number: '1.2-2' }}</b></div>
      <div class="detail-row"><span>Sin aplicar (adelanto)</span><b>S/ {{ pago.sinAplicar | number: '1.2-2' }}</b></div>
      @if (pago.banco) { <div class="detail-row"><span>Banco</span><b>{{ pago.banco }}</b></div> }
      @if (pago.nroOperacion) { <div class="detail-row"><span>N.º de operación</span><b>{{ pago.nroOperacion }}</b></div> }
      @if (pago.nroRecibo) { <div class="detail-row"><span>N.º de recibo</span><b>{{ pago.nroRecibo }}</b></div> }
      @if (pago.concepto) { <div class="detail-row"><span>Concepto</span><b>{{ pago.concepto }}</b></div> }
      @if (pago.observacion) { <div class="detail-row"><span>Observación</span><b>{{ pago.observacion }}</b></div> }
      <div class="detail-row"><span>Registrado por</span><b>{{ pago.usuarioNombre }}</b></div>

      <div class="section-head"><h3>Liquidaciones a las que se aplicó</h3></div>
      @if (pago.aplicaciones.length === 0) {
        <p class="hint" data-testid="sin-aplicaciones">Todavía no se aplicó a ninguna liquidación.</p>
      } @else {
        @for (a of pago.aplicaciones; track a.id) {
          <div class="aplicacion" data-testid="aplicacion">
            <div class="detail-row">
              <span>Semana {{ a.semanaInicio }} → {{ a.semanaFin }}</span>
              <b>S/ {{ a.monto | number: '1.2-2' }}</b>
            </div>
            <small class="meta">{{ a.usuarioNombre }} · {{ a.creadoEn | date: 'dd/MM/yyyy HH:mm' }}</small>
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
      display: block; width: min(30rem, 100%); max-height: 92vh; overflow-y: auto; background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay);
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .detail-row { display: flex; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border); font-size: var(--font-size-sm); }
    .detail-row b { text-align: right; overflow-wrap: anywhere; }
    .anulado { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); display: grid; gap: var(--space-1); }
    .section-head h3 { font-size: var(--font-size-sm); font-weight: 800; margin: var(--space-4) 0 var(--space-2); }
    .hint { color: var(--color-text-muted); font-size: var(--font-size-sm); margin: 0; }
    .meta { display: block; color: var(--color-text-muted); font-size: 0.75rem; padding-bottom: var(--space-2); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); padding: 0 var(--space-6) var(--space-6); }
  `
})
export class PagoProveedorDetalleDialog {
  protected readonly dialogRef = inject(DialogRef<void>);
  protected readonly pago = inject<PagoProveedorDetalleDialogData>(DIALOG_DATA).pago;

  protected modalidad(): string {
    return etiquetaModalidad(this.pago.modalidad);
  }
}
