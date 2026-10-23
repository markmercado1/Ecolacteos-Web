import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { CalidadApi } from '../../../calidad/data-access/calidad.api';
import { AnalisisCalidad } from '../../../calidad/data-access/calidad.models';
import { AjusteCalidadEntregaResponse, LineaPagoResponse } from '../../data-access/pago.models';
import { PagosApi } from '../../data-access/pagos.api';

export interface PrecioCalidadDialogData {
  pagoId: string;
  proveedorNombre: string;
  linea: LineaPagoResponse;
}

/** El motivo es obligatorio y no puede ser solo espacios (el servidor también lo exige). */
function motivoConTexto(control: AbstractControl): ValidationErrors | null {
  return String(control.value ?? '').trim() ? null : { motivoVacio: true };
}

/**
 * Fija a mano el precio por litro de UNA entrega ya liquidada (calidad). Solo ADMIN. Exige el análisis de ESA entrega (se ofrecen solo
 * los de esa entrega) y un motivo. No calcula ningún importe: el efecto en el total lo informa el servidor al guardar.
 */
@Component({
  selector: 'app-precio-calidad-dialog',
  imports: [ReactiveFormsModule, DecimalPipe, DatePipe, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="precio-calidad-titulo">Precio de calidad de una entrega</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="precio-calidad-titulo">
      <div class="detail-row"><span>Proveedor</span><b>{{ data.proveedorNombre }}</b></div>
      <div class="detail-row"><span>Entrega</span><b>{{ data.linea.fechaHora | date: 'dd/MM/yyyy HH:mm' }}</b></div>
      <div class="detail-row" data-testid="litros-liquidados">
        <span>Litros liquidados</span><b>{{ data.linea.litrosLiquidados | number: '1.0-2' }} L</b>
      </div>
      <div class="detail-row"><span>Precio normal del pago</span><b>S/ {{ data.linea.precioBase | number: '1.2-3' }}</b></div>
      <div class="detail-row" data-testid="precio-actual">
        <span>Precio aplicado hoy a esta entrega</span><b>S/ {{ data.linea.precioAplicado | number: '1.2-3' }}</b>
      </div>

      <p class="hint">
        Cambia el precio solo de <b>esta entrega</b>: manda sobre el ajuste de precio del pago completo. El pago original se conserva y el
        cambio queda registrado con su análisis y motivo. El total del pago lo recalcula el servidor.
      </p>

      @if (cargandoAnalisis()) {
        <ui-loading-state mensaje="Cargando los análisis de esta entrega…" />
      } @else if (errorAnalisis()) {
        <ui-error-state [error]="errorAnalisis()" (reintentar)="cargarAnalisis()" />
      } @else if (analisis().length === 0) {
        <ui-empty-state mensaje="Esta entrega no tiene análisis de calidad. Sin un análisis no se puede fijar un precio de calidad." />
      } @else {
        <form [formGroup]="form" (ngSubmit)="guardar()" aria-label="Fijar el precio de calidad de esta entrega">
          <div class="field" [class.has-error]="invalido('analisisCalidadId')">
            <label for="analisisCalidadId">Análisis de calidad que lo sustenta</label>
            <select id="analisisCalidadId" formControlName="analisisCalidadId">
              <option value="" disabled>Selecciona un análisis de esta entrega</option>
              @for (a of analisis(); track a.id) {
                <option [value]="a.id">{{ a.folioMuestra }} · {{ a.resultado }} · {{ a.creadoEn | date: 'dd/MM/yyyy HH:mm' }}</option>
              }
            </select>
            @if (invalido('analisisCalidadId')) {
              <small class="field-error" role="alert">Selecciona el análisis de esta entrega.</small>
            }
          </div>
          <div class="field" [class.has-error]="invalido('precioLitroNuevo')">
            <label for="precioCalidad">Nuevo precio por litro de esta entrega (S/)</label>
            <input id="precioCalidad" type="number" step="0.001" min="0.001" max="999.999" inputmode="decimal"
                   formControlName="precioLitroNuevo" placeholder="Ej. 0.900">
            @if (invalido('precioLitroNuevo')) {
              <small class="field-error" role="alert">Ingresa un precio entre 0.001 y 999.999 (hasta 3 decimales).</small>
            }
          </div>
          <div class="field" [class.has-error]="invalido('motivo')">
            <label for="motivoCalidad">Motivo</label>
            <textarea id="motivoCalidad" rows="2" maxlength="500" formControlName="motivo"
                      placeholder="Ej. Agua añadida detectada en el análisis"></textarea>
            @if (invalido('motivo')) {
              <small class="field-error" role="alert">El motivo es obligatorio.</small>
            }
          </div>
          @if (sinCambio()) {
            <small class="field-error" data-testid="sin-cambio">Ese ya es el precio aplicado a esta entrega.</small>
          }
          @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
          <div class="dialog-foot">
            <button type="button" class="btn" (click)="dialogRef.close()" [disabled]="guardando()">Cancelar</button>
            <button type="submit" class="btn primary" [disabled]="form.invalid || sinCambio() || guardando()">
              {{ guardando() ? 'Guardando…' : 'Fijar precio de calidad' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    :host {
      display: block; width: min(28rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6) var(--space-6); }
    .detail-row { display: flex; justify-content: space-between; gap: var(--space-3); border-bottom: 1px solid var(--color-border); padding: var(--space-3) 0; font-size: var(--font-size-sm); }
    .detail-row span { color: var(--color-text-muted); }
    .detail-row b { text-align: right; }
    .hint { font-size: 0.75rem; color: var(--color-text-muted); margin: var(--space-3) 0; }
    .field-error { color: var(--color-danger); font-size: 0.75rem; display: block; margin-top: var(--space-1); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: var(--space-3) 0; }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class PrecioCalidadDialog {
  protected readonly dialogRef = inject(DialogRef<AjusteCalidadEntregaResponse | undefined>);
  protected readonly data = inject<PrecioCalidadDialogData>(DIALOG_DATA);
  private readonly pagosApi = inject(PagosApi);
  private readonly calidadApi = inject(CalidadApi);
  private readonly fb = inject(FormBuilder);

  protected readonly cargandoAnalisis = signal(true);
  protected readonly errorAnalisis = signal<AppError | null>(null);
  protected readonly analisis = signal<AnalisisCalidad[]>([]);

  protected readonly guardando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly form = this.fb.group({
    analisisCalidadId: this.fb.nonNullable.control('', Validators.required),
    precioLitroNuevo: this.fb.control<number | null>(null, [
      Validators.required, Validators.min(0.001), Validators.max(999.999), Validators.pattern(/^\d+(\.\d{1,3})?$/)
    ]),
    motivo: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(500), motivoConTexto])
  });
  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  constructor() {
    this.cargarAnalisis();
  }

  /** El precio tecleado ya es el aplicado a esta entrega: el servidor lo rechazaría (no hay nada que cambiar). */
  protected sinCambio(): boolean {
    const precio = this.valores().precioLitroNuevo;
    return this.form.controls.precioLitroNuevo.valid && typeof precio === 'number'
      && Math.round(precio * 1000) === Math.round(this.data.linea.precioAplicado * 1000);
  }

  protected invalido(campo: 'analisisCalidadId' | 'precioLitroNuevo' | 'motivo'): boolean {
    const control = this.form.controls[campo];
    return control.invalid && control.touched;
  }

  protected cargarAnalisis(): void {
    this.cargandoAnalisis.set(true);
    this.errorAnalisis.set(null);
    this.calidadApi.porRegistro(this.data.linea.registroAcopioId).subscribe({
      next: (analisis) => {
        this.analisis.set(analisis);
        this.cargandoAnalisis.set(false);
      },
      error: (error) => {
        this.errorAnalisis.set(mapHttpError(error));
        this.cargandoAnalisis.set(false);
      }
    });
  }

  protected guardar(): void {
    if (this.form.invalid || this.sinCambio() || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }
    const { analisisCalidadId, precioLitroNuevo, motivo } = this.form.getRawValue();
    this.guardando.set(true);
    this.errorServidor.set(null);
    this.pagosApi.aplicarPrecioDeCalidad(this.data.pagoId, this.data.linea.registroAcopioId, {
      precioLitroNuevo: precioLitroNuevo as number,
      analisisCalidadId,
      motivo: motivo.trim()
    }).subscribe({
      next: (ajuste) => this.dialogRef.close(ajuste),
      error: (error) => {
        this.guardando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
