import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { PagoProveedorResponse, SaldoPagoResponse, etiquetaEstadoSaldo } from '../../data-access/pago-proveedor.models';
import { PagosProveedorApi } from '../../data-access/pagos-proveedor.api';

export interface AplicarPagoDialogData {
  pago: PagoProveedorResponse;
}

/**
 * Aplica lo que queda de un pago (un adelanto, por ejemplo) a una liquidación del MISMO proveedor. Muestra solo las liquidaciones con
 * saldo por pagar; los topes (lo que queda del pago y el saldo de la liquidación) los decide el servidor.
 */
@Component({
  selector: 'app-aplicar-pago-proveedor-dialog',
  imports: [ReactiveFormsModule, DecimalPipe, LoadingStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="aplicar-pago-titulo">Aplicar pago a una liquidación</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="aplicar-pago-titulo">
      <p class="resumen" data-testid="resumen-pago">
        {{ data.pago.proveedorNombre }} · pago de S/ {{ data.pago.monto | number: '1.2-2' }} ·
        <b>queda por aplicar S/ {{ data.pago.sinAplicar | number: '1.2-2' }}</b>
      </p>
      @if (cargando()) {
        <ui-loading-state mensaje="Cargando liquidaciones…" />
      } @else if (errorCarga()) {
        <ui-error-state [error]="errorCarga()" (reintentar)="cargar()" />
      } @else if (pendientes().length === 0) {
        <p class="hint" data-testid="sin-pendientes">Este proveedor no tiene liquidaciones con saldo por pagar.</p>
      } @else {
        <div class="field">
          <label for="ap-liquidacion">Liquidación</label>
          <select id="ap-liquidacion" formControlName="pagoId" required>
            <option value="" disabled>Selecciona una liquidación</option>
            @for (l of pendientes(); track l.pagoId) {
              <option [value]="l.pagoId">{{ l.semanaInicio }} → {{ l.semanaFin }} · saldo S/ {{ l.saldo | number: '1.2-2' }} ({{ etiqueta(l.estado) }})</option>
            }
          </select>
        </div>
        <div class="field" [class.has-error]="form.controls.monto.invalid && form.controls.monto.touched">
          <label for="ap-monto">Monto a aplicar (S/)</label>
          <input id="ap-monto" type="number" step="0.01" min="0.01" inputmode="decimal" formControlName="monto" required>
        </div>
      }
      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="form.invalid || enviando() || pendientes().length === 0">
          {{ enviando() ? 'Aplicando…' : 'Aplicar' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block; width: min(28rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay);
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    .resumen { margin: 0 0 var(--space-4); font-size: var(--font-size-sm); }
    .hint { color: var(--color-text-muted); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class AplicarPagoProveedorDialog {
  protected readonly dialogRef = inject(DialogRef<PagoProveedorResponse | undefined>);
  protected readonly data = inject<AplicarPagoDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PagosProveedorApi);

  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<AppError | null>(null);
  protected readonly liquidaciones = signal<SaldoPagoResponse[]>([]);
  protected readonly pendientes = computed(() => this.liquidaciones().filter((l) => l.saldo > 0));
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly form = this.fb.group({
    pagoId: this.fb.nonNullable.control('', Validators.required),
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01), Validators.pattern(/^\d+(\.\d{1,2})?$/)])
  });

  constructor() {
    this.cargar();
  }

  protected etiqueta(estado: string): string {
    return etiquetaEstadoSaldo(estado);
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.api.saldoDelProveedor(this.data.pago.proveedorId).subscribe({
      next: (saldo) => {
        this.liquidaciones.set(saldo.liquidaciones);
        this.cargando.set(false);
      },
      error: (error) => {
        this.errorCarga.set(mapHttpError(error));
        this.cargando.set(false);
      }
    });
  }

  protected enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    const { pagoId, monto } = this.form.getRawValue();
    this.enviando.set(true);
    this.errorServidor.set(null);
    this.api.aplicar(this.data.pago.id, [{ pagoId, monto: monto as number }]).subscribe({
      next: (pago) => this.dialogRef.close(pago),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
