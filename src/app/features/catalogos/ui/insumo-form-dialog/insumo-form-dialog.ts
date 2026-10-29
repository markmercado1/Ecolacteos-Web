import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { InsumoRequest, InsumoResponse } from '../../data-access/insumo.models';
import { InsumosApi } from '../../data-access/insumos.api';
import { pendientesDe, resumenPendientes } from '../../../../shared/util/validacion';

const ETIQUETAS: Record<string, string> = {"nombre":"Nombre","unidadMedida":"Unidad de medida","stock":"Stock inicial"};

export interface InsumoFormDialogData {
  insumo?: InsumoResponse;
}

@Component({
  selector: 'app-insumo-form-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="insumo-titulo">{{ esEdicion ? 'Editar insumo' : 'Nuevo insumo' }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="insumo-titulo">
      <div class="field" [class.has-error]="invalido('nombre')">
        <label for="nombre">Nombre</label>
        <input id="nombre" type="text" formControlName="nombre" placeholder="Cuajo, Sal…" required>
        @if (invalido('nombre')) { <span class="error">Escribe el nombre del insumo.</span> }
      </div>
      <div class="field" [class.has-error]="invalido('unidadMedida')">
        <label for="unidad">Unidad de medida</label>
        <input id="unidad" type="text" formControlName="unidadMedida" placeholder="unidades, sacos, kg…" required>
        @if (invalido('unidadMedida')) { <span class="error">Indica la unidad de medida (unidades, sacos, kg…).</span> }
      </div>
      @if (esEdicion) {
        <!-- V19 (kardex): el stock ya no se edita aquí; cambia solo con movimientos trazables. -->
        <div class="field">
          <span class="label-fijo">Stock actual</span>
          <p class="valor-fijo">{{ data.insumo?.stock ?? 0 }} {{ data.insumo?.unidadMedida }}</p>
          <span class="hint">Para reponer o corregir el stock usa Inventario → Insumos (Registrar ingreso / Ajustar): así queda en el kardex.</span>
        </div>
      } @else {
        <div class="field" [class.has-error]="invalido('stock')">
          <label for="stock">Stock inicial</label>
          <input id="stock" type="number" min="0" step="0.01" formControlName="stock" placeholder="0" required>
          @if (invalido('stock')) {
            <span class="error">Ingresa una cantidad de 0 o más, con hasta dos decimales.</span>
          } @else {
            <span class="hint">Será el saldo inicial del kardex del insumo.</span>
          }
        </div>
      }
      @if (resumen(); as r) { <p class="server-error" role="alert" data-testid="resumen-errores">{{ r }}</p> }
      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando()">
          {{ enviando() ? 'Guardando…' : (esEdicion ? 'Guardar cambios' : 'Crear insumo') }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block; width: min(24rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay);
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .error { font-size: 0.6875rem; color: var(--color-danger); font-weight: 600; }
    .label-fijo { font-size: 0.75rem; font-weight: 700; color: var(--color-text-muted); }
    .valor-fijo { margin: 0.35rem 0; font-weight: 600; }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class InsumoFormDialog {
  protected readonly dialogRef = inject(DialogRef<InsumoResponse | undefined>);
  protected readonly data = inject<InsumoFormDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly insumosApi = inject(InsumosApi);

  protected readonly esEdicion = !!this.data.insumo;
  protected readonly enviando = signal(false);
  /** Frase general tras un intento de guardar con datos pendientes; el detalle va junto a cada campo. */
  protected readonly resumen = signal<string | null>(null);
  protected readonly errorServidor = signal<string | null>(null);

  protected readonly form = this.fb.group({
    nombre: this.fb.nonNullable.control(this.data.insumo?.nombre ?? '', Validators.required),
    unidadMedida: this.fb.nonNullable.control(this.data.insumo?.unidadMedida ?? '', Validators.required),
    stock: this.fb.control<number | null>(this.data.insumo?.stock ?? 0, [
      Validators.required,
      Validators.min(0),
      Validators.pattern(/^\d{1,10}(\.\d{1,2})?$/)
    ])
  });

  protected invalido(campo: 'nombre' | 'unidadMedida' | 'stock'): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

  enviar(): void {
    if (this.enviando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.resumen.set(resumenPendientes(pendientesDe(this.form, ETIQUETAS)));
      return;
    }
    this.resumen.set(null);
    this.enviando.set(true);
    this.errorServidor.set(null);
    const { nombre, unidadMedida, stock } = this.form.getRawValue();
    // V19 (kardex): al editar nunca se envía stock (el backend conserva el actual; un valor distinto se
    // rechazaría). Al crear, es el saldo inicial del kardex.
    const datos: InsumoRequest = { nombre, unidadMedida };
    if (!this.esEdicion) datos.stock = stock ?? 0;

    const peticion = this.esEdicion
      ? this.insumosApi.actualizar(this.data.insumo!.id, datos)
      : this.insumosApi.crear(datos);

    peticion.subscribe({
      next: (insumo) => this.dialogRef.close(insumo),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
