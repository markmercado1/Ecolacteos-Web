import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { AjusteCalidadEntregaResponse, LineaPagoResponse, PagoResponse } from '../../data-access/pago.models';
import { PagosApi } from '../../data-access/pagos.api';
import { PrecioCalidadDialog } from '../precio-calidad-dialog/precio-calidad-dialog';

export interface EntregasPagoDialogData {
  pago: PagoResponse;
  esAdmin: boolean;
}

/** Importe con signo explícito para los avisos (solo presentación del número que informa el servidor). */
function soles(importe: number): string {
  return `${importe < 0 ? '−' : ''}S/ ${Math.abs(importe).toFixed(2)}`;
}

/**
 * Entregas liquidadas en un pago (GET /api/pagos/{id}/lineas). Cada cantidad es un concepto distinto y todas las informa el servidor:
 * recibidos (originales), efectivos hoy, liquidados y contabilizados. Aquí solo ADMIN puede fijar el precio de calidad de una entrega.
 */
@Component({
  selector: 'app-entregas-pago-dialog',
  imports: [DecimalPipe, DatePipe, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <div>
        <h2 id="entregas-pago-titulo">Entregas del pago de {{ data.pago.proveedorNombre }}</h2>
        <small class="sub">Semana {{ data.pago.semanaInicio }} → {{ data.pago.semanaFin }}</small>
      </div>
      <button type="button" class="close" (click)="dialogRef.close(cambiado())" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="entregas-pago-titulo">
      <dl class="leyenda" aria-label="Qué significa cada cantidad">
        <div><dt>Recibidos</dt><dd>Lo que se pesó al recibir la leche. No cambia nunca.</dd></div>
        <div><dt>Efectivos hoy</dt><dd>Lo recibido, o la última corrección justificada. Una corrección no modifica lo recibido.</dd></div>
        <div><dt>Liquidados</dt><dd>Lo que se pagó cuando se generó este pago.</dd></div>
        <div><dt>Contabilizados</dt><dd>Liquidados más los ajustes de litros posteriores: lo que el pago tiene en cuenta hoy.</dd></div>
      </dl>

      @if (cargando()) {
        <ui-loading-state mensaje="Cargando las entregas del pago…" />
      } @else if (error()) {
        <ui-error-state [error]="error()" (reintentar)="cargar()" />
      } @else if (lineas().length === 0) {
        <ui-empty-state mensaje="Este pago no tiene entregas registradas." />
      } @else {
        <div class="tabla-scroll" tabindex="0" role="region" aria-label="Entregas del pago">
          <table>
            <thead>
              <tr>
                <th scope="col">Entrega</th>
                <th scope="col" class="num">Recibidos (L)</th>
                <th scope="col" class="num">Efectivos hoy (L)</th>
                <th scope="col" class="num">Liquidados (L)</th>
                <th scope="col" class="num">Contabilizados (L)</th>
                <th scope="col" class="num">Precio normal (S/)</th>
                <th scope="col" class="num">Precio aplicado (S/)</th>
                @if (data.esAdmin) { <th scope="col"><span class="sr-only">Acciones</span></th> }
              </tr>
            </thead>
            <tbody>
              @for (l of lineas(); track l.registroAcopioId) {
                <tr data-testid="entrega">
                  <td>
                    {{ l.fechaHora | date: 'dd/MM/yyyy HH:mm' }}
                    @if (l.litrosEfectivosActuales !== l.litrosOriginales) {
                      <span class="badge amber" title="Tiene una corrección justificada de litros">Corregida</span>
                    }
                  </td>
                  <td class="num" data-testid="originales">{{ l.litrosOriginales | number: '1.0-2' }}</td>
                  <td class="num" data-testid="efectivos">{{ l.litrosEfectivosActuales | number: '1.0-2' }}</td>
                  <td class="num" data-testid="liquidados">{{ l.litrosLiquidados | number: '1.0-2' }}</td>
                  <td class="num" data-testid="contabilizados">
                    {{ l.litrosContabilizados | number: '1.0-2' }}
                    @if (l.litrosContabilizados !== l.litrosLiquidados) {
                      <span class="badge blue" title="Hay ajustes de litros posteriores a la liquidación">Con ajuste</span>
                    }
                  </td>
                  <td class="num" data-testid="normal">{{ l.precioBase | number: '1.2-3' }}</td>
                  <td class="num" data-testid="aplicado">
                    {{ l.precioAplicado | number: '1.2-3' }}
                    @if (l.precioPropioDeCalidad) {
                      <span class="badge amber" [title]="'Precio de calidad: ' + (l.motivoAjusteCalidad ?? '')">Calidad</span>
                    }
                  </td>
                  @if (data.esAdmin) {
                    <td>
                      <button type="button" class="row-link" (click)="fijarPrecio(l)">Precio de calidad</button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="nota">
          Los importes y el total del pago los calcula el servidor. Un precio de calidad manda sobre el ajuste de precio del pago completo
          y se ve en el historial del pago.
        </p>
      }
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="dialogRef.close(cambiado())">Cerrar</button>
    </div>
  `,
  styles: `
    :host {
      display: block; width: min(68rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; overflow-wrap: anywhere; }
    .sub { color: var(--color-text-muted); }
    .close { flex: none; border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .leyenda { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: var(--space-3); margin: 0 0 var(--space-4); }
    .leyenda div { background: var(--color-surface-soft); border-radius: var(--radius-control); padding: var(--space-3); }
    .leyenda dt { font-weight: 800; font-size: var(--font-size-sm); }
    .leyenda dd { margin: var(--space-1) 0 0; font-size: 0.75rem; color: var(--color-text-muted); }
    .tabla-scroll { overflow-x: auto; border: 1px solid var(--color-border); border-radius: var(--radius-control); }
    .tabla-scroll:focus-visible { outline: 2px solid var(--color-primary, currentColor); outline-offset: 2px; }
    table { width: 100%; min-width: 52rem; border-collapse: collapse; font-size: var(--font-size-sm); }
    th, td { padding: var(--space-3); border-bottom: 1px solid var(--color-border); text-align: left; vertical-align: middle; }
    th { font-size: 0.75rem; color: var(--color-text-muted); font-weight: 700; background: var(--color-surface-soft); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    td .badge { margin-left: var(--space-2); }
    .nota { font-size: 0.75rem; color: var(--color-text-muted); margin: var(--space-3) 0 0; }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); padding: 0 var(--space-6) var(--space-6); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
  `
})
export class EntregasPagoDialog {
  protected readonly dialogRef = inject(DialogRef<boolean>);
  protected readonly data = inject<EntregasPagoDialogData>(DIALOG_DATA);
  private readonly pagosApi = inject(PagosApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly lineas = signal<LineaPagoResponse[]>([]);
  /** true si se fijó algún precio de calidad: quien abrió este diálogo debe volver a leer el pago. */
  protected readonly cambiado = signal(false);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.pagosApi.lineas(this.data.pago.id).subscribe({
      next: (lineas) => {
        // El servidor las entrega por orden de creación (todas del mismo instante): se muestran por fecha de entrega. Solo orden.
        this.lineas.set([...lineas].sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)));
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(mapHttpError(error));
        this.cargando.set(false);
      }
    });
  }

  protected fijarPrecio(linea: LineaPagoResponse): void {
    if (!this.data.esAdmin) return;
    const ref = this.dialog.open<AjusteCalidadEntregaResponse | undefined>(PrecioCalidadDialog, {
      ariaLabel: 'Precio de calidad de una entrega',
      data: { pagoId: this.data.pago.id, proveedorNombre: this.data.pago.proveedorNombre, linea }
    });
    ref.closed.subscribe((ajuste) => {
      if (!ajuste) return;
      this.cambiado.set(true);
      this.toast.exito(`Precio de calidad registrado. Efecto en el total de esa entrega: ${soles(ajuste.efectoEnElTotal)}.`);
      this.cargar(); // el servidor informa el precio aplicado actualizado
    });
  }
}
