import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { PresentacionResponse } from '../../../catalogos/data-access/producto.models';
import { TipoPrecioResponse } from '../../../tipos-precio/data-access/tipo-precio.models';
import { TiposPrecioApi } from '../../../tipos-precio/data-access/tipos-precio.api';
import { PrecioQuesoResponse } from '../../data-access/precio-queso.models';
import { PreciosQuesoApi } from '../../data-access/precios-queso.api';

export interface PrecioQuesoFormDialogData {
  presentacion: PresentacionResponse;
  productoNombre: string;
}

/**
 * Registrar un precio de presentación (ADMIN), Fase 2 (Precios por presentación, V11). Siempre se abre
 * desde una fila de la lista de precios -- producto y presentación llegan preseleccionados y se muestran
 * como texto (claramente identificados, sin selects redundantes): el formulario real es solo
 * modalidad/precio/vigenteDesde. Serie histórica append-only: sin editar ni eliminar, un registro nuevo
 * abre una vigencia distinta. No es necesario configurar las tres modalidades.
 */
@Component({
  selector: 'app-precio-queso-form-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="precio-queso-form-titulo">Registrar precio</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="precio-queso-form-titulo">
      <dl class="identificacion">
        <div><dt>Producto</dt><dd>{{ data.productoNombre }}</dd></div>
        <div><dt>Presentación</dt><dd>{{ data.presentacion.nombre }}</dd></div>
      </dl>

      <div class="field" [class.has-error]="invalido('modalidad')">
        <label for="pq-modalidad">Modalidad</label>
        <select id="pq-modalidad" formControlName="modalidad" required>
          <option value="" disabled>Selecciona una modalidad</option>
          @for (t of tiposActivos(); track t.codigo) { <option [value]="t.codigo">{{ t.nombre }}</option> }
        </select>
        @if (invalido('modalidad')) { <span class="error">Selecciona una modalidad.</span> }
      </div>

      <div class="field" [class.has-error]="invalido('precio')">
        <label for="pq-precio">Precio (S/)</label>
        <input id="pq-precio" type="number" min="0.01" step="0.01" formControlName="precio" required>
        @if (invalido('precio')) { <span class="error">Ingresa un precio mayor que 0.</span> }
      </div>

      <div class="field" [class.has-error]="invalido('vigenteDesde')">
        <label for="pq-vigenteDesde">Vigente desde</label>
        <input id="pq-vigenteDesde" type="date" formControlName="vigenteDesde" required>
        <span class="hint">Puede ser una fecha futura; el histórico conserva todas las vigencias.</span>
      </div>

      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="form.invalid || enviando()">
          {{ enviando() ? 'Registrando…' : 'Registrar precio' }}
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
    .identificacion { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2) var(--space-4); margin: 0 0 var(--space-5); padding: var(--space-3); background: var(--color-surface-muted, var(--color-border)); border-radius: var(--radius-control); }
    .identificacion dt { color: var(--color-text-muted); font-size: 0.75rem; }
    .identificacion dd { margin: 0.1rem 0 0; font-weight: 700; }
    .field { margin-bottom: var(--space-4); }
    label { display: block; font-size: var(--font-size-sm); font-weight: 600; margin-bottom: var(--space-1); }
    input, select { width: 100%; padding: var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-control); }
    .hint { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .error { color: var(--color-danger); font-size: var(--font-size-sm); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class PrecioQuesoFormDialog {
  protected readonly dialogRef = inject(DialogRef<PrecioQuesoResponse | undefined>);
  protected readonly data = inject<PrecioQuesoFormDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly preciosQuesoApi = inject(PreciosQuesoApi);
  private readonly tiposPrecioApi = inject(TiposPrecioApi);

  /** Solo los tipos activos: un tipo desactivado no admite precios nuevos (el servidor también lo rechaza). */
  protected readonly tiposActivos = signal<TipoPrecioResponse[]>([]);

  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  constructor() {
    this.tiposPrecioApi.listar(true).subscribe({ next: (t) => this.tiposActivos.set(t), error: () => this.tiposActivos.set([]) });
  }

  protected readonly form = this.fb.group({
    modalidad: this.fb.nonNullable.control<'' | 'MAYORISTA' | 'PROVEEDOR' | 'PUBLICO'>('', Validators.required),
    precio: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    vigenteDesde: this.fb.nonNullable.control('', Validators.required)
  });

  protected invalido(campo: 'modalidad' | 'precio' | 'vigenteDesde'): boolean {
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
    const { modalidad, precio, vigenteDesde } = this.form.getRawValue();
    this.preciosQuesoApi.crear({
      presentacionId: this.data.presentacion.id,
      modalidad: modalidad as 'MAYORISTA' | 'PROVEEDOR' | 'PUBLICO',
      precio: precio!,
      vigenteDesde
    }).subscribe({
      next: (respuesta) => this.dialogRef.close(respuesta),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
