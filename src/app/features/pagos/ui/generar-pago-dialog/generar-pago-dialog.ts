import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { ProveedorPublicoResponse } from '../../../proveedores/data-access/proveedor.models';
import { PagoResponse } from '../../data-access/pago.models';
import { PagosApi } from '../../data-access/pagos.api';

export interface GenerarPagoDialogData {
  proveedores: ProveedorPublicoResponse[];
}

@Component({
  selector: 'app-generar-pago-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="generar-pago-titulo">Generar liquidación</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="generar-pago-titulo">
      <div class="field" [class.has-error]="invalido('proveedorId')">
        <label for="proveedorId">Proveedor</label>
        <select id="proveedorId" formControlName="proveedorId" required>
          <option value="" disabled>Selecciona un proveedor</option>
          @for (proveedor of data.proveedores; track proveedor.id) {
            <option [value]="proveedor.id">{{ proveedor.nombre }}</option>
          }
        </select>
      </div>
      <div class="field" [class.has-error]="invalido('semanaInicio')">
        <label for="semanaInicio">Inicio de semana</label>
        <input id="semanaInicio" type="date" formControlName="semanaInicio" required>
      </div>
      <div class="field" [class.has-error]="invalido('semanaFin')">
        <label for="semanaFin">Fin de semana</label>
        <input id="semanaFin" type="date" formControlName="semanaFin" required>
      </div>
      <div class="drawer-info">
        El servidor calcula los litros del período, aplica el precio vigente y rechaza semanas duplicadas, superpuestas o sin entregas.
      </div>
      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="form.invalid || enviando()">
          {{ enviando() ? 'Generando…' : 'Generar pago' }}
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
    .drawer-info { font-size: 0.75rem; color: var(--color-text-muted); background: var(--color-surface-soft); border-radius: var(--radius-control); padding: var(--space-3); margin: 0 0 var(--space-4); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class GenerarPagoDialog {
  protected readonly dialogRef = inject(DialogRef<PagoResponse | undefined>);
  protected readonly data = inject<GenerarPagoDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly pagosApi = inject(PagosApi);

  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly form = this.fb.group({
    proveedorId: this.fb.nonNullable.control('', Validators.required),
    semanaInicio: this.fb.nonNullable.control('', Validators.required),
    semanaFin: this.fb.nonNullable.control('', Validators.required)
  });

  protected invalido(campo: 'proveedorId' | 'semanaInicio' | 'semanaFin'): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

  enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.errorServidor.set(null);
    this.pagosApi.generar(this.form.getRawValue()).subscribe({
      next: (pago) => this.dialogRef.close(pago),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
