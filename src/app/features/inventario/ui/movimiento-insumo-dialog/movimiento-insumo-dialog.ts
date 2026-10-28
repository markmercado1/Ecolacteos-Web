import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { InsumoResponse } from '../../../catalogos/data-access/insumo.models';
import { MovimientoInsumoResponse } from '../../data-access/kardex.models';
import { KardexApi } from '../../data-access/kardex.api';

export interface MovimientoInsumoDialogData {
  modo: 'INGRESO' | 'AJUSTE';
  insumo: InsumoResponse;
}

/** Cantidad con hasta 2 decimales (insumo.stock es NUMERIC(12,2)). */
const CANTIDAD = /^\d{1,10}(\.\d{1,2})?$/;

/**
 * Ingreso (reposición, PRODUCCION o ADMIN) o ajuste por conteo físico (solo ADMIN) de un insumo. Solo
 * cantidades: no se piden costos. En el ajuste se ingresa el CONTEO REAL; la variación mostrada es una vista
 * previa con el stock leído al abrir: el backend la recalcula bajo bloqueo contra el stock vigente.
 */
@Component({
  selector: 'app-movimiento-insumo-dialog',
  imports: [ReactiveFormsModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="mov-insumo-titulo">{{ esIngreso ? 'Registrar ingreso' : 'Ajustar por conteo físico' }} · {{ data.insumo.nombre }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form class="dialog-body" [formGroup]="form" (ngSubmit)="enviar()" aria-labelledby="mov-insumo-titulo">
      <p class="stock">Stock del sistema: <strong>{{ (data.insumo.stock ?? 0) | number: '1.0-2' }} {{ data.insumo.unidadMedida }}</strong></p>

      <div class="field" [class.has-error]="invalido('cantidad')">
        <label for="mov-cantidad">{{ esIngreso ? 'Cantidad que ingresa' : 'Cantidad contada físicamente' }} ({{ data.insumo.unidadMedida }})</label>
        <input id="mov-cantidad" type="number" [min]="esIngreso ? 0.01 : 0" step="0.01" formControlName="cantidad" required>
        @if (invalido('cantidad')) {
          <span class="error">{{ esIngreso ? 'Ingresa una cantidad mayor que 0' : 'Ingresa un conteo de 0 o más' }}, con hasta dos decimales.</span>
        }
      </div>

      @if (esIngreso) {
        <div class="field">
          <label for="mov-referencia">Documento de respaldo (opcional)</label>
          <input id="mov-referencia" type="text" maxlength="100" formControlName="texto" placeholder="Guía, factura o proveedor">
        </div>
        <div class="field">
          <label for="mov-observacion">Observación (opcional)</label>
          <textarea id="mov-observacion" rows="2" maxlength="500" formControlName="observacion"></textarea>
        </div>
      } @else {
        @if (variacion() !== null) {
          <p class="variacion" [class.negativa]="variacion()! < 0">
            Variación estimada: {{ variacion()! > 0 ? '+' : '' }}{{ variacion() | number: '1.0-2' }} {{ data.insumo.unidadMedida }}
          </p>
        }
        <div class="field" [class.has-error]="invalido('texto')">
          <label for="mov-motivo">Motivo (obligatorio)</label>
          <textarea id="mov-motivo" rows="2" maxlength="500" formControlName="texto" required placeholder="Merma, rotura, error de conteo…"></textarea>
          @if (invalido('texto')) { <span class="error">Indica el motivo del ajuste.</span> }
        </div>
      }

      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando()">
          {{ enviando() ? 'Guardando…' : (esIngreso ? 'Registrar ingreso' : 'Registrar ajuste') }}
        </button>
      </div>
      <p class="hint">Queda en el kardex del insumo con tu usuario, la fecha y hora{{ esIngreso ? '' : ' y el motivo' }}. Los movimientos no se editan ni se eliminan.</p>
    </form>
  `,
  styleUrl: '../movimiento-inventario-dialog.css'
})
export class MovimientoInsumoDialog {
  protected readonly dialogRef = inject(DialogRef<MovimientoInsumoResponse | undefined>);
  protected readonly data = inject<MovimientoInsumoDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(KardexApi);

  protected readonly esIngreso = this.data.modo === 'INGRESO';
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);

  protected readonly form = this.fb.group({
    cantidad: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(this.esIngreso ? 0.01 : 0),
      Validators.pattern(CANTIDAD)
    ]),
    /** Ingreso: referencia (opcional). Ajuste: motivo (obligatorio). */
    texto: this.fb.nonNullable.control('', this.esIngreso
      ? [Validators.maxLength(100)]
      : [Validators.required, Validators.maxLength(500), Validators.pattern(/\S/)]),
    observacion: this.fb.nonNullable.control('', Validators.maxLength(500))
  });

  private readonly cantidadValor = toSignal(this.form.controls.cantidad.valueChanges, { initialValue: null as number | null });
  protected readonly variacion = computed(() => {
    const contado = this.cantidadValor();
    if (this.esIngreso || contado === null || contado === undefined || `${contado}` === '') return null;
    return Math.round((Number(contado) - (this.data.insumo.stock ?? 0)) * 100) / 100;
  });

  protected invalido(campo: 'cantidad' | 'texto'): boolean {
    const c = this.form.controls[campo];
    return c.invalid && c.touched;
  }

  protected enviar(): void {
    if (this.enviando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { cantidad, texto, observacion } = this.form.getRawValue();
    const peticion = this.esIngreso
      ? this.api.registrarIngreso(this.data.insumo.id, {
          cantidad: Number(cantidad),
          referencia: texto.trim() || null,
          observacion: observacion.trim() || null
        })
      : this.api.ajustarInsumo(this.data.insumo.id, { cantidadFisica: Number(cantidad), motivo: texto.trim() });
    this.enviando.set(true);
    this.errorServidor.set(null);
    peticion.subscribe({
      next: (movimiento) => this.dialogRef.close(movimiento),
      error: (e) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(e).mensaje);
      }
    });
  }
}
