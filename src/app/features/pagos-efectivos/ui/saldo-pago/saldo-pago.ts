import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { PagoProveedorResponse, SaldoPagoResponse, etiquetaEstadoSaldo } from '../../data-access/pago-proveedor.models';
import { PagosProveedorApi } from '../../data-access/pagos-proveedor.api';
import { RegistrarPagoProveedorDialog } from '../registrar-pago-proveedor-dialog/registrar-pago-proveedor-dialog';

export interface LiquidacionResumen {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  semanaInicio: string;
  semanaFin: string;
}

/**
 * Saldo de UNA liquidación (ADMIN y RECEPCION): total a pagar + ajustes de litros, lo ya aplicado y lo que falta, tal como lo calcula el
 * servidor, con el atajo para registrar un pago. Cuando el padre pasa otra liquidación (p. ej. tras un ajuste de precio o de calidad releyó el
 * pago) el saldo se vuelve a leer: nunca se recalcula aquí.
 */
@Component({
  selector: 'app-saldo-pago',
  imports: [DecimalPipe, LoadingStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section-head"><h2>Pagos efectivos de esta liquidación</h2></div>
    @if (cargando()) {
      <ui-loading-state mensaje="Cargando saldo…" />
    } @else if (error()) {
      <ui-error-state [error]="error()" (reintentar)="cargar()" />
    } @else if (saldo(); as s) {
      <div class="saldo" data-testid="saldo-pago">
        <div class="fila"><span>Total a pagar</span><b>S/ {{ s.totalAPagar | number: '1.2-2' }}</b></div>
        @if (s.ajustesLitros !== 0) {
          <div class="fila" data-testid="saldo-ajustes">
            <span>Ajustes de litros posteriores</span>
            <b>{{ s.ajustesLitros < 0 ? '−' : '+' }}S/ {{ absoluto(s.ajustesLitros) | number: '1.2-2' }}</b>
          </div>
          <div class="fila"><span>Total con ajustes</span><b>S/ {{ s.totalConAjustes | number: '1.2-2' }}</b></div>
        }
        <div class="fila"><span>Aplicado (pagos vigentes)</span><b>S/ {{ s.aplicado | number: '1.2-2' }}</b></div>
        <div class="fila total" data-testid="saldo-saldo">
          <span>{{ s.saldo < 0 ? 'Saldo a favor del proveedor' : 'Saldo por pagar' }}</span>
          <b>S/ {{ absoluto(s.saldo) | number: '1.2-2' }}</b>
        </div>
        <div class="estado">
          <span class="badge" data-testid="saldo-estado" [class.amber]="s.estado === 'PENDIENTE' || s.estado === 'PARCIAL'" [class.blue]="s.estado === 'SALDO_A_FAVOR'">{{ etiqueta(s.estado) }}</span>
          <button type="button" class="btn small" data-testid="registrar-pago" (click)="registrarPago(s)">Registrar pago</button>
        </div>
        <small class="nota">El saldo lo calcula el servidor. Los pagos y adelantos se ven en «Pagos a proveedores».</small>
      </div>
    }
  `,
  styles: `
    .section-head { display: flex; justify-content: space-between; align-items: baseline; margin: var(--space-4) 0 var(--space-2); }
    .section-head h2 { font-size: var(--font-size-sm); font-weight: 800; margin: 0; }
    .fila { display: flex; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border); font-size: var(--font-size-sm); }
    .fila.total { font-size: var(--font-size-base); }
    .estado { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); padding: var(--space-3) 0 var(--space-1); }
    .nota { display: block; color: var(--color-text-muted); font-size: 0.7rem; }
  `
})
export class SaldoPagoComponent {
  readonly pago = input.required<LiquidacionResumen>();
  /** Se registró un pago desde aquí. */
  readonly registrado = output<PagoProveedorResponse>();

  private readonly api = inject(PagosProveedorApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly saldo = signal<SaldoPagoResponse | null>(null);

  constructor() {
    effect(() => {
      this.pago();
      this.cargar();
    });
  }

  protected etiqueta(estado: string): string {
    return etiquetaEstadoSaldo(estado);
  }

  protected absoluto(n: number): number {
    return Math.abs(n);
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.saldos([this.pago().id]).subscribe({
      next: (saldos) => {
        this.saldo.set(saldos[0] ?? null);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(mapHttpError(error));
        this.cargando.set(false);
      }
    });
  }

  protected registrarPago(saldo: SaldoPagoResponse): void {
    const pago = this.pago();
    const ref = this.dialog.open<PagoProveedorResponse | undefined>(RegistrarPagoProveedorDialog, {
      ariaLabel: `Registrar pago a ${pago.proveedorNombre}`,
      data: {
        proveedorId: pago.proveedorId,
        proveedorNombre: pago.proveedorNombre,
        liquidacion: { pagoId: pago.id, semana: `${pago.semanaInicio} → ${pago.semanaFin}`, saldo: saldo.saldo }
      }
    });
    ref.closed.subscribe((registrado) => {
      if (!registrado) return;
      this.toast.exito('Pago registrado.');
      this.cargar();
      this.registrado.emit(registrado);
    });
  }
}
