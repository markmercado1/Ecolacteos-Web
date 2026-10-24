import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { TipoClienteVenta, VentaResumenResponse } from '../../data-access/venta.models';
import { VentasApi } from '../../data-access/ventas.api';

export interface VentaDetalleDialogData {
  id: string;
}

const ETIQUETAS_CANAL: Record<TipoClienteVenta, string> = {
  MAYORISTA: 'Mayorista',
  PROVEEDOR: 'Proveedor',
  PUBLICO: 'Público'
};

/** Solo lectura. Siempre consulta GET /api/ventas/{id}, incluso justo tras registrar la venta. Fase 4
 *  (Venta multi-línea / carrito): muestra todas las líneas de la venta, no solo una. */
@Component({
  selector: 'app-venta-detalle-dialog',
  imports: [DatePipe, DecimalPipe, LoadingStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="venta-detalle-titulo">Detalle de venta</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="venta-detalle-titulo">
      @if (cargando()) {
        <ui-loading-state mensaje="Cargando venta…" />
      } @else if (error()) {
        <ui-error-state [error]="error()" (reintentar)="cargar()" />
      } @else if (venta(); as v) {
        <dl>
          <div><dt>Fecha</dt><dd>{{ v.fecha | date: 'dd/MM/yyyy' }}</dd></div>
          <div><dt>Canal</dt><dd>{{ etiquetaCanal(v.tipoCliente) }}</dd></div>
          <div><dt>Identificador</dt><dd class="codigo">{{ v.id }}</dd></div>
        </dl>
        <table class="tabla-lineas">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Presentación</th>
              <th class="align-end">Cantidad</th>
              <th class="align-end">P. unitario</th>
              <th class="align-end">Subtotal</th>
              @if (conDesglose(v)) { <th>IGV</th> }
            </tr>
          </thead>
          <tbody>
            @for (linea of v.detalles; track linea.presentacionId) {
              <tr>
                <td>{{ linea.productoNombre }}</td>
                <td>{{ linea.presentacionNombre }}</td>
                <td class="align-end">{{ linea.cantidad }}</td>
                <td class="align-end">S/ {{ linea.precioUnitario | number: '1.2-2' }}</td>
                <td class="align-end">S/ {{ linea.subtotal | number: '1.2-2' }}</td>
                @if (conDesglose(v)) {
                  <td data-testid="igv-linea">
                    @if (linea.afectacionIgv === 'GRAVADO') { Incluye S/ {{ linea.igv | number: '1.2-2' }} ({{ linea.tasaIgv | number: '1.0-2' }} %) }
                    @else if (linea.afectacionIgv) { {{ linea.afectacionIgv === 'EXONERADO' ? 'Exonerado' : 'Inafecto' }} }
                    @else { <span class="muted">Sin determinar</span> }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
        <p class="total">Total confirmado por el servidor: S/ {{ v.total | number: '1.2-2' }}</p>
        @if (conDesglose(v) && v.igv; as igv) {
          <div class="desglose" data-testid="desglose-igv">
            @if (igv.incluyeIgv) { <p><strong>Incluye IGV: S/ {{ igv.igvTotal | number: '1.2-2' }}</strong> · Op. gravadas S/ {{ igv.operacionesGravadas | number: '1.2-2' }}</p> }
            @if (igv.operacionesExoneradas > 0) { <p>Op. exoneradas: S/ {{ igv.operacionesExoneradas | number: '1.2-2' }}</p> }
            @if (igv.operacionesInafectas > 0) { <p>Op. inafectas: S/ {{ igv.operacionesInafectas | number: '1.2-2' }}</p> }
            @if (igv.estado === 'PARCIAL') { <p class="muted">Sin determinar: S/ {{ igv.montoSinDeterminar | number: '1.2-2' }} (presentaciones sin afectación definida).</p> }
          </div>
        }
      }
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="dialogRef.close()">Cerrar</button>
    </div>
  `,
  styles: `
    :host {
      display: block; width: min(30rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 85vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    dl { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3) var(--space-4); margin: 0 0 var(--space-4); }
    dt { color: var(--color-text-muted); font-size: 0.75rem; }
    dd { margin: 0.2rem 0 0; font-weight: 600; overflow-wrap: anywhere; }
    .codigo { font-family: monospace; font-weight: 400; font-size: 0.75rem; }
    .tabla-lineas { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
    .tabla-lineas th, .tabla-lineas td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--color-border); }
    .tabla-lineas th.align-end, .tabla-lineas td.align-end { text-align: right; }
    .total { font-weight: 700; margin-top: var(--space-4); text-align: right; }
    .desglose { text-align: right; font-size: var(--font-size-sm); }
    .desglose p { margin: 0.2rem 0; }
    .muted { color: var(--color-text-muted); }
    .dialog-foot { display: flex; justify-content: flex-end; padding: 0 var(--space-6) var(--space-6); }
    @media (max-width: 480px) { dl { grid-template-columns: 1fr; } }
  `
})
export class VentaDetalleDialog {
  protected readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<VentaDetalleDialogData>(DIALOG_DATA);
  private readonly ventasApi = inject(VentasApi);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly venta = signal<VentaResumenResponse | null>(null);

  constructor() {
    this.cargar();
  }

  /**
   * Fase G: el desglose solo se muestra si el servidor registró la foto tributaria de alguna línea. Una venta anterior o registrada con
   * el cálculo apagado se ve exactamente como antes (sin «Incluye IGV»).
   */
  protected conDesglose(v: VentaResumenResponse): boolean {
    return !!v.igv && v.igv.estado !== 'SIN_DETERMINAR';
  }

  protected etiquetaCanal(canal: TipoClienteVenta): string {
    return ETIQUETAS_CANAL[canal];
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.ventasApi.obtener(this.data.id).subscribe({
      next: (venta) => {
        this.venta.set(venta);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(mapHttpError(error));
        this.cargando.set(false);
      }
    });
  }
}
