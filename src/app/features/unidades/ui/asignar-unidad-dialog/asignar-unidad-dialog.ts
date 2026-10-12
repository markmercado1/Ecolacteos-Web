import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { UnidadRequest, UnidadResponse } from '../../data-access/unidad.models';
import { UnidadesApi } from '../../data-access/unidades.api';

export interface AsignarUnidadDialogData {
  /** Flota completa existente, ya cargada por quien abre el diálogo (sin volver a pedirla). */
  unidades: UnidadResponse[];
  responsableId: string;
  responsableNombre: string;
}

/**
 * true: el usuario confirmó una unidad YA existente (se reasigna su responsable).
 * false: el usuario indicó que es una unidad nueva -- quien abrió este diálogo debe encadenar
 * UnidadFormDialog (creación) con responsableIdInicial. Este diálogo nunca crea nada: solo decide
 * "existente" vs. "nueva" y, si es existente, hace la reasignación.
 */
export type AsignarUnidadResultado = { tipo: 'reasignada'; unidad: UnidadResponse } | { tipo: 'crear-nueva' };

/**
 * Paso previo a UnidadFormDialog cuando se asigna una unidad desde Acopiadores: por defecto se asume
 * que se le va a dar al acopiador una unidad YA existente en la flota (elegida de un combo), no una
 * nueva -- el formulario de alta completo (placa/capacidad/zona) solo aparece si el usuario contesta
 * explícitamente "Sí" a "¿Es una unidad nueva?".
 */
@Component({
  selector: 'app-asignar-unidad-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="asignar-unidad-titulo">Asignar unidad a {{ data.responsableNombre }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="continuar()" class="dialog-body" aria-labelledby="asignar-unidad-titulo">
      <fieldset class="field">
        <legend>¿Es una unidad nueva?</legend>
        <label class="opcion">
          <input type="radio" formControlName="esNueva" [value]="false" [disabled]="data.unidades.length === 0">
          No, ya existe en la flota
        </label>
        <label class="opcion">
          <input type="radio" formControlName="esNueva" [value]="true">
          Sí, es una unidad nueva
        </label>
      </fieldset>

      @if (!esNueva()) {
        @if (data.unidades.length === 0) {
          <p class="hint">No hay unidades registradas todavía en la flota.</p>
        } @else {
          <div class="field" [class.has-error]="invalidoUnidad()">
            <label for="au-unidad">Unidad existente</label>
            <select id="au-unidad" formControlName="unidadId" required>
              <option value="" disabled>Selecciona una placa</option>
              @for (u of data.unidades; track u.id) {
                <option [value]="u.id">{{ u.placa }} — actualmente con {{ u.responsableNombre }}</option>
              }
            </select>
            @if (invalidoUnidad()) { <span class="error">Selecciona una unidad de la lista.</span> }
            @if (unidadSeleccionada(); as u) {
              <p class="hint">Al confirmar, "{{ u.placa }}" dejará de ser responsabilidad de {{ u.responsableNombre }}.</p>
            }
          </div>
        }
      } @else {
        <p class="hint">A continuación se abrirá el formulario para registrar los datos de la nueva unidad.</p>
      }

      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }

      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="!puedeContinuar() || enviando()">
          {{ enviando() ? 'Asignando…' : (esNueva() ? 'Continuar' : 'Asignar unidad') }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block; width: min(26rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 85vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    fieldset.field { border: none; padding: 0; margin: 0 0 var(--space-4); }
    fieldset legend { font-weight: 600; font-size: var(--font-size-sm); margin-bottom: var(--space-2); padding: 0; }
    .opcion { display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-sm); margin-bottom: var(--space-1); font-weight: 400; }
    .hint { color: var(--color-text-muted); font-size: 0.75rem; }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class AsignarUnidadDialog {
  protected readonly dialogRef = inject(DialogRef<AsignarUnidadResultado | undefined>);
  protected readonly data = inject<AsignarUnidadDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly unidadesApi = inject(UnidadesApi);

  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);

  protected readonly form = this.fb.group({
    // Por defecto, "existente" -- salvo que la flota esté vacía, en cuyo caso no hay nada que elegir.
    esNueva: this.fb.nonNullable.control(this.data.unidades.length === 0),
    unidadId: this.fb.nonNullable.control('')
  });

  protected readonly esNueva = () => this.form.controls.esNueva.value;

  /**
   * `computed()` solo se vuelve a evaluar cuando cambia una SEÑAL que leyó -- `FormControl.value` no es
   * una señal, así que un `computed()` que lo lea directamente se queda pegado con el valor de su
   * primera evaluación para siempre. Por eso `unidadId` se expone como señal real vía `toSignal`
   * (mismo criterio que venta-form-dialog.ts) antes de derivar `unidadSeleccionada` de ella.
   */
  private readonly unidadIdSignal = toSignal(this.form.controls.unidadId.valueChanges, {
    initialValue: this.form.controls.unidadId.value
  });

  protected readonly unidadSeleccionada = computed(() =>
    this.data.unidades.find((u) => u.id === this.unidadIdSignal())
  );

  protected invalidoUnidad(): boolean {
    const control = this.form.controls.unidadId;
    return control.invalid && control.touched;
  }

  protected puedeContinuar(): boolean {
    return this.esNueva() || !!this.form.controls.unidadId.value;
  }

  continuar(): void {
    if (this.enviando()) return;
    if (!this.puedeContinuar()) {
      this.form.controls.unidadId.markAsTouched();
      return;
    }

    if (this.esNueva()) {
      this.dialogRef.close({ tipo: 'crear-nueva' });
      return;
    }

    const unidad = this.unidadSeleccionada();
    if (!unidad) return;
    this.enviando.set(true);
    this.errorServidor.set(null);
    const datos: UnidadRequest = {
      placa: unidad.placa,
      capacidadTon: unidad.capacidadTon,
      zonaId: unidad.zonaId,
      responsableId: this.data.responsableId
    };
    this.unidadesApi.actualizar(unidad.id, datos).subscribe({
      next: (actualizada) => this.dialogRef.close({ tipo: 'reasignada', unidad: actualizada }),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
