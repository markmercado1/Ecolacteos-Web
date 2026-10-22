import { Subscription } from 'rxjs';
import { RecepcionApi } from '../../../recepcion/data-access/recepcion.api';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { JornadasApi } from '../../data-access/jornadas.api';
import { RecepcionJornadaRequest } from '../../data-access/jornada.models';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AcopiosApi, JornadaDetalle } from '../../../acopios/acopios.api';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';

/**
 * Detalle de jornada para la bandeja de RECEPCION (Bloque 3 de Fase 4): acopiador, vehículo, horas,
 * proveedores visitados, acopios y litros esperados. Reutiliza GET /api/jornadas/{id} tal como ya lo
 * expone AcopiosApi.jornada() para el recorrido en el detalle de acopio (features/acopios): mismo
 * endpoint y DTO, sin duplicar la llamada. No pide GPS ni foto por acopio (eso exigiría
 * GET /api/registros-acopio/{id}, al que RECEPCION no está autorizado).
 */
@Component({
  selector: 'app-jornada-detalle-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, ErrorStateComponent, LoadingStateComponent],
  template: `
    <header>
      <div>
        <div class="eyebrow">JORNADA</div>
        <h2 id="jornada-titulo">{{ data.recepcionar ? "Recepcionar jornada" : "Detalle de la jornada" }}</h2>
      </div>
      <button class="btn" (click)="cerrar()" [disabled]="enviando()" aria-label="Cerrar detalle">×</button>
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
          <form [formGroup]="form" (ngSubmit)="recibir()">
            <h3>Recepción en planta</h3>
            @if (j.acopios.length === 0) {
              <p class="aviso" role="note">Esta jornada no tiene acopios registrados en el servidor. Comprueba que el acopiador haya sincronizado antes de recibirla.</p>
            }
            <fieldset [disabled]="enviando() || intento !== null">
              <label for="litros-reales">Litros reales recibidos</label>
              <input id="litros-reales" type="number" min="0" step="any" formControlName="litrosReales" required />
              <label for="hora-llegada">Fecha y hora de llegada (hora de Perú)</label>
              <input id="hora-llegada" type="datetime-local" formControlName="horaLlegada" required />
              <fieldset class="turnos">
                <legend>Turno</legend>
                @for (turno of turnos; track turno.valor) {
                  <label class="turno" [class.realizado]="turnosRegistrados().includes(turno.valor)">
                    <input type="radio" formControlName="turno" [value]="turno.valor" />
                    <span>{{ turno.texto }}</span>
                    @if (turnosRegistrados().includes(turno.valor)) { <small>Ya recepcionado</small> }
                  </label>
                }
              </fieldset>
              <p role="status">
                @if (consultandoTurnos()) { Comprobando turnos… }
                @else if (errorTurnos()) { No se pudo comprobar. {{ errorTurnos() }} }
                @else { Marcas para este vehículo y la fecha de llegada elegida. Son informativas; el servidor valida la recepción. }
              </p>
              <button type="button" class="row-link" (click)="consultarTurnos()" [disabled]="consultandoTurnos()">Actualizar turnos</button>
              <label for="observacion-recepcion">Observación (opcional)</label>
              <textarea id="observacion-recepcion" formControlName="observacion" rows="2"></textarea>
            </fieldset>
            <p>Al confirmar se recibirá toda la jornada con sus acopios. El servidor calculará la diferencia entre litros de campo y planta.</p>
            @if (form.invalid && form.touched) {
              <p role="alert">Ingresa litros válidos (cero o más) y la fecha y hora de llegada.</p>
            }
            @if (errorRecepcion()) { <p role="alert" class="aviso">{{ errorRecepcion() }}</p> }
            @if (intento && !enviando()) {
              <p>La confirmación está pendiente. Reintenta con los mismos datos para comprobar el resultado sin duplicar la recepción.</p>
            }
            <button type="submit" class="btn btn-primary" [disabled]="enviando()">
              {{ enviando() ? 'Confirmando…' : intento ? 'Reintentar confirmación' : 'Confirmar recepción' }}
            </button>
          </form>
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
    form { border-block: 1px solid var(--color-border); padding-block: 1rem; }
    fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: 0.5rem; min-width: 0; }
    input, textarea { width: 100%; box-sizing: border-box; padding: 0.65rem; border: 1px solid var(--color-border); border-radius: var(--radius-input, 6px); font: inherit; background: var(--color-surface); color: var(--color-text); }
    .aviso { padding: 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-card); }

    .turnos { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .turnos legend { margin-bottom: 0.5rem; }
    .turno { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-input, 6px); cursor: pointer; }
    .turno input { width: auto; }
    .turno:has(input:checked) { outline: 2px solid var(--color-primary); outline-offset: 2px; }
    .turno.realizado { background: var(--color-warning-bg); color: var(--color-warning); }
    .turno small { font-weight: 700; }
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
  protected readonly data = inject<{ id: string; recepcionar?: boolean }>(DIALOG_DATA);
  private readonly api = inject(AcopiosApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly jornada = signal<JornadaDetalle | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal<AppError | null>(null);

  private readonly recepcionApi = inject(RecepcionApi);
  private consultaTurnos?: Subscription;
  protected readonly turnos = [{ valor: 'MAÑANA', texto: 'Mañana' }, { valor: 'TARDE', texto: 'Tarde' }, { valor: 'UNICO', texto: 'Único' }];
  protected readonly turnosRegistrados = signal<string[]>([]);
  protected readonly consultandoTurnos = signal(false);
  protected readonly errorTurnos = signal<string | null>(null);

  protected consultarTurnos(): void {
    this.consultaTurnos?.unsubscribe();
    this.turnosRegistrados.set([]);
    this.errorTurnos.set(null);
    this.consultandoTurnos.set(false);
    const unidadId = this.jornada()?.unidadId;
    const fecha = this.form.controls.horaLlegada.value.slice(0, 10);
    if (!this.data.recepcionar || !unidadId) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      this.errorTurnos.set('Selecciona una fecha de llegada válida.');
      return;
    }
    this.consultandoTurnos.set(true);
    const consulta = new Subscription();
    this.consultaTurnos = consulta;
    const registrados = new Set<string>();
    const cargarPagina = (page: number) => {
      consulta.add(this.recepcionApi.listar({ unidadId, fecha, page, size: 100 }).subscribe({
        next: pagina => {
          pagina.contenido.forEach(r => registrados.add(r.turno));
          if (page + 1 < pagina.totalPaginas) cargarPagina(page + 1);
          else {
            this.turnosRegistrados.set([...registrados]);
            this.consultandoTurnos.set(false);
          }
        },
        error: e => {
          this.errorTurnos.set(mapHttpError(e).mensaje);
          this.consultandoTurnos.set(false);
        },
      }));
    };
    cargarPagina(0);
  }

  private readonly jornadasApi = inject(JornadasApi);
  protected readonly enviando = signal(false);
  protected readonly errorRecepcion = signal<string | null>(null);
  protected intento: RecepcionJornadaRequest | null = null;
  private readonly uuidCliente = crypto.randomUUID();
  protected readonly form = new FormGroup({
    litrosReales: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    horaLlegada: new FormControl(horaPeru(), { nonNullable: true, validators: [Validators.required] }),
    turno: new FormControl('UNICO', { nonNullable: true, validators: [Validators.pattern(/^(MAÑANA|TARDE|UNICO)$/)] }),
    observacion: new FormControl('', { nonNullable: true }),
  });

  protected cerrar(): void {
    if (this.enviando()) return;
    if (this.data.recepcionar && (this.form.dirty || this.intento) &&
        !window.confirm('¿Cerrar la recepción? Si enviaste datos y no hubo respuesta, consulta el estado de la jornada antes de iniciar otra recepción.')) return;
    this.ref.close();
  }

  protected recibir(): void {
    if (!this.data.recepcionar || this.enviando() || this.jornada()?.estado !== 'REGRESANDO_A_PLANTA') return;
    if (!this.intento) {
      this.form.markAllAsTouched();
      const value = this.form.getRawValue();
      if (this.form.invalid || value.litrosReales === null || !Number.isFinite(value.litrosReales) ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value.horaLlegada)) return;
      this.intento = { uuidCliente: this.uuidCliente, jornadaId: this.data.id,
        litrosReales: value.litrosReales, horaLlegada: value.horaLlegada + ':00',
        observacion: value.observacion.trim() || null, turno: value.turno };
    }
    this.enviando.set(true);
    this.errorRecepcion.set(null);
    this.jornadasApi.recepcionar(this.intento).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (resultado) => {
        this.enviando.set(false);
        const rechazo = resultado.errores?.find(e => e.uuidCliente === this.uuidCliente);
        if (rechazo) {
          this.errorRecepcion.set(rechazo.motivo);
          this.intento = null;
        } else if (resultado.confirmados?.includes(this.uuidCliente)) {
          this.ref.close(true);
        } else {
          this.errorRecepcion.set('El servidor no confirmó esta recepción. No se ha anunciado como recibida.');
        }
      },
      error: (e) => {
        this.enviando.set(false);
        this.errorRecepcion.set(mapHttpError(e).mensaje);
      },
    });
  }

  constructor() {
    this.destroy.onDestroy(() => this.consultaTurnos?.unsubscribe());
    this.form.controls.horaLlegada.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.consultarTurnos());
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
          this.consultarTurnos();
          this.cargando.set(false);
        },
        error: (e) => {
          this.error.set(mapHttpError(e));
          this.cargando.set(false);
        },
      });
  }
}


function horaPeru(): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find(p => p.type === tipo)?.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}T${valor('hour')}:${valor('minute')}`;
}
