import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { ETIQUETAS_REGLA, ReglaComprador, TipoPrecioResponse } from '../../data-access/tipo-precio.models';
import { TiposPrecioApi } from '../../data-access/tipos-precio.api';

export interface TipoPrecioDialogData {
  /** null = crear un tipo nuevo; con un tipo = editar su nombre y descripción. */
  tipo: TipoPrecioResponse | null;
}

const REGLAS: ReglaComprador[] = ['CUALQUIERA', 'CLIENTE_HABILITADO', 'PROVEEDOR_PADRON'];

/**
 * Crear o editar un tipo de precio (solo ADMIN). El código es el identificador estable: se define al crear (o se deriva del nombre) y nunca cambia;
 * al editar solo se cambian nombre y descripción, así que ninguna referencia histórica se altera. La regla de comprador se elige al crear.
 */
@Component({
  selector: 'app-tipo-precio-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="tp-titulo">{{ data.tipo ? 'Editar tipo de precio' : 'Nuevo tipo de precio' }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="tp-titulo">
      <div class="field" [class.has-error]="invalido('nombre')">
        <label for="tp-nombre">Nombre</label>
        <input id="tp-nombre" type="text" maxlength="60" formControlName="nombre" required>
        @if (invalido('nombre')) { <span class="error">El nombre es obligatorio.</span> }
      </div>
      @if (!data.tipo) {
        <div class="field">
          <label for="tp-codigo">Código</label>
          <input id="tp-codigo" type="text" maxlength="15" formControlName="codigo" placeholder="Se deriva del nombre">
          <span class="hint">Identificador estable (letras, números o guion bajo). No se puede cambiar después.</span>
        </div>
        <div class="field">
          <label for="tp-regla">¿Quién puede comprar a este precio?</label>
          <select id="tp-regla" formControlName="reglaComprador">
            @for (r of reglas; track r) { <option [value]="r">{{ etiquetaRegla(r) }}</option> }
          </select>
        </div>
      } @else {
        <p class="hint-block" data-testid="codigo-fijo">Código <strong>{{ data.tipo.codigo }}</strong> · {{ etiquetaRegla(data.tipo.reglaComprador) }}. No cambian.</p>
      }
      <div class="field">
        <label for="tp-descripcion">Descripción</label>
        <textarea id="tp-descripcion" rows="2" maxlength="300" formControlName="descripcion"></textarea>
      </div>
      <div class="field" [class.has-error]="invalido('motivo')">
        <label for="tp-motivo">Motivo</label>
        <input id="tp-motivo" type="text" maxlength="300" formControlName="motivo" required>
        @if (invalido('motivo')) { <span class="error">El motivo es obligatorio.</span> }
      </div>
      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando()">{{ enviando() ? 'Guardando…' : (data.tipo ? 'Guardar' : 'Crear tipo') }}</button>
      </div>
    </form>
  `,
  styles: `
    :host { display: block; width: min(28rem, 100%); background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto; }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    .hint-block { margin: 0 0 var(--space-4); font-size: var(--font-size-sm); color: var(--color-text-muted); }
    .hint { display: block; font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.25rem; }
    textarea { width: 100%; }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: var(--space-4) 0 0; }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class TipoPrecioDialog {
  protected readonly dialogRef = inject(DialogRef<TipoPrecioResponse | undefined>);
  protected readonly data = inject<TipoPrecioDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(TiposPrecioApi);

  protected readonly reglas = REGLAS;
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nombre: this.fb.nonNullable.control(this.data.tipo?.nombre ?? '', [Validators.required, Validators.pattern(/\S/)]),
    codigo: this.fb.nonNullable.control(''),
    reglaComprador: this.fb.nonNullable.control<ReglaComprador>('CUALQUIERA'),
    descripcion: this.fb.nonNullable.control(this.data.tipo?.descripcion ?? ''),
    motivo: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/\S/)])
  });

  protected etiquetaRegla(r: ReglaComprador): string {
    return ETIQUETAS_REGLA[r];
  }

  protected invalido(campo: 'nombre' | 'motivo'): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

  enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const descripcion = v.descripcion.trim();
    const peticion = this.data.tipo
      ? this.api.editar(this.data.tipo.codigo, { nombre: v.nombre.trim(), descripcion, motivo: v.motivo.trim() })
      : this.api.crear({ nombre: v.nombre.trim(), codigo: v.codigo.trim() || undefined, descripcion, reglaComprador: v.reglaComprador, motivo: v.motivo.trim() });
    this.enviando.set(true);
    this.errorServidor.set(null);
    peticion.subscribe({
      next: (t) => this.dialogRef.close(t),
      error: (e) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(e).mensaje);
      }
    });
  }
}
