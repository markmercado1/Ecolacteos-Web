import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { VencimientoApi } from '../../../vencimiento/data-access/vencimiento.api';
import { InventarioApi } from '../../data-access/inventario.api';
import { ExistenciasPresentacionResponse, LoteExistenciaResponse } from '../../data-access/inventario.models';

export interface LotesPresentacionDialogData {
  presentacionId: string;
  presentacionNombre: string;
  productoNombre: string;
  /** Solo ADMIN puede regularizar existencias sin trazabilidad. */
  puedeRegularizar: boolean;
}

/**
 * Fase 2: lotes y vencimientos de UNA presentación de un producto con control de vencimiento. Solo lectura
 * (físico, vendible, vencido, sin trazabilidad y cada lote en orden FEFO) salvo la regularización (ADMIN):
 * reclasifica unidades que hoy están "sin trazabilidad" a un lote con la fecha de vencimiento de su etiqueta.
 * La regularización NO cambia el stock total ni el kardex -- solo deja de llamar "sin trazabilidad" a esas unidades.
 * Se cierra con `true` si hubo una regularización (la página de Inventario recarga su tabla).
 */
@Component({
  selector: 'app-lotes-presentacion-dialog',
  imports: [DatePipe, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="lotes-titulo">Lotes de {{ data.presentacionNombre }}</h2>
      <button type="button" class="close" (click)="cerrar()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="lotes-titulo">
      <p class="hint">{{ data.productoNombre }}</p>
      @if (cargando()) {
        <p class="hint">Cargando lotes…</p>
      } @else if (error()) {
        <p class="server-error" role="alert">{{ error()!.mensaje }}</p>
        <button type="button" class="btn small" (click)="cargar()">Reintentar</button>
      } @else if (existencias(); as e) {
        @if (mensajeExito()) { <p class="exito" role="status">{{ mensajeExito() }}</p> }
        <dl class="resumen">
          <div><dt>En inventario</dt><dd>{{ e.stockFisico }}</dd></div>
          <div><dt>Vendible</dt><dd class="ok">{{ e.stockVendible }}</dd></div>
          <div><dt>Vencido</dt><dd [class.malo]="e.stockVencido > 0">{{ e.stockVencido }}</dd></div>
          <div><dt>Sin trazabilidad</dt><dd [class.aviso]="e.stockSinTrazabilidad > 0">{{ e.stockSinTrazabilidad }}</dd></div>
        </dl>
        <p class="hint">
          Se vende primero lo que vence antes (FEFO). El día de vencimiento es el último día de venta. Lo vencido y lo
          «sin trazabilidad» (existencias anteriores al control, sin fecha conocida) no se venden. Hoy: {{ e.fechaReferencia | date: 'dd/MM/yyyy' }}.
        </p>

        @if (e.lotes.length === 0) {
          <p class="hint">No hay lotes con saldo. Los lotes aparecen al finalizar una producción de este producto.</p>
        } @else {
          <table class="tabla-historico">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Producido</th>
                <th>Vence</th>
                <th class="align-end">Cantidad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (l of e.lotes; track l.id) {
                <tr [class.fila-vencida]="l.vencido">
                  <td>{{ l.origen === 'REGULARIZACION' ? 'Regularizado' : 'Producción' }}</td>
                  <td>{{ l.fechaLote | date: 'dd/MM/yyyy' }}</td>
                  <td>{{ l.fechaVencimiento | date: 'dd/MM/yyyy' }}</td>
                  <td class="align-end">{{ l.saldo }}</td>
                  <td><span class="badge" [class.red]="l.vencido" [class.amber]="!l.vencido && l.diasParaVencer <= 7" [class.green]="!l.vencido && l.diasParaVencer > 7">{{ estado(l) }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        }

        @if (data.puedeRegularizar && e.stockSinTrazabilidad > 0) {
          <form class="regularizar" [formGroup]="form" (ngSubmit)="regularizar()" aria-labelledby="regularizar-titulo">
            <h3 id="regularizar-titulo">Regularizar existencias sin trazabilidad</h3>
            <p class="hint">
              Indica cuántas de las {{ e.stockSinTrazabilidad }} unidades sin trazabilidad tienen una fecha de vencimiento conocida
              (la de su etiqueta). No cambia la cantidad total ni el kardex; esas unidades pasan a venderse en FEFO mientras no venzan.
            </p>
            <div class="fila-campos">
              <div class="field" [class.has-error]="invalido('cantidad')">
                <label for="reg-cantidad">Cantidad</label>
                <input id="reg-cantidad" type="number" min="1" step="1" [max]="e.stockSinTrazabilidad" formControlName="cantidad" required>
                @if (invalido('cantidad')) { <span class="error">Entre 1 y {{ e.stockSinTrazabilidad }}.</span> }
              </div>
              <div class="field" [class.has-error]="invalido('fechaVencimiento')">
                <label for="reg-fecha">Vence (según la etiqueta)</label>
                <input id="reg-fecha" type="date" formControlName="fechaVencimiento" required>
                @if (invalido('fechaVencimiento')) { <span class="error">Indica la fecha.</span> }
              </div>
            </div>
            <div class="field" [class.has-error]="invalido('motivo')">
              <label for="reg-motivo">Motivo</label>
              <textarea id="reg-motivo" rows="2" maxlength="300" formControlName="motivo" required></textarea>
              @if (invalido('motivo')) { <span class="error">Explica de dónde sale la fecha (obligatorio).</span> }
            </div>
            @if (errorRegularizar()) { <p class="server-error" role="alert">{{ errorRegularizar() }}</p> }
            <div class="dialog-foot-inline">
              <button type="submit" class="btn primary small" [disabled]="enviando()">
                {{ enviando() ? 'Guardando…' : 'Regularizar' }}
              </button>
            </div>
          </form>
        }
      }
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="cerrar()">Cerrar</button>
    </div>
  `,
  styles: `
    :host {
      display: block; width: min(40rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .hint { color: var(--color-text-muted); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); }
    .exito { color: var(--color-success, #166534); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); }
    .resumen { display: grid; grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr)); gap: var(--space-2) var(--space-4); margin: 0 0 var(--space-4); padding: var(--space-3); background: var(--color-surface-muted, var(--color-border)); border-radius: var(--radius-control); }
    .resumen dt { color: var(--color-text-muted); font-size: 0.75rem; }
    .resumen dd { margin: 0.1rem 0 0; font-weight: 700; font-size: var(--font-size-lg); }
    .resumen dd.ok { color: var(--color-success, #166534); }
    .resumen dd.malo { color: var(--color-danger); }
    .resumen dd.aviso { color: var(--color-warning, #b45309); }
    .tabla-historico { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); margin-bottom: var(--space-4); }
    .tabla-historico th, .tabla-historico td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--color-border); }
    .tabla-historico th.align-end, .tabla-historico td.align-end { text-align: right; }
    .fila-vencida td { color: var(--color-text-muted); }
    .badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; background: var(--color-surface-soft); color: var(--color-text-muted); font-size: 0.75rem; font-weight: 700; }
    .badge.green { background: var(--color-success-bg, #dcfce7); color: var(--color-success, #166534); }
    .badge.amber { background: var(--color-warning-bg, #fef3c7); color: var(--color-warning, #b45309); }
    .badge.red { background: var(--color-danger-bg); color: var(--color-danger); }
    .regularizar { border-top: 1px solid var(--color-border); padding-top: var(--space-4); }
    .regularizar h3 { font-size: var(--font-size-md, 1rem); margin: 0 0 var(--space-2); }
    .fila-campos { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
    .field { margin-bottom: var(--space-3); }
    label { display: block; font-size: var(--font-size-sm); font-weight: 600; margin-bottom: var(--space-1); }
    input, textarea { width: 100%; padding: var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-control); font-family: inherit; }
    .error { color: var(--color-danger); font-size: var(--font-size-sm); }
    .dialog-foot-inline { display: flex; justify-content: flex-end; }
    .dialog-foot { display: flex; justify-content: flex-end; padding: 0 var(--space-6) var(--space-6); }
  `
})
export class LotesPresentacionDialog {
  protected readonly dialogRef = inject(DialogRef<boolean>);
  protected readonly data = inject<LotesPresentacionDialogData>(DIALOG_DATA);
  private readonly inventarioApi = inject(InventarioApi);
  private readonly vencimientoApi = inject(VencimientoApi);
  private readonly fb = inject(FormBuilder);
  private readonly destroy = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly existencias = signal<ExistenciasPresentacionResponse | null>(null);

  protected readonly enviando = signal(false);
  protected readonly errorRegularizar = signal<string | null>(null);
  protected readonly mensajeExito = signal<string | null>(null);
  private huboCambios = false;

  protected readonly form = this.fb.group({
    cantidad: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]),
    fechaVencimiento: this.fb.nonNullable.control('', Validators.required),
    motivo: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(300)])
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.inventarioApi
      .obtenerExistencias(this.data.presentacionId)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (e) => {
          this.existencias.set(e);
          this.cargando.set(false);
        },
        error: (error) => {
          this.error.set(mapHttpError(error));
          this.cargando.set(false);
        }
      });
  }

  protected estado(l: LoteExistenciaResponse): string {
    if (l.vencido) return `Vencido hace ${Math.abs(l.diasParaVencer)} d`;
    if (l.diasParaVencer === 0) return 'Vence hoy';
    return `Vence en ${l.diasParaVencer} d`;
  }

  protected invalido(campo: 'cantidad' | 'fechaVencimiento' | 'motivo'): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

  protected regularizar(): void {
    const e = this.existencias();
    if (!e || this.enviando()) return;
    const { cantidad } = this.form.getRawValue();
    if (this.form.invalid || cantidad === null || cantidad > e.stockSinTrazabilidad) {
      this.form.markAllAsTouched();
      if (cantidad !== null && cantidad > e.stockSinTrazabilidad) {
        this.form.controls.cantidad.setErrors({ max: true });
      }
      return;
    }
    this.enviando.set(true);
    this.errorRegularizar.set(null);
    this.mensajeExito.set(null);
    const { fechaVencimiento, motivo } = this.form.getRawValue();
    this.vencimientoApi
      .regularizar(this.data.presentacionId, { cantidad, fechaVencimiento, motivo: motivo.trim() })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.enviando.set(false);
          this.huboCambios = true;
          this.mensajeExito.set(
            `Se regularizaron ${r.cantidad} unidades${r.vencido ? ' (ya vencidas: no se podrán vender)' : ''}. Quedan ${r.sinTrazabilidadRestante} sin trazabilidad.`
          );
          this.form.reset({ cantidad: null, fechaVencimiento: '', motivo: '' });
          this.cargar();
        },
        error: (error) => {
          this.enviando.set(false);
          this.errorRegularizar.set(mapHttpError(error).mensaje);
        }
      });
  }

  protected cerrar(): void {
    this.dialogRef.close(this.huboCambios);
  }
}
