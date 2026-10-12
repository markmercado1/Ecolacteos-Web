import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { VencimientoApi } from '../../data-access/vencimiento.api';

export interface ControlVencimientoDialogData {
  productoId: string;
  productoNombre: string;
}

/**
 * Fase 2 (ADMIN): activar o desactivar el control de vencimiento de UN producto. Consulta el estado al abrir
 * (GET /control-vencimiento/productos) y pide una confirmación explícita dentro del mismo diálogo (sin apilar
 * otro) porque activar tiene consecuencias: las existencias actuales pasan a «sin trazabilidad» (no vendibles
 * hasta regularizarlas en Inventario) y cada producción exigirá una fecha de vencimiento. Se cierra con `true`
 * si el estado cambió.
 */
@Component({
  selector: 'app-control-vencimiento-dialog',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="control-venc-titulo">Control de vencimiento</h2>
      <button type="button" class="close" (click)="cerrar()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="control-venc-titulo">
      <p class="producto">{{ data.productoNombre }}</p>
      @if (cargando()) {
        <p class="hint">Consultando el estado…</p>
      } @else if (errorCarga()) {
        <p class="server-error" role="alert">{{ errorCarga()!.mensaje }}</p>
        <button type="button" class="btn small" (click)="cargar()">Reintentar</button>
      } @else {
        <p class="estado">
          Estado:
          <span class="badge" [class.green]="controla()">{{ controla() ? 'Activo' : 'No controla vencimiento' }}</span>
        </p>

        @if (!controla()) {
          <p class="hint">
            Con el control activo, cada producción de este producto exige la fecha de vencimiento de la etiqueta y las ventas
            salen primero del lote que vence antes (FEFO). Los lotes vencidos no se venden.
          </p>
          @if (confirmando()) {
            <div class="aviso" role="alert">
              <strong>Antes de activar:</strong> las existencias que hoy tiene este producto quedarán «sin trazabilidad» y
              <strong>no se podrán vender</strong> hasta que las regularices en Inventario → Lotes y vencimientos (o las des de baja con
              un ajuste). Solo se puede desactivar el control mientras no haya movimientos desde la activación.
            </div>
          }
        } @else {
          <p class="hint">
            Solo se puede desactivar si aún no hubo movimientos asignados a lotes desde la activación y el stock no cambió. Si ya
            los hay, el control permanece activo.
          </p>
          @if (confirmando()) {
            <div class="aviso" role="alert">
              <strong>¿Desactivar el control?</strong> El producto volverá a venderse sin fechas de vencimiento.
            </div>
          }
        }

        @if (errorAccion()) { <p class="server-error" role="alert">{{ errorAccion() }}</p> }
      }
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="cerrar()">Cerrar</button>
      @if (!cargando() && !errorCarga()) {
        @if (!confirmando()) {
          <button type="button" class="btn" [class.primary]="!controla()" (click)="confirmando.set(true)">
            {{ controla() ? 'Desactivar control…' : 'Activar control…' }}
          </button>
        } @else {
          <button type="button" class="btn" (click)="confirmando.set(false)" [disabled]="enviando()">Volver</button>
          <button type="button" class="btn" [class.danger]="controla()" [class.primary]="!controla()" (click)="aplicar()" [disabled]="enviando()">
            {{ enviando() ? 'Procesando…' : controla() ? 'Confirmar desactivación' : 'Confirmar activación' }}
          </button>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block; width: min(30rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay);
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .producto { font-weight: 700; margin: 0 0 var(--space-3); }
    .estado { margin: 0 0 var(--space-3); }
    .hint { color: var(--color-text-muted); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); }
    .aviso { background: var(--color-warning-bg, #fef3c7); color: var(--color-text); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); }
    .badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; background: var(--color-surface-soft); color: var(--color-text-muted); font-size: 0.75rem; font-weight: 700; }
    .badge.green { background: var(--color-success-bg, #dcfce7); color: var(--color-success, #166534); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); padding: 0 var(--space-6) var(--space-6); }
  `
})
export class ControlVencimientoDialog {
  protected readonly dialogRef = inject(DialogRef<boolean>);
  protected readonly data = inject<ControlVencimientoDialogData>(DIALOG_DATA);
  private readonly api = inject(VencimientoApi);
  private readonly destroy = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<AppError | null>(null);
  protected readonly controla = signal(false);
  protected readonly confirmando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorAccion = signal<string | null>(null);
  private huboCambios = false;

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.api
      .productosConControl()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.controla.set(r.productoIds.includes(this.data.productoId));
          this.cargando.set(false);
        },
        error: (error) => {
          this.errorCarga.set(mapHttpError(error));
          this.cargando.set(false);
        }
      });
  }

  protected aplicar(): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.errorAccion.set(null);
    const accion$ = this.controla() ? this.api.desactivar(this.data.productoId) : this.api.activar(this.data.productoId);
    accion$.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.confirmando.set(false);
        this.huboCambios = true;
        this.controla.set(r.controlaVencimiento);
      },
      error: (error) => {
        this.enviando.set(false);
        // 409 (activación deshabilitada en este entorno / ya hay movimientos) y demás: se muestra el mensaje del servidor.
        this.errorAccion.set(mapHttpError(error).mensaje);
        this.confirmando.set(false);
      }
    });
  }

  protected cerrar(): void {
    this.dialogRef.close(this.huboCambios);
  }
}
