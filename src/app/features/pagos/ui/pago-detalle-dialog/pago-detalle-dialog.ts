import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import {
  AjusteCalidadEntregaResponse, AjustePagoResponse, AjustePrecioPagoResponse, PagoResponse, pagoAjustado, pagoConAjusteDeCalidad, totalDePago
} from '../../data-access/pago.models';
import { PagosApi } from '../../data-access/pagos.api';
import { SaldoPagoComponent } from '../../../pagos-efectivos/ui/saldo-pago/saldo-pago';
import { EntregasPagoDialog } from '../entregas-pago-dialog/entregas-pago-dialog';

export interface PagoDetalleDialogData {
  pago: PagoResponse;
  esAdmin: boolean;
  /** ADMIN, RECEPCION y CALIDAD pueden consultar el historial de precios de calidad (GET /pagos/{id}/ajustes-calidad). */
  puedeVerHistorialCalidad?: boolean;
}

/** El motivo es obligatorio y no puede ser solo espacios (el servidor también lo exige). */
function motivoConTexto(control: AbstractControl): ValidationErrors | null {
  return String(control.value ?? '').trim() ? null : { motivoVacio: true };
}

@Component({
  selector: 'app-pago-detalle-dialog',
  imports: [ReactiveFormsModule, DecimalPipe, DatePipe, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent, SaldoPagoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="pago-detalle-titulo">Pago de {{ pago().proveedorNombre }}</h2>
      <button type="button" class="close" (click)="dialogRef.close(cambiado())" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="pago-detalle-titulo">
      <div class="detail-row"><span>Semana</span><b>{{ pago().semanaInicio }} → {{ pago().semanaFin }}</b></div>
      <div class="detail-row"><span>Litros liquidados</span><b>{{ pago().litrosTotales }} L</b></div>
      <div class="detail-row">
        <span>{{ ajustado() ? 'Precio por litro original' : 'Precio por litro' }}</span>
        <b>S/ {{ pago().precioLitro | number: '1.2-3' }}</b>
      </div>
      <div class="detail-row">
        <span>{{ ajustado() || conCalidad() ? 'Total original' : 'Total' }}</span>
        <b>S/ {{ pago().total | number: '1.2-2' }}</b>
      </div>
      @if (ajustado()) {
        <div class="detail-row" data-testid="precio-ajustado">
          <span>Precio por litro ajustado (todo el pago)</span><b>S/ {{ pago().precioLitroEfectivo | number: '1.2-3' }}</b>
        </div>
      }
      @if (conCalidad()) {
        <div class="detail-row" data-testid="ajuste-calidad">
          <span>Ajuste por precios de calidad de entregas</span>
          <b>{{ pago().ajusteCalidad < 0 ? '−' : '+' }}S/ {{ absoluto(pago().ajusteCalidad) | number: '1.2-2' }}</b>
        </div>
      }
      @if (ajustado() || conCalidad()) {
        <div class="detail-row total-pagar" data-testid="total-a-pagar">
          <span>Total a pagar</span><b>S/ {{ pago().totalAPagar | number: '1.2-2' }}</b>
        </div>
        <small class="nota-total" data-testid="nota-total">
          El servidor calcula el total sumando, entrega por entrega, los litros liquidados por el precio aplicado a cada una.
        </small>
      }
      <div class="detail-row"><span>Registros de acopio incluidos</span><b>{{ pago().registroAcopioIds.length }}</b></div>
      <div class="detail-row">
        <span>Comprobante</span>
        <b>{{ pago().comprobanteGenerado ? 'Generado' : 'Pendiente' }}</b>
      </div>

      @if (data.esAdmin && !pago().comprobanteGenerado) {
        <button type="button" class="btn primary marcar-btn" [disabled]="marcando()" (click)="confirmarMarcarComprobante()">
          {{ marcando() ? 'Guardando…' : 'Marcar comprobante generado' }}
        </button>
      }

      <button type="button" class="btn entregas-btn" data-testid="ver-entregas" (click)="verEntregas()">
        Ver entregas y precios de calidad
      </button>

      @if (data.esAdmin) {
        @if (!ajustando()) {
          <button type="button" class="btn ajustar-btn" (click)="abrirAjuste()">Ajustar pago</button>
        } @else {
          <form [formGroup]="form" (ngSubmit)="aplicarAjuste()" class="ajuste-form" aria-label="Ajustar el precio de este pago">
            <h3>Ajustar precio por litro</h3>
            <p class="hint">
              Cambia el precio solo de <b>este pago</b>; el precio general de la leche y los demás pagos no se tocan.
              El pago original se conserva y el cambio queda registrado con su motivo.
            </p>
            @if (conPreciosPropios()) {
              <p class="hint" data-testid="aviso-precios-propios">
                Algunas entregas de este pago tienen un <b>precio de calidad propio</b>, que manda sobre este ajuste: el nuevo precio solo
                alcanzará a las demás entregas.
              </p>
            }
            <div class="field" [class.has-error]="invalido('precioLitroNuevo')">
              <label for="precioLitroNuevo">Nuevo precio por litro (S/)</label>
              <input id="precioLitroNuevo" type="number" step="0.001" min="0.001" max="999.999" inputmode="decimal"
                     formControlName="precioLitroNuevo" placeholder="Ej. 1.20">
              @if (invalido('precioLitroNuevo')) {
                <small class="field-error" role="alert">Ingresa un precio entre 0.001 y 999.999 (hasta 3 decimales).</small>
              }
            </div>
            <div class="field" [class.has-error]="invalido('motivo')">
              <label for="motivoAjuste">Motivo</label>
              <textarea id="motivoAjuste" rows="2" maxlength="500" formControlName="motivo"
                        placeholder="Ej. Leche de mala calidad / reconocimiento por calidad"></textarea>
              @if (invalido('motivo')) {
                <small class="field-error" role="alert">El motivo es obligatorio.</small>
              }
            </div>
            @if (precioIngresado() !== null && conPreciosPropios()) {
              <div class="vista-previa" data-testid="vista-previa-no-disponible">
                <small>
                  No se muestra una vista previa del total porque hay entregas con precio de calidad propio: el servidor calcula el total
                  resultante al aplicar el ajuste (puedes verlo después en «Total a pagar»).
                </small>
              </div>
            }
            @if (vista(); as v) {
              <div class="vista-previa" data-testid="vista-previa" [class.baja]="v.diferencia < 0" [class.sube]="v.diferencia > 0">
                <div>{{ pago().litrosTotales }} L × S/ {{ v.precio | number: '1.2-3' }} = <b>S/ {{ v.total | number: '1.2-2' }}</b></div>
                <small>
                  {{ v.diferencia > 0 ? '+' : v.diferencia < 0 ? '−' : '' }}S/ {{ absoluto(v.diferencia) | number: '1.2-2' }}
                  frente al total a pagar actual (S/ {{ pago().totalAPagar | number: '1.2-2' }})
                </small>
              </div>
            }
            @if (errorAjuste()) { <p class="server-error" role="alert">{{ errorAjuste() }}</p> }
            <div class="ajuste-acciones">
              <button type="button" class="btn" (click)="cerrarAjuste()" [disabled]="guardandoAjuste()">Cancelar</button>
              <button type="submit" class="btn primary" [disabled]="form.invalid || sinCambio() || guardandoAjuste()">
                {{ guardandoAjuste() ? 'Guardando…' : 'Aplicar ajuste' }}
              </button>
            </div>
            @if (sinCambio() && form.controls.precioLitroNuevo.valid) {
              <small class="field-error">Ese ya es el precio de este pago.</small>
            }
          </form>
        }
      }

      <app-saldo-pago [pago]="pago()" />

      <div class="section-head">
        <h2>Historial de ajustes de precio</h2>
      </div>
      @if (cargandoPrecios()) {
        <ui-loading-state mensaje="Cargando historial…" />
      } @else if (errorPrecios()) {
        <ui-error-state [error]="errorPrecios()" (reintentar)="cargarAjustesPrecio()" />
      } @else if (ajustesPrecio().length === 0) {
        <ui-empty-state mensaje="El precio de este pago no se ha ajustado." />
      } @else {
        @for (a of ajustesPrecio(); track a.id) {
          <div class="ajuste-precio" data-testid="ajuste-precio">
            <div class="detail-row">
              <span>S/ {{ a.precioLitroAnterior | number: '1.2-3' }} → S/ {{ a.precioLitroNuevo | number: '1.2-3' }}</span>
              @if (!conPreciosPropios()) { <b>S/ {{ a.totalNuevo | number: '1.2-2' }}</b> }
            </div>
            <small class="meta">{{ a.motivo }} · {{ a.usuarioNombre }} · {{ a.creadoEn | date: 'dd/MM/yyyy HH:mm' }}</small>
          </div>
        }
      }

      @if (data.puedeVerHistorialCalidad) {
        <div class="section-head">
          <h2>Historial de precios de calidad</h2>
        </div>
        @if (cargandoCalidad()) {
          <ui-loading-state mensaje="Cargando precios de calidad…" />
        } @else if (errorCalidad()) {
          <ui-error-state [error]="errorCalidad()" (reintentar)="cargarAjustesCalidad()" />
        } @else if (ajustesCalidad().length === 0) {
          <ui-empty-state mensaje="Ninguna entrega de este pago tiene un precio de calidad propio." />
        } @else {
          @for (c of ajustesCalidad(); track c.id) {
            <div class="ajuste-calidad" data-testid="ajuste-calidad-item">
              <div class="detail-row">
                <span>Entrega …{{ c.registroAcopioId.slice(-6) }} · S/ {{ c.precioAnterior | number: '1.2-3' }} → S/ {{ c.precioLitroNuevo | number: '1.2-3' }}</span>
                <b>{{ c.efectoEnElTotal < 0 ? '−' : '+' }}S/ {{ absoluto(c.efectoEnElTotal) | number: '1.2-2' }}</b>
              </div>
              <small class="meta">
                Análisis {{ c.analisisFolio }}{{ c.analisisResultado ? ' (' + c.analisisResultado + ')' : '' }} · {{ c.litrosLiquidados | number: '1.0-2' }} L
                · precio normal S/ {{ c.precioNormal | number: '1.2-3' }}
              </small>
              <small class="meta">{{ c.motivo }} · {{ c.usuarioNombre }} · {{ c.creadoEn | date: 'dd/MM/yyyy HH:mm' }}</small>
            </div>
          }
        }
      }

      <div class="section-head">
        <h2>Ajustes de litros de este pago</h2>
      </div>
      @if (cargandoAjustes()) {
        <ui-loading-state mensaje="Cargando ajustes…" />
      } @else if (errorAjustes()) {
        <ui-error-state [error]="errorAjustes()" (reintentar)="cargarAjustes()" />
      } @else if (ajustes().length === 0) {
        <ui-empty-state mensaje="Sin ajustes registrados para este pago." />
      } @else {
        @for (ajuste of ajustes(); track ajuste.id) {
          <div class="ajuste-litros" data-testid="ajuste-litros">
            <div class="detail-row">
              <span>
                {{ ajuste.litrosDiferencia > 0 ? '+' : '' }}{{ ajuste.litrosDiferencia }} L
                <span class="badge" [class.amber]="ajuste.estado === 'PENDIENTE'" [class.gray]="ajuste.estado === 'LIQUIDADO'">{{ ajuste.estado }}</span>
              </span>
              <b>S/ {{ ajuste.monto | number: '1.2-2' }}</b>
            </div>
            <small class="meta" data-testid="ajuste-precio-litro">
              @if (ajuste.estado === 'PENDIENTE') {
                Precio vigente S/ {{ ajuste.precioLitro | number: '1.2-3' }}: sigue al precio de su entrega mientras esté pendiente.
              } @else {
                Precio congelado al liquidar S/ {{ ajuste.precioLitro | number: '1.2-3' }}.
              }
              @if (ajuste.precioLitroAlCrear !== ajuste.precioLitro) {
                Al crearlo valía S/ {{ ajuste.precioLitroAlCrear | number: '1.2-3' }} (S/ {{ ajuste.montoAlCrear | number: '1.2-2' }}).
              }
            </small>
          </div>
        }
      }
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" data-testid="ver-boleta" [disabled]="abriendoBoleta()" (click)="verBoleta()">
        {{ abriendoBoleta() ? 'Abriendo…' : 'Ver boleta (PDF)' }}
      </button>
      <button type="button" class="btn" (click)="dialogRef.close(cambiado())">Cerrar</button>
    </div>
  `,
  styles: `
    :host {
      display: block; width: min(28rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 85vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .detail-row { display: flex; justify-content: space-between; gap: var(--space-3); border-bottom: 1px solid var(--color-border); padding: var(--space-3) 0; font-size: var(--font-size-sm); }
    .detail-row span { color: var(--color-text-muted); }
    .detail-row b { text-align: right; }
    .detail-row.total-pagar span { color: inherit; font-weight: 800; }
    .detail-row.total-pagar b { font-size: var(--font-size-md, 1rem); }
    .marcar-btn { width: 100%; margin: var(--space-4) 0 0; }
    .entregas-btn { width: 100%; margin: var(--space-3) 0 0; }
    .nota-total { display: block; color: var(--color-text-muted); font-size: 0.75rem; padding: var(--space-2) 0 0; }
    .ajuste-calidad .meta, .ajuste-litros .meta { display: block; color: var(--color-text-muted); font-size: 0.75rem; padding: var(--space-1) 0 var(--space-1); overflow-wrap: anywhere; }
    .ajuste-litros .badge { margin-left: var(--space-2); }
    .ajustar-btn { width: 100%; margin: var(--space-3) 0 var(--space-2); }
    .ajuste-form { border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-4); margin: var(--space-3) 0; background: var(--color-surface-soft); }
    .ajuste-form h3 { font-size: var(--font-size-sm); font-weight: 800; margin: 0 0 var(--space-2); }
    .hint { font-size: 0.75rem; color: var(--color-text-muted); margin: 0 0 var(--space-3); }
    .field-error { color: var(--color-danger); font-size: 0.75rem; display: block; margin-top: var(--space-1); }
    .vista-previa { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-3); margin: 0 0 var(--space-3); font-size: var(--font-size-sm); }
    .vista-previa small { display: block; color: var(--color-text-muted); margin-top: var(--space-1); }
    .vista-previa.sube small { color: var(--color-success, var(--color-text-muted)); }
    .vista-previa.baja small { color: var(--color-danger); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); }
    .ajuste-acciones { display: flex; justify-content: flex-end; gap: var(--space-2); }
    .section-head { display: flex; justify-content: space-between; align-items: baseline; margin: var(--space-4) 0 var(--space-2); }
    .section-head h2 { font-size: var(--font-size-sm); font-weight: 800; margin: 0; }
    .ajuste-precio .meta { display: block; color: var(--color-text-muted); font-size: 0.75rem; padding: var(--space-1) 0 var(--space-2); overflow-wrap: anywhere; }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); padding: 0 var(--space-6) var(--space-6); }
  `
})
export class PagoDetalleDialog {
  protected readonly dialogRef = inject(DialogRef<boolean>);
  protected readonly data = inject<PagoDetalleDialogData>(DIALOG_DATA);
  private readonly pagosApi = inject(PagosApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly pago = signal(this.data.pago);
  protected readonly ajustado = computed(() => pagoAjustado(this.pago()));
  protected readonly conCalidad = computed(() => pagoConAjusteDeCalidad(this.pago()));
  /**
   * ¿Alguna entrega tiene precio de calidad propio? Se sabe por el ajuste de calidad que informa el servidor o por el historial de precios de
   * calidad. Mientras ese historial carga no se sabe: se trata como «sí» para no mostrar una vista previa que pueda ser incorrecta.
   */
  protected readonly conPreciosPropios = computed(
    () => this.conCalidad() || this.ajustesCalidad().length > 0 || this.cargandoCalidad()
  );
  protected readonly cambiado = signal(false);
  protected readonly marcando = signal(false);
  protected readonly abriendoBoleta = signal(false);

  protected readonly cargandoAjustes = signal(true);
  protected readonly errorAjustes = signal<AppError | null>(null);
  protected readonly ajustes = signal<AjustePagoResponse[]>([]);

  protected readonly cargandoPrecios = signal(true);
  protected readonly errorPrecios = signal<AppError | null>(null);
  protected readonly ajustesPrecio = signal<AjustePrecioPagoResponse[]>([]);

  protected readonly cargandoCalidad = signal(false);
  protected readonly errorCalidad = signal<AppError | null>(null);
  protected readonly ajustesCalidad = signal<AjusteCalidadEntregaResponse[]>([]);

  protected readonly ajustando = signal(false);
  protected readonly guardandoAjuste = signal(false);
  protected readonly errorAjuste = signal<string | null>(null);
  protected readonly form = this.fb.group({
    precioLitroNuevo: this.fb.control<number | null>(null, [
      Validators.required, Validators.min(0.001), Validators.max(999.999), Validators.pattern(/^\d+(\.\d{1,3})?$/)
    ]),
    motivo: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(500), motivoConTexto])
  });
  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  /** Precio tecleado, solo si es válido; si no, no hay vista previa. */
  protected readonly precioIngresado = computed(() => {
    const v = this.valores().precioLitroNuevo;
    return this.form.controls.precioLitroNuevo.valid && typeof v === 'number' ? v : null;
  });

  /** Vista previa del nuevo total (mismo redondeo que el servidor) y su diferencia con el total a pagar actual. */
  protected readonly vista = computed(() => {
    const precio = this.precioIngresado();
    if (precio === null || this.conPreciosPropios()) return null;
    const total = totalDePago(this.pago().litrosTotales, precio);
    return { precio, total, diferencia: Math.round((total - this.pago().totalAPagar) * 100) / 100 };
  });

  /** El precio tecleado ya es el precio vigente de este pago: no habría nada que ajustar. */
  protected readonly sinCambio = computed(() => {
    const precio = this.precioIngresado();
    return precio !== null && Math.round(precio * 1000) === Math.round(this.pago().precioLitroEfectivo * 1000);
  });

  constructor() {
    this.cargarAjustes();
    this.cargarAjustesPrecio();
    if (this.data.puedeVerHistorialCalidad) this.cargarAjustesCalidad();
  }

  /** Entregas del pago con cada cantidad por separado y, para ADMIN, el precio de calidad por entrega. */
  protected verEntregas(): void {
    const ref = this.dialog.open<boolean>(EntregasPagoDialog, {
      ariaLabel: `Entregas del pago de ${this.pago().proveedorNombre}`,
      data: { pago: this.pago(), esAdmin: this.data.esAdmin }
    });
    ref.closed.subscribe((huboCambios) => {
      if (!huboCambios) return;
      // Se fijó algún precio de calidad: el total y los ajustes los calcula el servidor, se vuelven a leer (no se recalcula aquí).
      this.cambiado.set(true);
      this.pagosApi.obtener(this.pago().id).subscribe({
        next: (actualizado) => this.pago.set(actualizado),
        error: (error) => this.toast.error(`El precio se guardó, pero no se pudo actualizar el detalle: ${mapHttpError(error).mensaje}`)
      });
      this.cargarAjustes();
      if (this.data.puedeVerHistorialCalidad) this.cargarAjustesCalidad();
    });
  }

  protected cargarAjustesCalidad(): void {
    this.cargandoCalidad.set(true);
    this.errorCalidad.set(null);
    this.pagosApi.ajustesDeCalidad(this.pago().id).subscribe({
      next: (ajustes) => {
        this.ajustesCalidad.set(ajustes);
        this.cargandoCalidad.set(false);
      },
      error: (error) => {
        this.errorCalidad.set(mapHttpError(error));
        this.cargandoCalidad.set(false);
      }
    });
  }

  protected absoluto(n: number): number {
    return Math.abs(n);
  }

  protected invalido(campo: 'precioLitroNuevo' | 'motivo'): boolean {
    const control = this.form.controls[campo];
    return control.invalid && control.touched;
  }

  protected abrirAjuste(): void {
    this.form.reset({ precioLitroNuevo: null, motivo: '' });
    this.errorAjuste.set(null);
    this.ajustando.set(true);
  }

  protected cerrarAjuste(): void {
    this.ajustando.set(false);
    this.errorAjuste.set(null);
  }

  protected aplicarAjuste(): void {
    if (this.form.invalid || this.sinCambio() || this.guardandoAjuste()) {
      this.form.markAllAsTouched();
      return;
    }
    const { precioLitroNuevo, motivo } = this.form.getRawValue();
    this.guardandoAjuste.set(true);
    this.errorAjuste.set(null);
    this.pagosApi.ajustarPrecio(this.pago().id, { precioLitroNuevo: precioLitroNuevo as number, motivo: motivo.trim() }).subscribe({
      next: () => {
        // El pago con su precio y total efectivos lo calcula el servidor: se vuelve a leer, no se recalcula aquí.
        this.pagosApi.obtener(this.pago().id).subscribe({
          next: (actualizado) => {
            this.pago.set(actualizado);
            this.cambiado.set(true);
            this.guardandoAjuste.set(false);
            this.ajustando.set(false);
            this.cargarAjustesPrecio();
            this.toast.exito('Precio del pago ajustado.');
          },
          error: (error) => {
            // El ajuste sí se guardó; solo falló refrescar la vista.
            this.cambiado.set(true);
            this.guardandoAjuste.set(false);
            this.ajustando.set(false);
            this.cargarAjustesPrecio();
            this.toast.error(`El ajuste se guardó, pero no se pudo actualizar el detalle: ${mapHttpError(error).mensaje}`);
          }
        });
      },
      error: (error) => {
        this.guardandoAjuste.set(false);
        this.errorAjuste.set(mapHttpError(error).mensaje);
      }
    });
  }

  protected cargarAjustes(): void {
    this.cargandoAjustes.set(true);
    this.errorAjustes.set(null);
    this.pagosApi.ajustesDePago(this.pago().id).subscribe({
      next: (ajustes) => {
        this.ajustes.set(ajustes);
        this.cargandoAjustes.set(false);
      },
      error: (error) => {
        this.errorAjustes.set(mapHttpError(error));
        this.cargandoAjustes.set(false);
      }
    });
  }

  protected cargarAjustesPrecio(): void {
    this.cargandoPrecios.set(true);
    this.errorPrecios.set(null);
    this.pagosApi.ajustesDePrecio(this.pago().id).subscribe({
      next: (ajustes) => {
        this.ajustesPrecio.set(ajustes);
        this.cargandoPrecios.set(false);
      },
      error: (error) => {
        this.errorPrecios.set(mapHttpError(error));
        this.cargandoPrecios.set(false);
      }
    });
  }

  /**
   * Abre la boleta en otra pestaña. La pestaña se abre en el mismo clic (antes de la petición) para que el navegador
   * no la bloquee como ventana emergente; luego se le asigna el PDF recibido con la sesión.
   */
  protected verBoleta(): void {
    if (this.abriendoBoleta()) return;
    const ventana = window.open('', '_blank');
    this.abriendoBoleta.set(true);
    this.pagosApi.boleta(this.pago().id).subscribe({
      next: (pdf) => {
        this.abriendoBoleta.set(false);
        if (!ventana) {
          this.toast.error('El navegador bloqueó la ventana de la boleta. Permite las ventanas emergentes e inténtalo de nuevo.');
          return;
        }
        const url = URL.createObjectURL(pdf);
        ventana.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (error) => {
        ventana?.close();
        this.abriendoBoleta.set(false);
        this.toast.error(mapHttpError(error).mensaje);
      }
    });
  }

  protected confirmarMarcarComprobante(): void {
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      ariaLabel: 'Marcar comprobante generado',
      data: {
        titulo: 'Marcar comprobante generado',
        mensaje: `Esto marca el pago de "${this.pago().proveedorNombre}" como con comprobante generado. Es solo una marca administrativa, no un documento ni un desembolso.`,
        etiquetaConfirmar: 'Marcar como generado'
      }
    });
    ref.closed.subscribe((confirmado) => {
      if (!confirmado) return;
      this.marcando.set(true);
      this.pagosApi.marcarComprobante(this.pago().id).subscribe({
        next: (actualizado) => {
          this.pago.set(actualizado);
          this.cambiado.set(true);
          this.marcando.set(false);
          this.toast.exito('Comprobante marcado como generado.');
        },
        error: (error) => {
          this.marcando.set(false);
          this.toast.error(mapHttpError(error).mensaje);
        }
      });
    });
  }
}
