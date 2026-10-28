import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { fechaHoyLima } from '../../../../shared/util/fecha';
import { AfectacionIgv, AfectacionLoteResponse, etiquetaAfectacion } from '../../data-access/igv.models';
import { IgvApi } from '../../data-access/igv.api';

export interface ClasificarLoteDialogData {
  /** Presentaciones activas sin afectación definida hoy (lo informa el servidor). */
  sinDefinir: number;
}

/** Afectaciones que se pueden aplicar en lote: «sin definir» no es una clasificación. */
const EN_LOTE: AfectacionIgv[] = ['GRAVADO', 'EXONERADO', 'INAFECTO'];

/**
 * Clasifica de una vez las presentaciones activas (solo ADMIN). Por defecto solo completa las que aún no tienen afectación: nunca pisa
 * una decisión ya tomada. Cada presentación queda con su propio registro (misma fecha y motivo) y se puede cambiar después una a una.
 * El servidor decide qué se aplica y qué se omite.
 */
@Component({
  selector: 'app-clasificar-lote-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="lote-titulo">Clasificar presentaciones</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="lote-titulo">
      <p class="hint-block" data-testid="resumen-lote">
        Hay <strong>{{ data.sinDefinir }}</strong> {{ data.sinDefinir === 1 ? 'presentación activa' : 'presentaciones activas' }} sin afectación al IGV. Se les
        asignará la misma, con la misma fecha y motivo, y después puedes cambiar una a una.
      </p>
      <div class="field">
        <label for="lote-afectacion">Afectación</label>
        <select id="lote-afectacion" formControlName="afectacion">
          @for (a of afectaciones; track a) { <option [value]="a">{{ etiqueta(a) }}</option> }
        </select>
      </div>
      <div class="field" [class.has-error]="invalido('vigenteDesde')">
        <label for="lote-desde">Vigente desde</label>
        <input id="lote-desde" type="date" formControlName="vigenteDesde" required>
        <span class="hint">Las ventas ya registradas conservan la afectación que tenían.</span>
      </div>
      <div class="field" [class.has-error]="invalido('motivo')">
        <label for="lote-motivo">Motivo</label>
        <textarea id="lote-motivo" rows="2" maxlength="500" formControlName="motivo" required></textarea>
        @if (invalido('motivo')) { <span class="error">El motivo es obligatorio.</span> }
      </div>
      <label class="check">
        <input type="checkbox" formControlName="soloSinDefinir">
        <span>Solo las que aún no tienen afectación <small>(si lo desmarcas, también cambia las ya clasificadas)</small></span>
      </label>
      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando()">{{ enviando() ? 'Aplicando…' : 'Clasificar' }}</button>
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
    textarea { width: 100%; }
    .hint { display: block; font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.25rem; }
    .check { display: flex; gap: var(--space-2); align-items: flex-start; font-size: var(--font-size-sm); margin-top: var(--space-2); }
    .check small { display: block; color: var(--color-text-muted); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: var(--space-4) 0 0; }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class ClasificarLoteDialog {
  protected readonly dialogRef = inject(DialogRef<AfectacionLoteResponse | undefined>);
  protected readonly data = inject<ClasificarLoteDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(IgvApi);

  protected readonly afectaciones = EN_LOTE;
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    afectacion: this.fb.nonNullable.control<AfectacionIgv>('GRAVADO'),
    vigenteDesde: this.fb.nonNullable.control(fechaHoyLima(), Validators.required),
    motivo: this.fb.nonNullable.control('Todos los productos están gravados', [Validators.required, Validators.pattern(/\S/)]),
    soloSinDefinir: this.fb.nonNullable.control(true)
  });

  protected etiqueta(a: string): string {
    return etiquetaAfectacion(a);
  }

  protected invalido(campo: 'vigenteDesde' | 'motivo'): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

  enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    const { afectacion, vigenteDesde, motivo, soloSinDefinir } = this.form.getRawValue();
    this.enviando.set(true);
    this.errorServidor.set(null);
    this.api.clasificarEnLote({ afectacion, vigenteDesde, motivo: motivo.trim(), soloSinDefinir }).subscribe({
      next: (r) => this.dialogRef.close(r),
      error: (e) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(e).mensaje);
      }
    });
  }
}
