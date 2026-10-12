import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { ETIQUETAS_MEDIO } from '../../data-access/reserva.etiquetas';
import { MedioAceptacion, ReservaResponse } from '../../data-access/reserva.models';
import { ReservasApi } from '../../data-access/reservas.api';

export interface AceptacionPrecioDialogData {
  reservaId: string;
  codigo: string;
  /** Importe vigente que se le informó al cliente (solo para mostrarlo; el servidor registra el que corresponde). */
  total: number | null;
}

/**
 * Registra que el CLIENTE aceptó el importe de su reserva (por teléfono, WhatsApp, presencial…). La constancia queda con
 * usuario, fecha, medio e importe. Se cierra con la reserva actualizada que devuelve el servidor, o sin valor si se cancela.
 */
@Component({
  selector: 'app-aceptacion-precio-dialog',
  imports: [ReactiveFormsModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="aceptacion-titulo">Registrar aceptación del cliente</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="aceptacion-titulo">
      <p class="intro">
        Reserva <strong>{{ data.codigo }}</strong>
        @if (data.total !== null) { · importe informado: <strong>S/ {{ data.total | number: '1.2-2' }}</strong> }
      </p>
      <p class="hint">Confirma con el cliente el importe antes de registrar su aceptación. Quedará constancia con tu usuario, la fecha y el medio.</p>
      <div class="field">
        <label for="aceptacion-medio">¿Por qué medio aceptó?</label>
        <select id="aceptacion-medio" formControlName="medio">
          @for (medio of medios; track medio) {
            <option [value]="medio">{{ etiqueta(medio) }}</option>
          }
        </select>
      </div>
      <div class="field">
        <label for="aceptacion-nota">Nota (opcional)</label>
        <input id="aceptacion-nota" type="text" formControlName="nota" maxlength="300">
      </div>
      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="form.invalid || enviando()">
          {{ enviando() ? 'Registrando…' : 'Registrar aceptación' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block; width: min(28rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay);
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6) var(--space-6); }
    .intro { margin: 0 0 var(--space-2); }
    .hint { color: var(--color-text-muted); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class AceptacionPrecioDialog {
  protected readonly dialogRef = inject(DialogRef<ReservaResponse | undefined>);
  protected readonly data = inject<AceptacionPrecioDialogData>(DIALOG_DATA);
  private readonly api = inject(ReservasApi);
  private readonly fb = inject(FormBuilder);

  protected readonly medios: MedioAceptacion[] = ['TELEFONO', 'WHATSAPP', 'PRESENCIAL', 'OTRO'];
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly form = this.fb.group({
    medio: this.fb.nonNullable.control<MedioAceptacion>('TELEFONO', Validators.required),
    nota: this.fb.nonNullable.control('', Validators.maxLength(300))
  });

  protected etiqueta(medio: MedioAceptacion): string {
    return ETIQUETAS_MEDIO[medio];
  }

  protected enviar(): void {
    if (this.form.invalid || this.enviando()) return;
    this.enviando.set(true);
    this.errorServidor.set(null);
    const { medio, nota } = this.form.getRawValue();
    this.api.registrarAceptacion(this.data.reservaId, { medio, nota: nota.trim() || undefined }).subscribe({
      next: (reserva) => this.dialogRef.close(reserva),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
