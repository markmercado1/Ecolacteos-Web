import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { AjusteInventarioResponse } from '../../data-access/inventario.models';
import { InventarioApi } from '../../data-access/inventario.api';

export interface AjustarStockDialogData {
  presentacionId: string;
  presentacionNombre: string;
  productoNombre: string;
  /** Stock del sistema al momento de abrir el diálogo -- solo informativo; el backend vuelve a leerlo bajo
   *  su propio bloqueo pesimista al confirmar, por si cambió mientras el diálogo estaba abierto. */
  stockActual: number;
}

/**
 * Inventario: acción "Ajustar stock" (ADMIN), para diferencias encontradas al contar físicamente
 * (pérdidas, roturas, errores de conteo). Nunca devuelve ni consume leche, nunca reescribe cómo se produjo
 * -- solo agrega un movimiento nuevo al libro mayor con motivo/usuario/fecha. Presentación y producto llegan
 * preseleccionados y se muestran como texto (mismo patrón separado-sin-apilar que el resto de la app): el
 * formulario real es solo la cantidad contada físicamente y el motivo.
 */
@Component({
  selector: 'app-ajustar-stock-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="ajustar-stock-titulo">Ajustar stock</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="ajustar-stock-titulo">
      <dl class="identificacion">
        <div><dt>Producto</dt><dd>{{ data.productoNombre }}</dd></div>
        <div><dt>Presentación</dt><dd>{{ data.presentacionNombre }}</dd></div>
        <div><dt>Stock del sistema</dt><dd>{{ data.stockActual }}</dd></div>
      </dl>

      <div class="field" [class.has-error]="invalido('cantidadFisica')">
        <label for="aj-cantidad">Cantidad contada físicamente</label>
        <input id="aj-cantidad" type="number" min="0" step="1" formControlName="cantidadFisica" required>
        @if (invalido('cantidadFisica')) { <span class="error">Ingresa un número entero de 0 o mayor.</span> }
        <span class="hint">Se guardará como un movimiento nuevo -- nunca se sobrescribe el saldo.</span>
      </div>

      <div class="field" [class.has-error]="invalido('motivo')">
        <label for="aj-motivo">Motivo</label>
        <textarea id="aj-motivo" formControlName="motivo" rows="3" required></textarea>
        @if (invalido('motivo')) { <span class="error">Explica la diferencia encontrada (pérdida, rotura, error de conteo…).</span> }
      </div>

      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="form.invalid || enviando()">
          {{ enviando() ? 'Guardando…' : 'Registrar ajuste' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block; width: min(26rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay);
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    .identificacion { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2) var(--space-4); margin: 0 0 var(--space-5); padding: var(--space-3); background: var(--color-surface-muted, var(--color-border)); border-radius: var(--radius-control); }
    .identificacion dt { color: var(--color-text-muted); font-size: 0.75rem; }
    .identificacion dd { margin: 0.1rem 0 0; font-weight: 700; }
    .field { margin-bottom: var(--space-4); }
    label { display: block; font-size: var(--font-size-sm); font-weight: 600; margin-bottom: var(--space-1); }
    input, textarea { width: 100%; padding: var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-control); font-family: inherit; }
    .hint { display: block; color: var(--color-text-muted); font-size: var(--font-size-sm); margin-top: var(--space-1); }
    .error { color: var(--color-danger); font-size: var(--font-size-sm); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class AjustarStockDialog {
  protected readonly dialogRef = inject(DialogRef<AjusteInventarioResponse | undefined>);
  protected readonly data = inject<AjustarStockDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly inventarioApi = inject(InventarioApi);

  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly form = this.fb.group({
    cantidadFisica: this.fb.control<number | null>(this.data.stockActual, [Validators.required, Validators.min(0)]),
    motivo: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(500)])
  });

  protected invalido(campo: 'cantidadFisica' | 'motivo'): boolean {
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
    const { cantidadFisica, motivo } = this.form.getRawValue();
    this.inventarioApi.ajustarStock({
      presentacionId: this.data.presentacionId,
      cantidadFisica: cantidadFisica!,
      motivo
    }).subscribe({
      next: (respuesta) => this.dialogRef.close(respuesta),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
