import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { ZonaResponse } from '../../../catalogos/data-access/zona.models';
import { ProveedorAdminResponse } from '../../data-access/proveedor.models';
import { ProveedoresApi } from '../../data-access/proveedores.api';

export interface CambiarZonaDialogData {
  proveedor: ProveedorAdminResponse;
  zonas: ZonaResponse[];
}

@Component({
  selector: 'app-cambiar-zona-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="cambiar-zona-titulo">Cambiar zona</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="cambiar-zona-titulo">
      <p class="contexto">
        <strong>{{ data.proveedor.nombre }}</strong> está actualmente en
        <strong>{{ data.proveedor.zonaActualNombre ?? 'sin zona' }}</strong>.
      </p>
      <div class="field" [class.has-error]="form.get('zonaId')?.invalid && form.get('zonaId')?.touched">
        <label for="zonaId">Nueva zona</label>
        <select id="zonaId" formControlName="zonaId" required>
          <option value="" disabled>Selecciona una zona</option>
          @for (zona of data.zonas; track zona.id) {
            <option [value]="zona.id" [disabled]="zona.id === data.proveedor.zonaActualId">
              {{ zona.nombre }}{{ zona.id === data.proveedor.zonaActualId ? ' (zona actual)' : '' }}
            </option>
          }
        </select>
      </div>
      <div class="field" [class.has-error]="form.controls.motivo.invalid">
        <label for="motivoZona">Motivo (opcional)</label>
        <textarea id="motivoZona" rows="2" maxlength="200" formControlName="motivo"
                  placeholder="Ej. Cambió su ruta de recojo"></textarea>
        <small class="ayuda">Queda en el historial de zonas del proveedor, con la hora y quién lo hizo. Máximo 200 caracteres.</small>
      </div>
      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="form.invalid || enviando()">
          {{ enviando() ? 'Guardando…' : 'Cambiar zona' }}
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
    .ayuda { display: block; color: var(--color-text-muted); font-size: 0.75rem; margin-top: var(--space-1); }
    .contexto { font-size: var(--font-size-sm); color: var(--color-text-muted); margin: 0 0 var(--space-4); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class CambiarZonaDialog {
  protected readonly dialogRef = inject(DialogRef<ProveedorAdminResponse | undefined>);
  protected readonly data = inject<CambiarZonaDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly proveedoresApi = inject(ProveedoresApi);

  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly form = this.fb.group({
    zonaId: this.fb.nonNullable.control('', Validators.required),
    motivo: this.fb.nonNullable.control('', Validators.maxLength(200))
  });

  enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.errorServidor.set(null);
    const { zonaId, motivo } = this.form.getRawValue();
    this.proveedoresApi.reasignarZona(this.data.proveedor.id, zonaId, motivo.trim() || undefined).subscribe({
      next: (proveedor) => this.dialogRef.close(proveedor),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
