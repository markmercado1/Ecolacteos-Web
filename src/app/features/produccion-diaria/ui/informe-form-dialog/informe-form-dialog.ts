import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AuthService } from '../../../../core/auth/auth.service';
import { mapHttpError } from '../../../../core/http/app-error';
import { fechaHoyLima } from '../../../../shared/util/fecha';
import { InsumoResponse } from '../../../catalogos/data-access/insumo.models';
import { InsumosApi } from '../../../catalogos/data-access/insumos.api';
import { InformeProduccionDiario } from '../../data-access/informe-produccion.models';
import { InformesProduccionApi } from '../../data-access/informes-produccion.api';

export interface InformeFormDialogData {
  /** Presente = modo "editar" ese informe puntual (PUT). Ausente = modo "crear" el informe de hoy (POST). */
  informe?: InformeProduccionDiario;
}

interface FilaInsumo {
  insumoId: string;
  cantidad: number | null;
}

/**
 * Crear/editar el informe diario de producción. Un diálogo autocontenido y efímero (igual patrón que
 * RegistrarLoteDialog/ProductoFormDialog): se abre explícitamente ("Registrar informe de hoy" o "Editar"
 * en una fila del historial), y se cierra al guardar o cancelar -- nunca queda "enganchado" en modo edición
 * esperando otro click, que era el bug de UX reportado (el formulario de la página se auto-cargaba en modo
 * edición con los datos de hoy apenas existía un informe, y "Guardar cambios" reenviaba PUT indefinidamente).
 */
@Component({
  selector: 'app-informe-form-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="informe-form-titulo">{{ esEdicion ? 'Editar informe del ' + data.informe!.fecha : 'Registrar informe de hoy' }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="guardar()" class="dialog-body" aria-labelledby="informe-form-titulo">
      <div class="grid grid-3">
        <div class="field" [class.has-error]="invalido('quesosDiarios')">
          <label for="if-quesos-diarios">Quesos diarios</label>
          <input id="if-quesos-diarios" type="number" min="0" step="1" formControlName="quesosDiarios" required>
          @if (invalido('quesosDiarios')) { <span class="error">Ingresa una cantidad válida (0 o mayor).</span> }
        </div>
        <div class="field">
          <label for="if-quesos-reparados">Quesos reparados</label>
          <input id="if-quesos-reparados" type="number" min="0" step="1" formControlName="quesosReparados">
        </div>
        <div class="field">
          <label for="if-quesos-recorte">Quesos de recorte</label>
          <input id="if-quesos-recorte" type="number" min="0" step="1" formControlName="quesosDeRecorte">
        </div>
      </div>
      <div class="field">
        <label for="if-recorte-kilos">Recorte en kilos</label>
        <input id="if-recorte-kilos" type="number" min="0" step="0.01" formControlName="recorteEnKilos" placeholder="Opcional">
      </div>

      <div class="section-head">
        <h3>Insumos usados</h3>
      </div>
      @if (filasInsumos().length === 0) {
        <p class="hint">Sin insumos registrados todavía.</p>
      } @else {
        <table class="tabla-insumos">
          <thead>
            <tr><th>Insumo</th><th>Cantidad</th><th>Unidad</th><th></th></tr>
          </thead>
          <tbody>
            @for (f of filasInsumos(); track f.insumoId) {
              <tr>
                <td>{{ datosInsumo(f.insumoId)?.nombre ?? f.insumoId }}</td>
                <td>
                  <input
                    type="number" min="0" step="0.01"
                    [value]="f.cantidad"
                    [attr.aria-label]="'Cantidad de ' + (datosInsumo(f.insumoId)?.nombre ?? '')"
                    (change)="actualizarCantidadInsumo(f.insumoId, $any($event.target).value)"
                  >
                </td>
                <td>{{ datosInsumo(f.insumoId)?.unidadMedida }}</td>
                <td><button type="button" class="row-link" (click)="quitarInsumo(f.insumoId)">Quitar</button></td>
              </tr>
            }
          </tbody>
        </table>
      }
      <div class="agregar-insumo">
        <select [value]="insumoParaAgregar()" (change)="insumoParaAgregar.set($any($event.target).value)" aria-label="Elegir insumo a agregar">
          <option value="">Elegir insumo…</option>
          @for (i of insumosRestantes(); track i.id) {
            <option [value]="i.id">{{ i.nombre }} ({{ i.unidadMedida }})</option>
          }
        </select>
        <button type="button" class="btn" [disabled]="!insumoParaAgregar()" (click)="agregarInsumo()">Agregar insumo</button>
      </div>

      @if (errorGuardar()) { <p class="server-error" role="alert">{{ errorGuardar() }}</p> }

      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="guardando()">
          {{ guardando() ? 'Guardando…' : (esEdicion ? 'Guardar cambios' : 'Registrar informe') }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block; width: min(38rem, calc(100vw - 2rem)); max-height: 85vh; overflow: auto;
      background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay);
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    .hint { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .error { font-size: 0.6875rem; color: var(--color-danger); font-weight: 600; }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: var(--space-4) 0 0; }
    .section-head { margin: var(--space-5) 0 var(--space-2); }
    .section-head h3 { font-size: var(--font-size-sm); font-weight: 800; margin: 0; }
    .tabla-insumos { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); margin-bottom: var(--space-3); }
    .tabla-insumos th, .tabla-insumos td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--color-border); }
    .tabla-insumos input[type='number'] { width: 6rem; border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-2); }
    .agregar-insumo { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2); }
    .agregar-insumo select { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); min-height: 2.375rem; color: var(--color-text); min-width: 12rem; }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class InformeFormDialog {
  protected readonly dialogRef = inject(DialogRef<InformeProduccionDiario | undefined>);
  protected readonly data = inject<InformeFormDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(InformesProduccionApi);
  private readonly insumosApi = inject(InsumosApi);
  private readonly auth = inject(AuthService);

  protected readonly esEdicion = !!this.data.informe;
  private readonly uuidCliente = crypto.randomUUID();

  protected readonly insumosDisponibles = toSignal(
    this.auth.usuario()?.rolNombre === 'ADMIN' ? this.insumosApi.listar() : this.insumosApi.listarOperativo(),
    { initialValue: [] as InsumoResponse[] }
  );

  protected readonly form = this.fb.group({
    quesosDiarios: this.fb.control<number | null>(this.data.informe?.quesosDiarios ?? null, [Validators.required, Validators.min(0)]),
    quesosReparados: this.fb.control<number | null>(this.data.informe?.quesosReparados ?? 0, [Validators.min(0)]),
    quesosDeRecorte: this.fb.control<number | null>(this.data.informe?.quesosDeRecorte ?? 0, [Validators.min(0)]),
    recorteEnKilos: this.fb.control<number | null>(this.data.informe?.recorteEnKilos ?? null, [Validators.min(0)])
  });
  protected readonly filasInsumos = signal<FilaInsumo[]>(
    (this.data.informe?.insumos ?? []).map((i) => ({ insumoId: i.insumoId, cantidad: i.cantidad }))
  );
  protected readonly insumoParaAgregar = signal('');

  protected readonly insumosRestantes = computed(() => {
    const usados = new Set(this.filasInsumos().map((f) => f.insumoId));
    return this.insumosDisponibles().filter((i) => !usados.has(i.id));
  });

  protected readonly guardando = signal(false);
  protected readonly errorGuardar = signal<string | null>(null);

  protected invalido(campo: 'quesosDiarios'): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

  protected agregarInsumo(): void {
    const id = this.insumoParaAgregar();
    if (!id) return;
    this.filasInsumos.update((filas) => [...filas, { insumoId: id, cantidad: null }]);
    this.insumoParaAgregar.set('');
  }

  protected quitarInsumo(insumoId: string): void {
    this.filasInsumos.update((filas) => filas.filter((f) => f.insumoId !== insumoId));
  }

  protected actualizarCantidadInsumo(insumoId: string, valor: string): void {
    const cantidad = valor === '' ? null : Number(valor);
    this.filasInsumos.update((filas) => filas.map((f) => (f.insumoId === insumoId ? { ...f, cantidad } : f)));
  }

  protected datosInsumo(insumoId: string): InsumoResponse | undefined {
    return this.insumosDisponibles().find((i) => i.id === insumoId);
  }

  protected guardar(): void {
    if (this.guardando()) return; // el botón ya se deshabilita, esto es solo defensa adicional
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const filas = this.filasInsumos();
    if (filas.some((f) => f.cantidad === null || f.cantidad <= 0)) {
      this.errorGuardar.set('Completa la cantidad de todos los insumos agregados (mayor que 0), o quítalos.');
      return;
    }
    const { quesosDiarios, quesosReparados, quesosDeRecorte, recorteEnKilos } = this.form.getRawValue();
    if (quesosDiarios === null) return;
    const insumos = filas.map((f) => ({ insumoId: f.insumoId, cantidad: f.cantidad! }));

    this.guardando.set(true);
    this.errorGuardar.set(null);

    const peticion = this.esEdicion
      ? this.api.editar(this.data.informe!.id, {
          quesosDiarios,
          quesosReparados: quesosReparados ?? 0,
          quesosDeRecorte: quesosDeRecorte ?? 0,
          recorteEnKilos,
          insumos
        })
      : this.api.crear({
          uuidCliente: this.uuidCliente,
          fecha: fechaHoyLima(),
          quesosDiarios,
          quesosReparados: quesosReparados ?? 0,
          quesosDeRecorte: quesosDeRecorte ?? 0,
          recorteEnKilos,
          insumos
        });

    peticion.subscribe({
      next: (informe) => this.dialogRef.close(informe),
      error: (error) => {
        this.guardando.set(false);
        this.errorGuardar.set(mapHttpError(error).mensaje);
      }
    });
  }
}
