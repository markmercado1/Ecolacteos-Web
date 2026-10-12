import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { ZonaResponse } from '../../../catalogos/data-access/zona.models';
import { ProveedorAdminResponse } from '../../data-access/proveedor.models';
import { ProveedoresApi } from '../../data-access/proveedores.api';

export interface ProveedorFormDialogData {
  zonas: ZonaResponse[];
  proveedor?: ProveedorAdminResponse;
}

/**
 * Crear y editar comparten formulario, pero no contrato: crear admite
 * zonaActualId (ProveedorRequest); editar no cambia zona (ProveedorUpdateRequest;
 * docs/ALCANCE.md dice explícitamente que el PUT de datos no mueve al
 * proveedor de zona). El campo de zona solo aparece al crear.
 */
@Component({
  selector: 'app-proveedor-form-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="proveedor-form-titulo">{{ esEdicion ? 'Editar proveedor' : 'Nuevo proveedor' }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="proveedor-form-titulo">
      <div class="field" [class.has-error]="invalido('nombre')">
        <label for="nombre">Nombre completo</label>
        <input id="nombre" type="text" formControlName="nombre" required>
        @if (invalido('nombre')) { <span class="error">El nombre es obligatorio.</span> }
      </div>
      <div class="field" [class.has-error]="invalido('dni')">
        <label for="dni">DNI</label>
        <input id="dni" type="text" formControlName="dni" required>
        @if (invalido('dni')) { <span class="error">El DNI es obligatorio.</span> }
      </div>
      <div class="field">
        <label for="telefono">Teléfono (opcional)</label>
        <input id="telefono" type="tel" formControlName="telefono">
      </div>
      @if (!esEdicion) {
        <div class="field">
          <label for="zonaActualId">Zona actual (opcional)</label>
          <select id="zonaActualId" formControlName="zonaActualId">
            <option value="">Sin zona</option>
            @for (zona of data.zonas; track zona.id) {
              <option [value]="zona.id">{{ zona.nombre }}</option>
            }
          </select>
        </div>
      } @else {
        <p class="hint-block">Para cambiar de zona usa la acción "Cambiar zona" del listado.</p>
      }

      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }

      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="form.invalid || enviando()">
          {{ enviando() ? 'Guardando…' : (esEdicion ? 'Guardar cambios' : 'Crear proveedor') }}
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
    .hint-block { font-size: var(--font-size-sm); color: var(--color-text-muted); background: var(--color-surface-soft); border-radius: var(--radius-control); padding: var(--space-3); margin: 0 0 var(--space-4); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class ProveedorFormDialog {
  protected readonly dialogRef = inject(DialogRef<ProveedorAdminResponse | undefined>);
  protected readonly data = inject<ProveedorFormDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly proveedoresApi = inject(ProveedoresApi);

  protected readonly esEdicion = !!this.data.proveedor;
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);

  protected readonly form = this.fb.group({
    nombre: this.fb.nonNullable.control(this.data.proveedor?.nombre ?? '', Validators.required),
    dni: this.fb.nonNullable.control(this.data.proveedor?.dni ?? '', Validators.required),
    telefono: this.fb.control<string | null>(this.data.proveedor?.telefono ?? null),
    zonaActualId: this.fb.nonNullable.control(this.data.proveedor?.zonaActualId ?? '')
  });

  protected invalido(campo: 'nombre' | 'dni'): boolean {
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
    const { nombre, dni, telefono, zonaActualId } = this.form.getRawValue();

    const peticion = this.esEdicion
      ? this.proveedoresApi.actualizar(this.data.proveedor!.id, { nombre, dni, telefono: telefono || null })
      : this.proveedoresApi.crear({ nombre, dni, telefono: telefono || null, zonaActualId: zonaActualId || null });

    peticion.subscribe({
      next: (proveedor) => this.dialogRef.close(proveedor),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
