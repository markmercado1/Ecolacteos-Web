import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { fechaHoyLima } from '../../../../shared/util/fecha';
import {
  AFECTACIONES,
  AfectacionIgv,
  AfectacionIgvResponse,
  etiquetaAfectacion,
  FilaAfectacionIgvResponse
} from '../../data-access/igv.models';
import { IgvApi } from '../../data-access/igv.api';

export interface AfectacionIgvDialogData {
  fila: FilaAfectacionIgvResponse;
}

/**
 * Fase G: historial de afectación al IGV de una presentación y registro de un cambio desde una fecha (append-only, con motivo).
 * El panel no clasifica nada por su cuenta: la afectación la decide el contador y la registra una persona.
 */
@Component({
  selector: 'app-afectacion-igv-dialog',
  imports: [ReactiveFormsModule, DatePipe, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <div>
        <h2 id="afectacion-titulo">Afectación al IGV</h2>
        <p class="sub">{{ data.fila.productoNombre }} · {{ data.fila.presentacionNombre }}</p>
      </div>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="afectacion-titulo">
      <h3>Historial</h3>
      @if (cargando()) {
        <ui-loading-state mensaje="Cargando historial…" />
      } @else if (error()) {
        <ui-error-state [error]="error()" (reintentar)="cargar()" />
      } @else if (historial().length === 0) {
        <ui-empty-state mensaje="Nunca se clasificó: sus ventas quedan «sin determinar»." />
      } @else {
        <ul class="historial">
          @for (h of historial(); track h.id) {
            <li data-testid="historial-afectacion">
              <strong>{{ etiqueta(h.afectacion) }}</strong> desde {{ h.vigenteDesde | date: 'dd/MM/yyyy' }}
              <span class="meta">— {{ h.motivo }}{{ h.usuarioNombre ? ' · ' + h.usuarioNombre : '' }}</span>
            </li>
          }
        </ul>
      }

      <form [formGroup]="form" (ngSubmit)="enviar()">
        <h3>Registrar un cambio</h3>
        <div class="field">
          <label for="afectacion">Afectación</label>
          <select id="afectacion" formControlName="afectacion">
            @for (a of afectaciones; track a) { <option [value]="a">{{ etiqueta(a) }}</option> }
          </select>
        </div>
        <div class="field" [class.has-error]="invalido('vigenteDesde')">
          <label for="vigenteDesdeAfectacion">Vigente desde</label>
          <input id="vigenteDesdeAfectacion" type="date" formControlName="vigenteDesde" required>
          <span class="hint">Las ventas ya registradas conservan la afectación que tenían.</span>
        </div>
        <div class="field" [class.has-error]="invalido('motivo')">
          <label for="motivoAfectacion">Motivo</label>
          <textarea id="motivoAfectacion" rows="2" maxlength="500" formControlName="motivo" required
                    placeholder="Por ejemplo: confirmado por el contador"></textarea>
          @if (invalido('motivo')) { <span class="error">El motivo es obligatorio.</span> }
        </div>
        @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
        <div class="dialog-foot">
          <button type="button" class="btn" (click)="dialogRef.close(registrado())">Cerrar</button>
          <button type="submit" class="btn primary" [disabled]="enviando()">{{ enviando() ? 'Registrando…' : 'Registrar' }}</button>
        </div>
      </form>
    </div>
  `,
  styles: `
    :host { display: block; width: min(30rem, 100%); background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto; }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .sub { margin: 0.2rem 0 0; color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    h3 { font-size: var(--font-size-sm); margin: 0 0 var(--space-2); }
    .historial { list-style: none; padding: 0; margin: 0 0 var(--space-4); font-size: var(--font-size-sm); }
    .historial li { padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border); }
    .meta { color: var(--color-text-muted); }
    textarea { width: 100%; }
    .hint { display: block; font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.25rem; }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class AfectacionIgvDialog {
  protected readonly dialogRef = inject(DialogRef<boolean | undefined>);
  protected readonly data = inject<AfectacionIgvDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(IgvApi);

  protected readonly afectaciones = AFECTACIONES;
  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly historial = signal<AfectacionIgvResponse[]>([]);
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  /** true si se registró algún cambio (la página vuelve a leer la tabla y el estado al cerrar). */
  protected readonly registrado = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    // empieza en la afectación vigente: el panel no propone ninguna clasificación
    afectacion: this.fb.nonNullable.control<AfectacionIgv>(this.data.fila.afectacionVigente),
    vigenteDesde: this.fb.nonNullable.control(fechaHoyLima(), Validators.required),
    motivo: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/\S/)])
  });

  constructor() {
    this.cargar();
  }

  protected etiqueta(a: string): string {
    return etiquetaAfectacion(a);
  }

  protected invalido(campo: 'vigenteDesde' | 'motivo'): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.historialAfectacion(this.data.fila.presentacionId).subscribe({
      next: (h) => {
        this.historial.set(h);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mapHttpError(e));
        this.cargando.set(false);
      }
    });
  }

  enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.errorServidor.set(null);
    const { afectacion, vigenteDesde, motivo } = this.form.getRawValue();
    this.api.registrarAfectacion(this.data.fila.presentacionId, { afectacion, vigenteDesde, motivo: motivo.trim() }).subscribe({
      next: () => {
        this.enviando.set(false);
        this.registrado.set(true);
        this.form.controls.motivo.reset('');
        this.cargar();
      },
      error: (e) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(e).mensaje);
      }
    });
  }
}
