import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { AjusteCalidadEntregaResponse } from '../../../pagos/data-access/pago.models';
import { CalidadApi } from '../../data-access/calidad.api';

export interface PreciosCalidadEntregaDialogData {
  registroAcopioId: string;
  /** Solo para el título; puede faltar (p. ej. al llegar desde la consulta por folio). */
  proveedorNombre?: string;
}

/**
 * Historial de precios de calidad de UNA entrega, para CALIDAD y ADMIN. Solo lectura: el precio lo fija un administrador al liquidar el pago.
 * No da acceso a los pagos ni muestra datos del proveedor; todos los importes los informa el servidor.
 */
@Component({
  selector: 'app-precios-calidad-entrega-dialog',
  imports: [DecimalPipe, DatePipe, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="precios-calidad-titulo">Precios de calidad de la entrega</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="precios-calidad-titulo">
      @if (data.proveedorNombre) { <p class="contexto">Entrega de <strong>{{ data.proveedorNombre }}</strong></p> }
      <p class="hint">
        Precios por litro fijados para esta entrega al liquidar su pago, con el análisis que los sustentó. Es solo una consulta: el precio lo fija un
        administrador.
      </p>
      @if (cargando()) {
        <ui-loading-state mensaje="Cargando los precios de calidad…" />
      } @else if (error()) {
        <ui-error-state [error]="error()" (reintentar)="cargar()" />
      } @else if (precios().length === 0) {
        <ui-empty-state mensaje="Esta entrega no tiene precios de calidad aplicados." />
      } @else {
        @for (p of precios(); track p.id) {
          <div class="precio" data-testid="precio-calidad">
            <div class="detail-row">
              <span>S/ {{ p.precioAnterior | number: '1.2-3' }} → <strong>S/ {{ p.precioLitroNuevo | number: '1.2-3' }}</strong> por litro</span>
              <b>{{ p.efectoEnElTotal < 0 ? '−' : '+' }}S/ {{ absoluto(p.efectoEnElTotal) | number: '1.2-2' }}</b>
            </div>
            <small class="meta">
              Análisis {{ p.analisisFolio }}{{ p.analisisResultado ? ' (' + p.analisisResultado + ')' : '' }} · {{ p.litrosLiquidados | number: '1.0-2' }} L liquidados ·
              precio normal S/ {{ p.precioNormal | number: '1.2-3' }}
            </small>
            <small class="meta">{{ p.motivo }} · {{ p.usuarioNombre }} · {{ p.creadoEn | date: 'dd/MM/yyyy HH:mm' }}</small>
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
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .contexto { font-size: var(--font-size-sm); margin: 0 0 var(--space-2); }
    .hint { font-size: 0.75rem; color: var(--color-text-muted); margin: 0 0 var(--space-3); }
    .detail-row { display: flex; justify-content: space-between; gap: var(--space-3); border-bottom: 1px solid var(--color-border); padding: var(--space-3) 0; font-size: var(--font-size-sm); }
    .detail-row span { color: var(--color-text-muted); }
    .detail-row b { text-align: right; }
    .meta { display: block; color: var(--color-text-muted); font-size: 0.75rem; padding: var(--space-1) 0; overflow-wrap: anywhere; }
    .dialog-foot { display: flex; justify-content: flex-end; padding: 0 var(--space-6) var(--space-6); }
  `
})
export class PreciosCalidadEntregaDialog {
  protected readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<PreciosCalidadEntregaDialogData>(DIALOG_DATA);
  private readonly calidadApi = inject(CalidadApi);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly precios = signal<AjusteCalidadEntregaResponse[]>([]);

  constructor() {
    this.cargar();
  }

  protected absoluto(n: number): number {
    return Math.abs(n);
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.calidadApi.preciosDeCalidad(this.data.registroAcopioId).subscribe({
      next: (precios) => {
        this.precios.set(precios);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(mapHttpError(error));
        this.cargando.set(false);
      }
    });
  }
}
