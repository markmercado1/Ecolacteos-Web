import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Observable } from 'rxjs';
import { mapHttpError } from '../../../core/http/app-error';
import { pendientesDe, resumenPendientes } from '../../util/validacion';

const ETIQUETAS: Record<string, string> = {"valor":"Valor"};

export interface CampoUnicoDialogData {
  titulo: string;
  etiquetaCampo: string;
  valorInicial: string;
  tipoInput?: 'text' | 'number';
  ayuda?: string;
  etiquetaGuardar?: string;
  guardar: (valor: string) => Observable<unknown>;
}

/**
 * Formulario mínimo de un solo campo de texto, reutilizado por Zonas
 * (nombre), Motivos (descripción) y Configuración (valor): mismo contrato
 * `{ campo: string }` en los tres casos, por eso comparten un componente en
 * vez de tener tres diálogos casi idénticos.
 */
@Component({
  selector: 'app-campo-unico-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="campo-unico-titulo">{{ data.titulo }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="campo-unico-titulo">
      <div class="field" [class.has-error]="form.get('valor')?.invalid && form.get('valor')?.touched">
        <label for="campo-valor">{{ data.etiquetaCampo }}</label>
        <input id="campo-valor" [type]="data.tipoInput ?? 'text'" formControlName="valor" required>
        @if (form.get('valor')?.invalid && form.get('valor')?.touched) { <span class="error">Completa «{{ data.etiquetaCampo }}».</span> }
        @if (data.ayuda) { <span class="hint">{{ data.ayuda }}</span> }
      </div>
      @if (resumen(); as r) { <p class="server-error" role="alert" data-testid="resumen-errores">{{ r }}</p> }
      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando()">
          {{ enviando() ? 'Guardando…' : (data.etiquetaGuardar ?? 'Guardar') }}
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
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class CampoUnicoDialog {
  protected readonly dialogRef = inject(DialogRef<unknown>);
  protected readonly data = inject<CampoUnicoDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);

  protected readonly enviando = signal(false);
  /** Frase general tras un intento de guardar con datos pendientes; el detalle va junto a cada campo. */
  protected readonly resumen = signal<string | null>(null);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly form = this.fb.group({
    valor: this.fb.nonNullable.control(this.data.valorInicial, Validators.required)
  });

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
    this.data.guardar(this.form.getRawValue().valor).subscribe({
      next: (resultado) => this.dialogRef.close(resultado),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
