import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { TasaIgvResponse } from '../../data-access/igv.models';
import { IgvApi } from '../../data-access/igv.api';

/** Fase G: registra una tasa de IGV con vigencia (append-only, con motivo). No cambia ventas ya registradas. */
@Component({
  selector: 'app-tasa-igv-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="tasa-igv-titulo">Registrar tasa de IGV</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="tasa-igv-titulo">
      <p class="hint-block">Regístrala solo con la tasa que confirme el contador. Abre una vigencia nueva: no edita las anteriores ni cambia ventas registradas.</p>
      <div class="field" [class.has-error]="invalido('tasa')">
        <label for="tasa">Tasa (%)</label>
        <input id="tasa" type="number" min="0.01" max="99.99" step="0.01" formControlName="tasa" required>
        @if (invalido('tasa')) { <span class="error">Ingresa un porcentaje mayor que 0 y menor que 100.</span> }
      </div>
      <div class="field" [class.has-error]="invalido('vigenteDesde')">
        <label for="vigenteDesde">Vigente desde</label>
        <input id="vigenteDesde" type="date" formControlName="vigenteDesde" required>
      </div>
      <div class="field" [class.has-error]="invalido('motivo')">
        <label for="motivo">Motivo</label>
        <textarea id="motivo" rows="2" maxlength="500" formControlName="motivo" required placeholder="Por ejemplo: confirmada por el contador el 20/10/2026"></textarea>
        @if (invalido('motivo')) { <span class="error">El motivo es obligatorio.</span> }
      </div>
      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando()">{{ enviando() ? 'Registrando…' : 'Registrar tasa' }}</button>
      </div>
    </form>
  `,
  styles: `
    :host { display: block; width: min(24rem, 100%); background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    textarea { width: 100%; }
    .hint-block { font-size: var(--font-size-sm); color: var(--color-text-muted); background: var(--color-surface-soft); border-radius: var(--radius-control); padding: var(--space-3); margin: 0 0 var(--space-4); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class TasaIgvDialog {
  protected readonly dialogRef = inject(DialogRef<TasaIgvResponse | undefined>);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(IgvApi);

  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly form = this.fb.group({
    tasa: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01), Validators.max(99.99)]),
    vigenteDesde: this.fb.nonNullable.control('', Validators.required),
    motivo: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/\S/)])
  });

  protected invalido(campo: 'tasa' | 'vigenteDesde' | 'motivo'): boolean {
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
    const { tasa, vigenteDesde, motivo } = this.form.getRawValue();
    this.api.registrarTasa({ tasa: tasa!, vigenteDesde, motivo: motivo.trim() }).subscribe({
      next: (respuesta) => this.dialogRef.close(respuesta),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
