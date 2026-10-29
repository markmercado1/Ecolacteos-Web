import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { BarChartComponent, BarraChart } from '../../../../shared/ui/chart/bar-chart';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { Acopio, AcopiosApi } from '../../../acopios/acopios.api';
import { RecepcionPlanta } from '../../../recepcion/data-access/recepcion.models';
import { RecepcionApi } from '../../../recepcion/data-access/recepcion.api';
import { DisponibilidadProduccion } from '../../../catalogos/data-access/receta.models';
import {
  ETIQUETA_ESTADO_LOTE,
  EstadoLote,
  LoteProduccion,
  RecepcionConsumida,
  estadoDe
} from '../../data-access/lote-produccion.models';
import { VencimientoApi } from '../../../vencimiento/data-access/vencimiento.api';
import { LotesProduccionApi } from '../../data-access/lotes-produccion.api';
import { TablaDisponibilidadComponent } from '../tabla-disponibilidad/tabla-disponibilidad';

function formatoCantidad(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toLocaleString('es-PE', { maximumFractionDigits: 3 });
}

export interface LoteDetalleDialogData {
  id: string;
}

interface FilaRecepcionConsumida {
  recepcionPlantaId: string;
  litrosConsumidos: number;
  /** null si no se pudo/no se intentó resolver (ver comentario de clase sobre permisos por rol). */
  recepcion: RecepcionPlanta | null;
}

/**
 * Solo lectura. Siempre consulta GET /api/lotes-produccion/{id}.
 *
 * Refactor de Producción, fase 4: un lote trae trazabilidad de UNA sola de dos formas, nunca ambas --
 * `registroAcopioIds` (lotes creados antes del refactor, vínculo directo a acopios) o
 * `recepcionesConsumidas` (lotes nuevos, desglose FIFO real contra recepciones de planta). Se resuelven
 * por separado, cada una independiente del resto del detalle (igual que las correcciones en el detalle de
 * acopio): si falla, no oculta litros/rendimiento ya cargados arriba.
 *
 * `recepcionesConsumidas` solo se resuelve a detalle completo (fecha, litros de la recepción) para ADMIN:
 * GET /api/recepcion-planta/{id} está autorizado para RECEPCION/ADMIN, pero NO para PRODUCCION (verificado
 * contra el controlador real del backend) -- un usuario PRODUCCION vería 403 en cada llamada. Para
 * PRODUCCION se muestra igual la tabla con litrosConsumidos (ya viene en la respuesta del lote, sin
 * llamada adicional), solo sin la fecha/litros totales de cada recepción.
 */
@Component({
  selector: 'app-lote-detalle-dialog',
  imports: [DecimalPipe, ReactiveFormsModule, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent, BarChartComponent, TablaDisponibilidadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="lote-detalle-titulo">Detalle del lote</h2>
      <button type="button" class="close" (click)="cerrar()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="lote-detalle-titulo">
      @if (cargando()) {
        <ui-loading-state mensaje="Cargando lote…" />
      } @else if (error()) {
        <ui-error-state [error]="error()" (reintentar)="cargar()" />
      } @else if (lote(); as l) {
        <p class="estado-linea">
          <span class="badge" [class]="'badge estado-' + estado()">{{ etiquetaEstado() }}</span>
          @if (l.recetaNombre) { <span class="hint">Receta: {{ l.recetaNombre }}</span> }
        </p>
        @if (mensajeExito()) { <p class="exito" role="status">{{ mensajeExito() }}</p> }

        <dl>
          <div><dt>Fecha</dt><dd>{{ l.fecha }}</dd></div>
          <div><dt>Producto</dt><dd>{{ l.productoNombre }}</dd></div>
          <div>
            <dt>{{ estado() === 'PLANIFICADA' ? 'Leche planificada' : 'Leche utilizada' }}</dt>
            <dd>{{ l.litrosUsados | number: '1.0-2' }} L</dd>
          </div>
          @if (l.cantidadEsperada !== null && l.cantidadEsperada !== undefined) {
            <div>
              <dt>Producción esperada</dt>
              <dd>{{ l.cantidadEsperada | number: '1.0-3' }} · {{ l.presentacionEsperadaNombre }}</dd>
            </div>
          } @else if (l.unidadesEsperadas !== null) {
            <div><dt>Unidades esperadas</dt><dd>{{ l.unidadesEsperadas }}</dd></div>
          }
          @if (estado() === 'FINALIZADA') {
            @for (salida of l.detalles; track salida.presentacionId) { <div><dt>Obtenido · {{ salida.presentacionNombre }}</dt><dd>{{ salida.cantidadObtenida }} · {{ salida.unidadConteo }}</dd></div> } @empty { <div><dt>Presentaciones obtenidas</dt><dd>Sin salidas aprovechables</dd></div> }
            @if (l.diferencia !== null && l.diferencia !== undefined) {
              <div>
                <dt>Diferencia (obtenido − esperado)</dt>
                <dd [class.negativa]="l.diferencia < 0">{{ l.diferencia > 0 ? '+' : '' }}{{ l.diferencia | number: '1.0-3' }}</dd>
              </div>
            }
          } @else {
            <div><dt>Producción real</dt><dd>Aún no registrada</dd></div>
          }
        </dl>

        @switch (estado()) {
          @case ('PLANIFICADA') {
            <section class="accion" aria-labelledby="validacion-titulo">
              <h3 id="validacion-titulo">Validación de stock para iniciar</h3>
              @if (cargandoDisponibilidad()) {
                <ui-loading-state mensaje="Validando stock…" />
              } @else if (errorDisponibilidad()) {
                <ui-error-state [error]="errorDisponibilidad()" (reintentar)="cargarDisponibilidad()" />
              } @else if (disponibilidad(); as d) {
                <app-tabla-disponibilidad [disponibilidad]="d" />
              }
              @if (errorAccion()) { <p class="server-error" role="alert">{{ errorAccion() }}</p> }
              <div class="acciones-lote">
                <button type="button" class="btn danger" (click)="cancelarProduccion()" [disabled]="accionEnCurso()">Cancelar producción</button>
                <button type="button" class="btn primary" (click)="iniciarProduccion()"
                        [disabled]="accionEnCurso() || !disponibilidad()?.todoDisponible">
                  {{ accionEnCurso() ? 'Procesando…' : 'Iniciar producción' }}
                </button>
              </div>
              <p class="nota">Iniciar descuenta la leche y los insumos del stock. Cancelar no consume nada.</p>
            </section>
          }
          @case ('EN_PRODUCCION') {
            <!-- (submit) nativo, no (ngSubmit): este form no tiene [formGroup] (controles sueltos con
                 [formControl]) y sin esa directiva Angular nunca emite ngSubmit. -->
            <form class="accion" (submit)="$event.preventDefault(); finalizarProduccion()" aria-labelledby="finalizar-titulo">
              <h3 id="finalizar-titulo">Finalizar producción</h3>
              @if (l.cantidadEsperada !== null && l.cantidadEsperada !== undefined) {
                <p class="nota-esperada">Producción esperada: <strong>{{ l.cantidadEsperada | number: '1.0-3' }} · {{ l.presentacionEsperadaNombre }}</strong> (estimación de la receta).</p>
              }
              <div class="field" [class.has-error]="cantidadObtenida.invalid && cantidadObtenida.touched">
                <label for="cantidad-obtenida">Cantidad realmente obtenida{{ l.presentacionEsperadaNombre ? ' (' + l.presentacionEsperadaNombre + ')' : '' }}</label>
                <input id="cantidad-obtenida" type="number" min="0" step="1" [formControl]="cantidadObtenida" required>
                @if (cantidadObtenida.invalid && cantidadObtenida.touched) {
                  <span class="error">Ingresa un número entero de 0 o más (0 = no se obtuvo nada aprovechable).</span>
                }
              </div>
              @if (controlaVencimiento()) {
                <div class="field" [class.has-error]="faltaFecha()">
                  <label for="fecha-vencimiento">Fecha de vencimiento (según la etiqueta)</label>
                  <input id="fecha-vencimiento" type="date" [min]="l.fecha" [formControl]="fechaVencimiento" (input)="faltaFecha.set(false)">
                  @if (faltaFecha()) { <span class="error">Indica la fecha de vencimiento: este producto controla vencimiento.</span> }
                  <span class="nota">Es el último día en que se puede vender. La registra una persona; el sistema nunca la calcula.</span>
                </div>
              } @else if (errorControl()) {
                <p class="server-error" role="alert">No se pudo verificar si este producto controla vencimiento: {{ errorControl()!.mensaje }}</p>
                <button type="button" class="btn small" (click)="cargarControlVencimiento()">Reintentar</button>
              }
              <p class="valor-fijo">Materia prima realmente utilizada: <strong>{{ l.litrosUsados | number: '1.0-2' }} L</strong> de leche (consumida al iniciar).</p>
              <div class="field">
                <label for="motivo-finalizar">Motivo u observación (obligatorio si el rendimiento sale del rango configurado)</label>
                <textarea id="motivo-finalizar" rows="2" maxlength="500" [formControl]="motivo"></textarea>
              </div>
              @if (errorAccion()) { <p class="server-error" role="alert">{{ errorAccion() }}</p> }
              <div class="acciones-lote">
                <button type="submit" class="btn primary" [disabled]="accionEnCurso() || !l.presentacionEsperadaId || controlaVencimiento() === null">
                  {{ accionEnCurso() ? 'Procesando…' : 'Finalizar producción' }}
                </button>
              </div>
            </form>
          }
        }

        <div class="section-head"><h3>{{ estado() === 'PLANIFICADA' ? 'Insumos planificados' : 'Insumos utilizados' }}</h3></div>
        @if (l.insumos?.length) {
          <dl>
            @for (i of l.insumos; track i.insumoId) {
              <div>
                <dt>{{ i.insumoNombre }}</dt>
                <dd>{{ i.cantidad | number: '1.0-2' }} {{ i.unidadMedida }}</dd>
                @for (lu of i.lotes ?? []; track lu.loteId) {
                  <dd class="lote-usado">Lote {{ lu.codigo }} · {{ lu.cantidad | number: '1.0-2' }} {{ i.unidadMedida }}{{ lu.proveedorNombre ? ' · ' + lu.proveedorNombre : '' }}{{ lu.fechaVencimiento ? ' · vence ' + lu.fechaVencimiento : '' }}</dd>
                }
              </div>
            }
          </dl>
        } @else {
          <p class="nota">Sin insumos registrados para este lote.</p>
        }

        @if (l.revisionRendimiento) { <p class="nota">Revisión al registrar: {{ l.revisionRendimiento }}</p> }
        @if (l.motivoRendimiento) { <p class="nota">Motivo registrado: {{ l.motivoRendimiento }}</p> }

        @if (l.recetaId) {
          @if (estado() === 'FINALIZADA') {
            <ui-bar-chart
              titulo="Producción esperada vs. obtenida"
              [subtitulo]="'Receta ' + l.recetaNombre + ' · ' + l.litrosUsados + ' L · en ' + (l.presentacionEsperadaNombre ?? 'unidades')"
              [unidad]="l.presentacionEsperadaNombre ?? ''"
              [datos]="datosEsperadoObtenido()"
            />
          }
        } @else {
        <ui-bar-chart
          titulo="Rendimiento obtenido vs. esperado"
          [subtitulo]="'Lote de ' + l.productoNombre + ' · unidades obtenidas por cada 100 L utilizados'"
          unidad="%"
          [datos]="datosRendimiento()"
        />
        <p class="nota">
          Rendimiento = unidades obtenidas por cada 100 L utilizados (no es un rendimiento en masa).
          @if (l.rendimientoEsperadoPctSnapshot !== null) {
            El esperado es el del producto al momento de producir este lote (no cambia si el catálogo
            cambia después).
          } @else if (l.rendimientoEsperadoPct !== null) {
            El esperado es el actual del producto en el catálogo (este lote es anterior al cálculo por
            snapshot, no se reinterpreta retroactivamente).
          } @else {
            Este producto no tiene rendimiento esperado configurado (no aplica a su familia) -- sin cálculo
            configurado, no se inventa una equivalencia.
          }
          @if (l.rendimientoPct === null) {
            Sin cálculo de rendimiento configurado para las salidas de este lote (también puede ocurrir en
            lotes históricos sin litros registrados).
          }
        </p>
        }

        @if (l.recepcionesConsumidas.length > 0) {
          <div class="section-head">
            <h3>Trazabilidad: recepciones de planta consumidas ({{ l.recepcionesConsumidas.length }})</h3>
          </div>
          <p class="hint">Asignado automáticamente por el sistema (más antiguas primero), no seleccionado a mano.</p>
          @if (cargandoTrazabilidad()) {
            <ui-loading-state mensaje="Cargando recepciones vinculadas…" />
          } @else {
            @if (errorTrazabilidad()) {
              <p class="hint" role="alert">No se pudo cargar el detalle de las recepciones ({{ errorTrazabilidad()?.mensaje }}); se muestra solo lo disponible.</p>
            }
            @if (!esAdmin()) {
              <p class="hint">El detalle de fecha y litros totales de cada recepción solo está disponible para ADMIN.</p>
            }
            <table class="tabla-trazabilidad">
              <thead>
                <tr>
                  <th>Recepción</th>
                  @if (esAdmin()) { <th>Fecha</th><th class="align-end">Litros de la recepción</th> }
                  <th class="align-end">Litros consumidos por este lote</th>
                </tr>
              </thead>
              <tbody>
                @for (f of recepcionesConsumidas(); track f.recepcionPlantaId) {
                  <tr>
                    <td class="id-mono">{{ f.recepcionPlantaId }}</td>
                    @if (esAdmin()) {
                      <td>{{ f.recepcion?.fecha ?? '—' }}</td>
                      <td class="align-end">{{ f.recepcion ? (f.recepcion.litrosPlanta | number: '1.0-3') + ' L' : '—' }}</td>
                    }
                    <td class="align-end">{{ f.litrosConsumidos | number: '1.0-3' }} L</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        } @else {
          <div class="section-head">
            <h3>Trazabilidad: registros de acopio vinculados ({{ l.registroAcopioIds.length }})</h3>
          </div>
          @if (l.registroAcopioIds.length === 0) {
            <ui-empty-state mensaje="Este lote no tiene trazabilidad vinculada." />
          } @else if (cargandoTrazabilidad()) {
            <ui-loading-state mensaje="Cargando registros vinculados…" />
          } @else if (errorTrazabilidad()) {
            <ui-error-state [error]="errorTrazabilidad()" (reintentar)="cargarTrazabilidadAcopios(l.registroAcopioIds)" />
          } @else {
            <table class="tabla-trazabilidad">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Fecha y hora</th>
                  <th class="align-end">Litros</th>
                </tr>
              </thead>
              <tbody>
                @for (r of trazabilidadAcopios(); track r.id) {
                  <tr>
                    <td>{{ r.proveedorNombre }}</td>
                    <td>{{ r.fechaHora }}</td>
                    <td class="align-end">{{ r.litros | number: '1.0-3' }} L</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        }
      }
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="cerrar()">Cerrar</button>
    </div>
  `,
  styles: `
    :host {
      display: block; width: min(34rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 85vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    dl { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3) var(--space-4); margin: 0; }
    dt { color: var(--color-text-muted); font-size: 0.75rem; }
    dd { margin: 0.2rem 0 0; font-weight: 600; overflow-wrap: anywhere; }
    dd.lote-usado { font-weight: 400; font-size: 0.75rem; color: var(--color-text-muted); }
    ui-bar-chart { display: block; margin-top: var(--space-5); }
    .nota { color: var(--color-text-muted); font-size: 0.75rem; margin-top: var(--space-3); }
    .hint { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .section-head { margin: var(--space-5) 0 var(--space-2); }
    .section-head h3 { font-size: var(--font-size-sm); font-weight: 800; margin: 0; }
    .tabla-trazabilidad { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
    .tabla-trazabilidad th, .tabla-trazabilidad td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--color-border); }
    .tabla-trazabilidad th.align-end, .tabla-trazabilidad td.align-end { text-align: right; }
    .id-mono { font-family: monospace; font-size: 0.75rem; }
    .dialog-foot { display: flex; justify-content: flex-end; padding: 0 var(--space-6) var(--space-6); }
    .estado-linea { display: flex; align-items: center; gap: var(--space-3); margin: 0 0 var(--space-3); flex-wrap: wrap; }
    .badge.estado-PLANIFICADA { color: var(--color-info); background: var(--color-info-bg); }
    .badge.estado-EN_PRODUCCION { color: var(--color-warning); background: var(--color-warning-bg); }
    .badge.estado-FINALIZADA { color: var(--color-success); background: var(--color-success-bg); }
    .badge.estado-CANCELADA { color: var(--color-text-muted); background: var(--color-surface-soft); }
    .exito { color: var(--color-success); background: var(--color-success-bg); border-radius: var(--radius-control); padding: var(--space-3); font-weight: 700; font-size: var(--font-size-sm); }
    .negativa { color: var(--color-danger); }
    .accion { border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-4); margin-top: var(--space-4); }
    .accion h3 { font-size: var(--font-size-sm); font-weight: 800; margin: 0 0 var(--space-3); }
    .acciones-lote { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-3); flex-wrap: wrap; }
    .nota-esperada { background: var(--color-info-bg); color: var(--color-info); border-radius: var(--radius-control); padding: var(--space-2) var(--space-3); font-size: 0.75rem; }
    .valor-fijo { font-size: var(--font-size-sm); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: var(--space-3) 0 0; }
    .error { font-size: 0.6875rem; color: var(--color-danger); font-weight: 600; }
    @media (max-width: 480px) { dl { grid-template-columns: 1fr; } }
  `
})
export class LoteDetalleDialog {
  /** Cierra con true si el lote cambió de estado (la lista debe recargarse). */
  protected readonly dialogRef = inject(DialogRef<boolean>);
  protected readonly data = inject<LoteDetalleDialogData>(DIALOG_DATA);
  private readonly lotesApi = inject(LotesProduccionApi);
  private readonly vencimientoApi = inject(VencimientoApi);
  private readonly acopiosApi = inject(AcopiosApi);
  private readonly recepcionApi = inject(RecepcionApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(Dialog);
  private readonly destroy = inject(DestroyRef);

  protected readonly esAdmin = computed(() => this.auth.usuario()?.rolNombre === 'ADMIN');

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly lote = signal<LoteProduccion | null>(null);

  // --- V18: ciclo de vida (planificada -> en producción -> finalizada / cancelada) ---
  protected readonly estado = computed<EstadoLote>(() => {
    const l = this.lote();
    return l ? estadoDe(l) : 'FINALIZADA';
  });
  protected readonly etiquetaEstado = computed(() => ETIQUETA_ESTADO_LOTE[this.estado()]);
  protected readonly disponibilidad = signal<DisponibilidadProduccion | null>(null);
  protected readonly cargandoDisponibilidad = signal(false);
  protected readonly errorDisponibilidad = signal<AppError | null>(null);
  protected readonly accionEnCurso = signal(false);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly mensajeExito = signal<string | null>(null);
  private huboCambios = false;

  protected readonly cantidadObtenida = new FormControl<number | null>(null, [
    Validators.required,
    Validators.min(0),
    Validators.pattern(/^\d+$/),
    Validators.max(2147483647)
  ]);
  protected readonly motivo = new FormControl('', { nonNullable: true, validators: Validators.maxLength(500) });

  // --- Fase 2: control de vencimiento. null = aún no se sabe (no se puede finalizar: el backend rechazaría un
  // producto controlado sin fecha, y una fecha en un producto no controlado). ---
  protected readonly controlaVencimiento = signal<boolean | null>(null);
  protected readonly errorControl = signal<AppError | null>(null);
  protected readonly fechaVencimiento = new FormControl('', { nonNullable: true });
  protected readonly faltaFecha = signal(false);

  protected readonly datosEsperadoObtenido = computed<BarraChart[]>(() => {
    const l = this.lote();
    if (!l) return [];
    const obtenido = l.detalles
      .filter((d) => d.presentacionId === l.presentacionEsperadaId)
      .reduce((t, d) => t + d.cantidadObtenida, 0);
    return [
      { etiqueta: 'Esperado', valor: l.cantidadEsperada ?? null },
      { etiqueta: 'Obtenido', valor: obtenido }
    ];
  });

  protected readonly cargandoTrazabilidad = signal(false);
  protected readonly errorTrazabilidad = signal<AppError | null>(null);
  protected readonly trazabilidadAcopios = signal<Acopio[]>([]);
  protected readonly recepcionesConsumidas = signal<FilaRecepcionConsumida[]>([]);

  protected readonly datosRendimiento = computed<BarraChart[]>(() => {
    const l = this.lote();
    if (!l) return [];
    return [
      { etiqueta: 'Obtenido', valor: l.rendimientoPct },
      { etiqueta: 'Esperado', valor: l.rendimientoEsperadoPctSnapshot ?? l.rendimientoEsperadoPct },
    ];
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.lotesApi
      .obtener(this.data.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (lote) => {
          this.lote.set(lote);
          this.cargando.set(false);
          if (estadoDe(lote) === 'PLANIFICADA') this.cargarDisponibilidad();
          if (estadoDe(lote) === 'EN_PRODUCCION') this.cargarControlVencimiento();
          if (lote.recepcionesConsumidas.length > 0) {
            this.cargarTrazabilidadRecepciones(lote.recepcionesConsumidas);
          } else if (lote.registroAcopioIds.length > 0) {
            this.cargarTrazabilidadAcopios(lote.registroAcopioIds);
          }
        },
        error: (error) => {
          this.error.set(mapHttpError(error));
          this.cargando.set(false);
        }
      });
  }

  /** Fase 2: ¿el producto de este lote controla vencimiento? Solo importa mientras el lote está EN_PRODUCCION. */
  protected cargarControlVencimiento(): void {
    const l = this.lote();
    if (!l) return;
    this.errorControl.set(null);
    this.vencimientoApi
      .productosConControl()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => this.controlaVencimiento.set(r.productoIds.includes(l.productoId)),
        error: (e) => this.errorControl.set(mapHttpError(e))
      });
  }

  protected cargarDisponibilidad(): void {
    this.cargandoDisponibilidad.set(true);
    this.errorDisponibilidad.set(null);
    this.lotesApi
      .disponibilidad(this.data.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (d) => {
          this.disponibilidad.set(d);
          this.cargandoDisponibilidad.set(false);
        },
        error: (e) => {
          this.errorDisponibilidad.set(mapHttpError(e));
          this.cargandoDisponibilidad.set(false);
        }
      });
  }

  protected iniciarProduccion(): void {
    if (this.accionEnCurso() || !this.disponibilidad()?.todoDisponible) return;
    this.ejecutar(this.lotesApi.iniciar(this.data.id), () => 'Producción iniciada: la leche y los insumos se descontaron del stock.');
  }

  protected cancelarProduccion(): void {
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      ariaLabel: 'Confirmar cancelación',
      data: {
        titulo: 'Cancelar producción planificada',
        mensaje: 'La producción quedará CANCELADA y no podrá iniciarse. No se consumió ningún stock.',
        etiquetaConfirmar: 'Cancelar producción',
        peligroso: true
      }
    });
    ref.closed.subscribe((confirmado) => {
      if (confirmado) this.ejecutar(this.lotesApi.cancelar(this.data.id), () => 'Producción cancelada.');
    });
  }

  protected finalizarProduccion(): void {
    if (this.accionEnCurso()) return;
    const l = this.lote();
    if (!l?.presentacionEsperadaId) return;
    if (this.cantidadObtenida.invalid || this.motivo.invalid) {
      this.cantidadObtenida.markAsTouched();
      return;
    }
    const cantidad = Number(this.cantidadObtenida.value);
    const motivo = this.motivo.value.trim();
    const controla = this.controlaVencimiento();
    if (controla === null) {
      this.errorAccion.set('Todavía no se pudo verificar si el producto controla vencimiento. Reintenta en un momento.');
      return;
    }
    const fecha = this.fechaVencimiento.value;
    if (controla && cantidad > 0 && !fecha) {
      this.faltaFecha.set(true);
      return;
    }
    this.ejecutar(
      this.lotesApi.finalizar(this.data.id, {
        // 0 obtenido = lote sin salidas aprovechables (lista vacía), nunca una línea en cero.
        detalles: cantidad > 0 ? [{ presentacionId: l.presentacionEsperadaId, cantidadObtenida: cantidad }] : [],
        motivoRendimiento: motivo || null,
        // Solo un producto con control envía fechas (uno sin control las rechaza); sin salidas no hay nada que fechar.
        ...(controla ? { vencimientos: cantidad > 0 ? [{ presentacionId: l.presentacionEsperadaId, fechaVencimiento: fecha }] : [] } : {})
      }),
      (fin) => {
        const esperado = fin.cantidadEsperada ?? 0;
        return `Producción finalizada correctamente. Esperado: ${formatoCantidad(esperado)} · Obtenido: ${cantidad}.`;
      }
    );
  }

  private ejecutar(accion$: Observable<LoteProduccion>, mensaje: (lote: LoteProduccion) => string): void {
    this.accionEnCurso.set(true);
    this.errorAccion.set(null);
    this.mensajeExito.set(null);
    accion$.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (lote) => {
        this.accionEnCurso.set(false);
        this.huboCambios = true;
        this.lote.set(lote);
        this.mensajeExito.set(mensaje(lote));
        this.disponibilidad.set(null);
        if (estadoDe(lote) === 'PLANIFICADA') this.cargarDisponibilidad();
        if (estadoDe(lote) === 'EN_PRODUCCION' && this.controlaVencimiento() === null) this.cargarControlVencimiento();
      },
      error: (e) => {
        this.accionEnCurso.set(false);
        this.errorAccion.set(mapHttpError(e).mensaje);
        // El stock pudo cambiar: se refresca la validación para mostrar el estado real.
        if (this.estado() === 'PLANIFICADA') this.cargarDisponibilidad();
      }
    });
  }

  protected cerrar(): void {
    this.dialogRef.close(this.huboCambios);
  }

  /** Independiente del resto del detalle: si falla, no oculta litros/rendimiento ya cargados arriba. */
  protected cargarTrazabilidadAcopios(ids: string[]): void {
    this.cargandoTrazabilidad.set(true);
    this.errorTrazabilidad.set(null);
    forkJoin(ids.map((id) => this.acopiosApi.obtener(id)))
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (registros) => {
          this.trazabilidadAcopios.set(registros);
          this.cargandoTrazabilidad.set(false);
        },
        error: (error) => {
          this.errorTrazabilidad.set(mapHttpError(error));
          this.cargandoTrazabilidad.set(false);
        }
      });
  }

  /** GET /api/recepcion-planta/{id} solo está autorizado para RECEPCION/ADMIN -- para cualquier otro rol
   *  (PRODUCCION) se muestra directamente litrosConsumidos (ya viene en la respuesta del lote) sin intentar
   *  la llamada, para no generar un 403 esperado en cada apertura del detalle. */
  protected cargarTrazabilidadRecepciones(filas: RecepcionConsumida[]): void {
    if (!this.esAdmin()) {
      this.recepcionesConsumidas.set(filas.map((f) => ({ ...f, recepcion: null })));
      return;
    }
    this.cargandoTrazabilidad.set(true);
    this.errorTrazabilidad.set(null);
    forkJoin(filas.map((f) => this.recepcionApi.obtener(f.recepcionPlantaId)))
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (recepciones) => {
          this.recepcionesConsumidas.set(
            filas.map((f, i) => ({ ...f, recepcion: recepciones[i] }))
          );
          this.cargandoTrazabilidad.set(false);
        },
        error: (error) => {
          // No oculta la tabla: se degrada a mostrar solo litrosConsumidos, igual que para PRODUCCION.
          this.recepcionesConsumidas.set(filas.map((f) => ({ ...f, recepcion: null })));
          this.errorTrazabilidad.set(mapHttpError(error));
          this.cargandoTrazabilidad.set(false);
        }
      });
  }
}

