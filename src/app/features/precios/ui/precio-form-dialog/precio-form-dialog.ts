import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { PrecioLitroResponse } from '../../data-access/precio.models';
import { PreciosApi } from '../../data-access/precios.api';
import { pendientesDe, resumenPendientes } from '../../../../shared/util/validacion';

const ETIQUETAS: Record<string, string> = {"precio":"Precio por litro","vigenteDesde":"Vigente desde"};

@Component({
  selector: 'app-precio-form-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="precio-form-titulo">Registrar nuevo precio</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="precio-form-titulo">
      <div class="field" [class.has-error]="invalido('precio')">
        <label for="precio">Precio por litro (S/)</label>
        <input id="precio" type="number" min="0.01" step="0.01" formControlName="precio" required>
        @if (invalido('precio')) { <span class="error">Ingresa un precio mayor que 0.</span> }
      </div>
      <div class="field" [class.has-error]="invalido('vigenteDesde')">
        <label for="vigenteDesde">Vigente desde</label>
        <input id="vigenteDesde" type="date" formControlName="vigenteDesde" required>
        @if (invalido('vigenteDesde')) { <span class="error">Indica desde qué fecha rige el precio.</span> }
        <span class="hint">Puede ser una fecha futura; el histórico conserva todas las vigencias.</span>
      </div>
      @if (resumen(); as r) { <p class="server-error" role="alert" data-testid="resumen-errores">{{ r }}</p> }
      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando()">
          {{ enviando() ? 'Registrando…' : 'Registrar precio' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block; width: min(22rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay);
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class PrecioFormDialog {
  protected readonly dialogRef = inject(DialogRef<PrecioLitroResponse | undefined>);
  private readonly fb = inject(FormBuilder);
  private readonly preciosApi = inject(PreciosApi);

  protected readonly enviando = signal(false);
  /** Frase general tras un intento de guardar con datos pendientes; el detalle va junto a cada campo. */
  protected readonly resumen = signal<string | null>(null);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly form = this.fb.group({
    precio: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    vigenteDesde: this.fb.nonNullable.control('', Validators.required)
  });

  protected invalido(campo: 'precio' | 'vigenteDesde'): boolean {
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
    const { precio, vigenteDesde } = this.form.getRawValue();
    this.preciosApi.crear({ precio: precio!, vigenteDesde }).subscribe({
      next: (respuesta) => this.dialogRef.close(respuesta),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
