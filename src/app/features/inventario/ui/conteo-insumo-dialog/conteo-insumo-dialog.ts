import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormsModule } from '@angular/forms';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { InsumoResponse } from '../../../catalogos/data-access/insumo.models';
import { LotesInsumoApi } from '../../data-access/lotes.api';
import { ConteoInsumoResponse, ETIQUETA_ESTADO_LOTE, LoteInsumoResponse } from '../../data-access/lotes.models';

export interface ConteoInsumoDialogData {
  insumo: InsumoResponse;
}

/** Cantidad con hasta 2 decimales y no negativa. */
const CANTIDAD = /^\d{1,10}(\.\d{1,2})?$/;

/**
 * Conteo físico por lote (solo ADMIN). Cada lote con existencia muestra lo que dice el sistema y se escribe lo REALMENTE contado; la
 * diferencia de cada lote queda como un movimiento de ajuste en ese lote, con el motivo obligatorio. Si el insumo tiene un solo lote,
 * se pide una sola cantidad (atajo). Las diferencias mostradas son una vista previa: el servidor las recalcula bajo bloqueo.
 */
@Component({
  selector: 'app-conteo-insumo-dialog',
  imports: [FormsModule, DecimalPipe, DatePipe, LoadingStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="conteo-titulo">Conteo físico · {{ data.insumo.nombre }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form class="dialog-body" (ngSubmit)="enviar()" aria-labelledby="conteo-titulo">
      <p class="hint">Escribe lo que contaste en el almacén. Si conoces la causa de una diferencia (derrame, rotura, vencimiento), usa «Registrar salida».</p>
      @if (cargando()) {
        <ui-loading-state mensaje="Cargando lotes…" />
      } @else if (error()) {
        <ui-error-state [error]="error()" (reintentar)="cargar()" />
      } @else if (lotes().length === 0) {
        <p class="vacio" role="status">Este insumo no tiene lotes con existencia.</p>
      } @else {
        <table class="tabla">
          <caption class="visually-hidden">Conteo por lote</caption>
          <thead>
            <tr>
              @if (!unico()) { <th scope="col">Lote</th><th scope="col">Vence</th> }
              <th scope="col" class="num">Sistema</th>
              <th scope="col" class="num">Contado ({{ data.insumo.unidadMedida }})</th>
              <th scope="col" class="num">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            @for (l of lotes(); track l.id) {
              <tr>
                @if (!unico()) {
                  <td>{{ l.codigo }} <small>{{ etiqueta(l) }}</small></td>
                  <td>{{ l.fechaVencimiento ? (l.fechaVencimiento | date: 'dd/MM/yyyy') : '—' }}</td>
                }
                <td class="num">{{ l.cantidadDisponible | number: '1.0-2' }}</td>
                <td class="num">
                  <input type="number" min="0" step="0.01" class="contado" [name]="'contado-' + l.id" [attr.aria-label]="'Cantidad contada del lote ' + l.codigo"
                         [ngModel]="valores()[l.id]" (ngModelChange)="poner(l.id, $event)">
                </td>
                <td class="num" [class.negativa]="diferencia(l) < 0" [class.positiva]="diferencia(l) > 0">
                  {{ diferencia(l) > 0 ? '+' : '' }}{{ diferencia(l) | number: '1.0-2' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (hayError()) { <p class="error" role="alert">Cada cantidad contada debe ser 0 o más, con hasta dos decimales.</p> }
        <div class="field motivo" [class.has-error]="intentado() && !motivo().trim()">
          <label for="conteo-motivo">Motivo de la diferencia (obligatorio)</label>
          <textarea id="conteo-motivo" rows="2" maxlength="500" name="motivo" [ngModel]="motivo()" (ngModelChange)="motivo.set($event)"
                    placeholder="Error de conteo, faltante sin causa conocida…"></textarea>
          @if (intentado() && !motivo().trim()) { <span class="error">Indica el motivo de la diferencia.</span> }
        </div>
      }
      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando() || cargando() || lotes().length === 0">{{ enviando() ? 'Guardando…' : 'Registrar conteo' }}</button>
      </div>
      <p class="hint">Queda en el kardex del insumo, en cada lote, con tu usuario, la fecha y hora y el motivo. Los movimientos no se editan ni se eliminan.</p>
    </form>
  `,
  styles: `
    :host { display: block; width: min(38rem, 100%); background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto; }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; flex-shrink: 0; }
    .dialog-body { padding: var(--space-6); }
    .tabla { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); margin-bottom: var(--space-4); }
    .tabla th, .tabla td { padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--color-border); text-align: left; vertical-align: middle; }
    .tabla .num { text-align: right; white-space: nowrap; }
    .contado { width: 7rem; text-align: right; }
    small { color: var(--color-text-muted); font-size: 0.7rem; margin-left: 0.3rem; }
    .negativa { color: var(--color-danger); font-weight: 700; }
    .positiva { color: var(--color-success); font-weight: 700; }
    .hint, .vacio { color: var(--color-text-muted); font-size: 0.75rem; margin: 0 0 var(--space-3); }
    .error { font-size: 0.6875rem; color: var(--color-danger); font-weight: 600; }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class ConteoInsumoDialog {
  protected readonly dialogRef = inject(DialogRef<ConteoInsumoResponse | undefined>);
  protected readonly data = inject<ConteoInsumoDialogData>(DIALOG_DATA);
  private readonly api = inject(LotesInsumoApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly lotes = signal<LoteInsumoResponse[]>([]);
  /** Lo contado de cada lote (por defecto, lo que dice el sistema). */
  protected readonly valores = signal<Record<string, number | null>>({});
  protected readonly motivo = signal('');
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly intentado = signal(false);
  /** Atajo: un solo lote con existencia = una sola cantidad. */
  protected readonly unico = computed(() => this.lotes().length === 1);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.listar(this.data.insumo.id, true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (lotes) => {
        this.lotes.set(lotes);
        this.valores.set(Object.fromEntries(lotes.map((l) => [l.id, l.cantidadDisponible])));
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mapHttpError(e));
        this.cargando.set(false);
      }
    });
  }

  protected etiqueta(l: LoteInsumoResponse): string {
    return ETIQUETA_ESTADO_LOTE[l.estado];
  }

  protected poner(id: string, valor: number | null): void {
    this.valores.update((v) => ({ ...v, [id]: valor }));
  }

  private contado(l: LoteInsumoResponse): number | null {
    const v = this.valores()[l.id];
    return v === null || v === undefined || `${v}` === '' ? null : Number(v);
  }

  /** Vista previa de la diferencia del lote (contado − sistema). */
  protected diferencia(l: LoteInsumoResponse): number {
    const c = this.contado(l);
    return c === null ? 0 : Math.round((c - l.cantidadDisponible) * 100) / 100;
  }

  protected hayError(): boolean {
    return this.lotes().some((l) => {
      const c = this.contado(l);
      return c === null || c < 0 || !CANTIDAD.test(`${c}`);
    });
  }

  protected enviar(): void {
    if (this.enviando()) return;
    this.intentado.set(true);
    const cambiados = this.lotes().filter((l) => this.contado(l) !== null && this.diferencia(l) !== 0);
    if (this.hayError() || !this.motivo().trim()) return;
    if (cambiados.length === 0) {
      this.errorServidor.set('Lo contado coincide con el sistema: no hay ninguna diferencia que registrar.');
      return;
    }
    this.enviando.set(true);
    this.errorServidor.set(null);
    this.api
      .contar(this.data.insumo.id, { motivo: this.motivo().trim(), lotes: cambiados.map((l) => ({ loteId: l.id, cantidadContada: this.contado(l)! })) })
      .subscribe({
        next: (r) => this.dialogRef.close(r),
        error: (e) => {
          this.enviando.set(false);
          this.errorServidor.set(mapHttpError(e).mensaje);
        }
      });
  }
}
