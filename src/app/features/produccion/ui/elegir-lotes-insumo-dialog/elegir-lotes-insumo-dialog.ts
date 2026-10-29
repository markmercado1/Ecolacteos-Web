import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormsModule } from '@angular/forms';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { LotesProduccionApi } from '../../data-access/lotes-produccion.api';
import { IniciarLoteRequest, PlanLotesInsumo, PlanLotesProduccion } from '../../data-access/lote-produccion.models';

export interface ElegirLotesInsumoDialogData {
  loteProduccionId: string;
}

/**
 * Elegir a mano los lotes de insumo con los que se inicia una producción (opcional). Por defecto cada insumo sale en FEFO (el lote que
 * vence antes); aquí se ve esa propuesta y se puede cambiar: por cada insumo, la suma de lo elegido debe ser exactamente lo que pide el plan
 * y ningún lote vencido se ofrece. Devuelve solo los insumos que se cambiaron (o ninguno: seguir en automático).
 */
@Component({
  selector: 'app-elegir-lotes-insumo-dialog',
  imports: [FormsModule, DecimalPipe, DatePipe, LoadingStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="elegir-titulo">Lotes de insumo de esta producción</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="elegir-titulo">
      <p class="hint">Por defecto cada insumo sale del lote que vence antes (FEFO). Cambia un insumo solo si necesitas usar otro lote; los vencidos no se ofrecen.</p>
      @if (cargando()) {
        <ui-loading-state mensaje="Cargando lotes…" />
      } @else if (error()) {
        <ui-error-state [error]="error()" (reintentar)="cargar()" />
      } @else {
        @for (i of plan()?.insumos ?? []; track i.insumoId) {
          <section class="insumo" [attr.aria-label]="i.insumoNombre">
            <header>
              <h3>{{ i.insumoNombre }} <small>necesita {{ i.requerido | number: '1.0-2' }} {{ i.unidadMedida }}</small></h3>
              @if (!editando()[i.insumoId]) {
                <button type="button" class="btn small" (click)="editar(i)">Cambiar lotes</button>
              } @else {
                <button type="button" class="btn small" (click)="volverAutomatico(i)">Volver a automático</button>
              }
            </header>
            @if (!editando()[i.insumoId]) {
              <ul>
                @for (p of i.propuesta; track p.loteId) {
                  <li>{{ p.codigo }} · {{ p.cantidad | number: '1.0-2' }} {{ i.unidadMedida }}{{ p.fechaVencimiento ? ' · vence ' + (p.fechaVencimiento | date: 'dd/MM/yyyy') : ' · sin vencimiento' }}</li>
                } @empty { <li class="error">No hay lotes consumibles suficientes.</li> }
              </ul>
            } @else {
              <table class="tabla">
                <caption class="visually-hidden">Lotes disponibles de {{ i.insumoNombre }}</caption>
                <thead><tr><th scope="col">Lote</th><th scope="col">Vence</th><th scope="col" class="num">Disponible</th><th scope="col" class="num">Usar</th></tr></thead>
                <tbody>
                  @for (d of i.disponibles; track d.loteId) {
                    <tr>
                      <td>{{ d.codigo }}@if (d.proveedorNombre) { <small>{{ d.proveedorNombre }}</small> }</td>
                      <td>{{ d.fechaVencimiento ? (d.fechaVencimiento | date: 'dd/MM/yyyy') : '—' }}</td>
                      <td class="num">{{ d.disponible | number: '1.0-2' }}</td>
                      <td class="num"><input type="number" min="0" step="0.01" class="usar" [name]="'usar-' + d.loteId" [attr.aria-label]="'Cantidad a usar del lote ' + d.codigo"
                                             [ngModel]="valores()[d.loteId]" (ngModelChange)="poner(d.loteId, $event)"></td>
                    </tr>
                  }
                </tbody>
              </table>
              <p class="suma" [class.mal]="problema(i)">Suma elegida: {{ suma(i) | number: '1.0-2' }} de {{ i.requerido | number: '1.0-2' }} {{ i.unidadMedida }}@if (problema(i); as p) { · {{ p }} }</p>
            }
          </section>
        }
      }
      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
      <button type="button" class="btn primary" [disabled]="cargando() || !!error() || hayProblemas()" (click)="aceptar()">
        {{ hayCambios() ? 'Usar estos lotes' : 'Seguir con el reparto automático' }}
      </button>
    </div>
  `,
  styles: `
    :host { display: block; width: min(42rem, 100%); background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto; }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; flex-shrink: 0; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); padding: 0 var(--space-6) var(--space-6); }
    .hint { color: var(--color-text-muted); font-size: 0.75rem; }
    .insumo { border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-3); margin-bottom: var(--space-3); }
    .insumo header { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
    .insumo h3 { font-size: var(--font-size-sm); margin: 0; }
    small { color: var(--color-text-muted); font-size: 0.75rem; margin-left: 0.4rem; }
    ul { margin: var(--space-2) 0 0; padding-left: 1.2rem; font-size: var(--font-size-sm); }
    .tabla { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); margin-top: var(--space-2); }
    .tabla th, .tabla td { text-align: left; padding: 0.3rem 0.5rem; border-bottom: 1px solid var(--color-border); }
    .tabla .num { text-align: right; }
    .usar { width: 6rem; text-align: right; }
    .suma { font-size: var(--font-size-sm); font-weight: 600; margin: var(--space-2) 0 0; }
    .suma.mal, .error { color: var(--color-danger); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); }
  `
})
export class ElegirLotesInsumoDialog {
  protected readonly dialogRef = inject(DialogRef<IniciarLoteRequest | null | undefined>);
  private readonly data = inject<ElegirLotesInsumoDialogData>(DIALOG_DATA);
  private readonly api = inject(LotesProduccionApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly plan = signal<PlanLotesProduccion | null>(null);
  /** Insumos que se están cambiando a mano (id -> true). */
  protected readonly editando = signal<Record<string, boolean>>({});
  /** Cantidad elegida por lote (de los insumos en edición). */
  protected readonly valores = signal<Record<string, number>>({});

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.planLotes(this.data.loteProduccionId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (p) => {
        this.plan.set(p);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mapHttpError(e));
        this.cargando.set(false);
      }
    });
  }

  protected editar(i: PlanLotesInsumo): void {
    // Se parte de la propuesta FEFO para no empezar de cero.
    this.valores.update((v) => ({ ...v, ...Object.fromEntries(i.disponibles.map((d) => [d.loteId, 0])), ...Object.fromEntries(i.propuesta.map((p) => [p.loteId, p.cantidad])) }));
    this.editando.update((e) => ({ ...e, [i.insumoId]: true }));
  }

  protected volverAutomatico(i: PlanLotesInsumo): void {
    this.editando.update((e) => ({ ...e, [i.insumoId]: false }));
  }

  protected poner(loteId: string, valor: number | null): void {
    this.valores.update((v) => ({ ...v, [loteId]: valor === null || Number.isNaN(Number(valor)) ? 0 : Number(valor) }));
  }

  protected suma(i: PlanLotesInsumo): number {
    return Math.round(i.disponibles.reduce((s, d) => s + (this.valores()[d.loteId] ?? 0), 0) * 100) / 100;
  }

  /** Motivo por el que lo elegido de un insumo no sirve (o null). */
  protected problema(i: PlanLotesInsumo): string | null {
    if (!this.editando()[i.insumoId]) return null;
    for (const d of i.disponibles) {
      const v = this.valores()[d.loteId] ?? 0;
      if (v < 0 || Math.round(v * 100) !== v * 100 && Math.abs(Math.round(v * 100) - v * 100) > 1e-6) return 'usa hasta dos decimales';
      if (v > d.disponible) return `el lote ${d.codigo} solo tiene ${d.disponible}`;
    }
    return this.suma(i) !== i.requerido ? 'la suma debe ser exactamente lo que pide el plan' : null;
  }

  protected hayProblemas(): boolean {
    return (this.plan()?.insumos ?? []).some((i) => this.problema(i) !== null);
  }

  protected hayCambios(): boolean {
    return (this.plan()?.insumos ?? []).some((i) => this.editando()[i.insumoId]);
  }

  protected aceptar(): void {
    if (this.hayProblemas()) return;
    const insumos = (this.plan()?.insumos ?? [])
      .filter((i) => this.editando()[i.insumoId])
      .map((i) => ({
        insumoId: i.insumoId,
        lotes: i.disponibles.filter((d) => (this.valores()[d.loteId] ?? 0) > 0).map((d) => ({ loteId: d.loteId, cantidad: this.valores()[d.loteId] }))
      }));
    this.dialogRef.close(insumos.length > 0 ? { insumos } : null);
  }
}
