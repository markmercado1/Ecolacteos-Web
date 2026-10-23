import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { AcopiosApi, JornadaDetalle } from '../../../acopios/acopios.api';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { RecepcionJornadaForm } from '../recepcion-jornada-form/recepcion-jornada-form';

export interface JornadaDetalleDialogData {
  id: string;
  /** true = además del detalle, muestra el formulario para recepcionar la jornada (se cierra con `true` si se recibió). */
  recepcionar?: boolean;
}

/**
 * Detalle de jornada para la bandeja de RECEPCION (Bloque 3 de Fase 4): acopiador, vehículo, horas,
 * proveedores visitados, acopios y litros esperados. Reutiliza GET /api/jornadas/{id} tal como ya lo
 * expone AcopiosApi.jornada() para el recorrido en el detalle de acopio (features/acopios): mismo
 * endpoint y DTO, sin duplicar la llamada. No pide GPS ni foto por acopio (eso exigiría
 * GET /api/registros-acopio/{id}, al que RECEPCION no está autorizado).
 *
 * Con `recepcionar` incluye el formulario de recepción (RecepcionJornadaForm) solo para jornadas en
 * REGRESANDO_A_PLANTA; el cierre pide confirmación si hay datos sin guardar o una confirmación pendiente.
 */
@Component({
  selector: 'app-jornada-detalle-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, ErrorStateComponent, LoadingStateComponent, RecepcionJornadaForm],
  template: `
    <header>
      <div>
        <div class="eyebrow">JORNADA</div>
        <h2 id="jornada-titulo">{{ data.recepcionar ? 'Recepcionar jornada' : 'Detalle de la jornada' }}</h2>
      </div>
      <button class="btn" (click)="cerrar()" [disabled]="formulario()?.enviando()" aria-label="Cerrar detalle">×</button>
    </header>
    @if (cargando()) {
      <ui-loading-state />
    } @else if (error()) {
      <ui-error-state [error]="error()" (reintentar)="cargar()" />
    } @else if (jornada(); as j) {
      <dl>
        <div>
          <dt>Acopiador</dt>
          <dd>{{ j.acopiadorNombre }}</dd>
        </div>
        <div>
          <dt>Vehículo</dt>
          <dd>{{ j.unidadPlaca }}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{{ j.estado }}</dd>
        </div>
        <div>
          <dt>Hora de inicio</dt>
          <dd>{{ j.horaInicio | date: 'dd/MM/yyyy HH:mm:ss' }}</dd>
        </div>
        <div>
          <dt>Hora de regreso a planta</dt>
          <dd>{{ j.horaFin ? (j.horaFin | date: 'dd/MM/yyyy HH:mm:ss') : 'No informada' }}</dd>
        </div>
        <div>
          <dt>Litros esperados</dt>
          <dd>{{ j.litrosEsperados | number: '1.0-3' }} L</dd>
        </div>
      </dl>

      @if (data.recepcionar) {
        @if (j.estado === 'REGRESANDO_A_PLANTA') {
          <app-recepcion-jornada-form [jornada]="j" (recibida)="ref.close(true)" />
        } @else {
          <p role="status">Esta jornada está en estado {{ j.estado }} y ya no se puede recibir desde esta bandeja.</p>
        }
      }

      <h3>Proveedores visitados ({{ j.proveedoresVisitados.length }})</h3>
      @if (j.proveedoresVisitados.length === 0) {
        <p>Esta jornada no tiene proveedores visitados registrados.</p>
      } @else {
        <ul class="lista-proveedores">
          @for (nombre of j.proveedoresVisitados; track nombre) {
            <li>{{ nombre }}</li>
          }
        </ul>
      }

      <h3>Acopios de la jornada ({{ j.acopios.length }})</h3>
      @if (j.acopios.length === 0) {
        <p>Esta jornada no tiene acopios registrados.</p>
      } @else {
        <table class="tabla-acopios">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Fecha y hora</th>
              <th class="align-end">Litros</th>
            </tr>
          </thead>
          <tbody>
            @for (a of j.acopios; track a.registroAcopioId) {
              <tr>
                <td>{{ a.proveedorNombre }}</td>
                <td>{{ a.fechaHora | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
                <td class="align-end">{{ a.litros | number: '1.0-3' }} L</td>
              </tr>
            }
          </tbody>
        </table>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      width: min(40rem, calc(100vw - 2rem));
      max-height: 85vh;
      overflow: auto;
      padding: var(--space-6);
      background: var(--color-surface);
      border-radius: var(--radius-dialog);
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 1rem;
    }
    h2 { margin-top: 0; }
    h3 { margin-top: var(--space-6); }
    dl {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    dt { color: var(--color-text-muted); font-size: 0.8rem; }
    dd { margin: 0.3rem 0 0; overflow-wrap: anywhere; }
    .lista-proveedores {
      margin: 0;
      padding-left: var(--space-6);
      font-size: var(--font-size-sm);
    }
    .tabla-acopios {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--font-size-sm);
    }
    .tabla-acopios th, .tabla-acopios td {
      text-align: left;
      padding: 0.4rem 0.6rem;
      border-bottom: 1px solid var(--color-border);
    }
    .tabla-acopios th.align-end, .tabla-acopios td.align-end { text-align: right; }
    @media (max-width: 600px) {
      dl { grid-template-columns: 1fr; }
    }
  `,
})
export class JornadaDetalleDialog {
  protected readonly ref = inject(DialogRef);
  protected readonly data = inject<JornadaDetalleDialogData>(DIALOG_DATA);
  private readonly api = inject(AcopiosApi);
  private readonly dialog = inject(Dialog);
  private readonly destroy = inject(DestroyRef);

  protected readonly jornada = signal<JornadaDetalle | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly formulario = viewChild(RecepcionJornadaForm);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api
      .jornada(this.data.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (j) => {
          this.jornada.set(j);
          this.cargando.set(false);
        },
        error: (e) => {
          this.error.set(mapHttpError(e));
          this.cargando.set(false);
        },
      });
  }

  protected cerrar(): void {
    const formulario = this.formulario();
    if (formulario?.enviando()) return;
    if (!formulario?.haySinGuardar()) {
      this.ref.close();
      return;
    }

    const confirmacion = this.dialog.open<boolean>(ConfirmDialog, {
      ariaLabel: 'Cerrar la recepción',
      data: {
        titulo: 'Cerrar la recepción',
        mensaje:
          'Si ya enviaste la recepción y no hubo respuesta, consulta el estado de la jornada antes de iniciar ' +
          'otra recepción. Los datos escritos se perderán.',
        etiquetaConfirmar: 'Cerrar',
        peligroso: true,
      },
    });
    confirmacion.closed.subscribe((confirmado) => {
      if (confirmado) this.ref.close();
    });
  }
}
