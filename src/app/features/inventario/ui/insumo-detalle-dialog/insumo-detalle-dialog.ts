import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormsModule } from '@angular/forms';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { InsumoResponse } from '../../../catalogos/data-access/insumo.models';
import { LotesInsumoApi } from '../../data-access/lotes.api';
import { ETIQUETA_ESTADO_LOTE, LoteInsumoResponse } from '../../data-access/lotes.models';
import { KardexVistaComponent } from '../kardex-vista/kardex-vista';
import { ExportarExcelComponent } from '../../../../shared/ui/exportar-excel/exportar-excel';

export interface InsumoDetalleDialogData {
  insumo: InsumoResponse;
  /** Pestaña con la que abre. */
  pestana?: 'kardex' | 'lotes';
  /** ADMIN puede anular un ingreso no usado. */
  esAdmin?: boolean;
}

/**
 * Detalle de un insumo en un solo modal: Kardex (con lote, proveedor y vencimiento en cada fila, y filtro por lote) y Lotes (código,
 * proveedor, ingreso, vencimiento, cantidad inicial y disponible, y estado: vigente, por vencer, vencido o agotado).
 */
@Component({
  selector: 'app-insumo-detalle-dialog',
  imports: [DatePipe, DecimalPipe, FormsModule, KardexVistaComponent, ExportarExcelComponent, LoadingStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <div>
        <h2 id="detalle-titulo">{{ data.insumo.nombre }}</h2>
        <p class="sub">Insumo, en {{ data.insumo.unidadMedida }}</p>
      </div>
      <button type="button" class="close" (click)="dialogRef.close(huboCambios())" aria-label="Cerrar">×</button>
    </div>
    <div class="tabs" role="tablist" aria-label="Detalle del insumo">
      <button type="button" class="tab" role="tab" [class.active]="pestana() === 'kardex'" [attr.aria-selected]="pestana() === 'kardex'" (click)="pestana.set('kardex')">Kardex</button>
      <button type="button" class="tab" role="tab" [class.active]="pestana() === 'lotes'" [attr.aria-selected]="pestana() === 'lotes'" (click)="pestana.set('lotes')">Lotes</button>
    </div>
    <div class="dialog-body" aria-labelledby="detalle-titulo">
      @if (pestana() === 'kardex') {
        <app-kardex-vista tipo="INSUMO" [itemId]="data.insumo.id" [lotes]="lotes()" />
      } @else {
        @if (cargando()) {
          <ui-loading-state mensaje="Cargando lotes…" />
        } @else if (error()) {
          <ui-error-state [error]="error()" (reintentar)="cargar()" />
        } @else if (lotes().length === 0) {
          <p class="vacio" role="status">Este insumo todavía no tiene lotes.</p>
        } @else {
          <div class="barra-lotes"><ui-exportar-excel recurso="lotes-insumo" [filtro]="{ insumoId: data.insumo.id }" /></div>
          <div class="tabla-scroll">
            <table class="tabla">
              <caption class="visually-hidden">Lotes de {{ data.insumo.nombre }}</caption>
              <thead>
                <tr>
                  <th scope="col">Lote</th><th scope="col">Proveedor</th><th scope="col">Ingreso</th><th scope="col">Vence</th>
                  <th scope="col" class="num">Inicial</th><th scope="col" class="num">Disponible</th><th scope="col">Estado</th>
                  @if (data.esAdmin) { <th scope="col"></th> }
                </tr>
              </thead>
              <tbody>
                @for (l of lotes(); track l.id) {
                  <tr>
                    <td><strong>{{ l.codigo }}</strong>@if (l.codigoProveedor) { <small>Proveedor: {{ l.codigoProveedor }}</small> }</td>
                    <td>{{ l.proveedorNombre ?? '—' }}@if (l.numeroDocumento) { <small>{{ l.numeroDocumento }}</small> }</td>
                    <td class="fecha">{{ l.fechaIngreso | date: 'dd/MM/yyyy' }}</td>
                    <td class="fecha">{{ l.fechaVencimiento ? (l.fechaVencimiento | date: 'dd/MM/yyyy') : '—' }}@if (l.diasParaVencer !== null && l.estado !== 'AGOTADO') { <small>{{ l.diasParaVencer < 0 ? 'venció hace ' + (-l.diasParaVencer) + ' d' : 'en ' + l.diasParaVencer + ' d' }}</small> }</td>
                    <td class="num">{{ l.cantidadInicial | number: '1.0-2' }}</td>
                    <td class="num">{{ l.cantidadDisponible | number: '1.0-2' }}</td>
                    <td><span class="estado" [attr.data-estado]="l.estado">{{ etiqueta(l) }}</span></td>
                    @if (data.esAdmin) {
                      <td>@if (puedeAnular(l)) { <button type="button" class="btn small" (click)="anulando.set(l)">Anular ingreso</button> }</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @if (anulando(); as l) {
          <form class="anular" (ngSubmit)="anular(l)" role="group" [attr.aria-label]="'Anular el ingreso del lote ' + l.codigo">
            <p>Se reversa el lote <strong>{{ l.codigo }}</strong> ({{ l.cantidadInicial | number: '1.0-2' }} {{ data.insumo.unidadMedida }}) con un movimiento de anulación; el ingreso queda en el kardex. Solo vale si el lote no se usó.</p>
            <label for="anular-motivo">Motivo (obligatorio)</label>
            <textarea id="anular-motivo" rows="2" maxlength="500" name="motivo" [ngModel]="motivo()" (ngModelChange)="motivo.set($event)"></textarea>
            @if (errorAnular()) { <p class="server-error" role="alert">{{ errorAnular() }}</p> }
            <div class="acciones">
              <button type="button" class="btn small" (click)="anulando.set(null)">Cancelar</button>
              <button type="submit" class="btn primary small" [disabled]="!motivo().trim() || enviando()">{{ enviando() ? 'Anulando…' : 'Anular ingreso' }}</button>
            </div>
          </form>
        }
      }
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="dialogRef.close(huboCambios())">Cerrar</button>
    </div>
  `,
  styles: `
    :host { display: block; width: min(64rem, 100%); background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto; }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .sub { color: var(--color-text-muted); font-size: var(--font-size-sm); margin: 0.25rem 0 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .tabs { display: flex; gap: var(--space-2); padding: var(--space-4) var(--space-6) 0; border-bottom: 1px solid var(--color-border); }
    .tab { border: 0; background: transparent; padding: 0.5rem 1rem; font: inherit; font-weight: 600; cursor: pointer; border-bottom: 3px solid transparent; }
    .tab.active { border-bottom-color: var(--color-primary, #145a3c); }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .dialog-foot { display: flex; justify-content: flex-end; padding: 0 var(--space-6) var(--space-6); }
    .barra-lotes { display: flex; justify-content: flex-end; margin-bottom: var(--space-2); }
    .tabla-scroll { overflow-x: auto; }
    .tabla { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
    .tabla th, .tabla td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--color-border); vertical-align: top; }
    .tabla thead th { color: var(--color-text-muted); font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
    .tabla .num { text-align: right; white-space: nowrap; }
    .tabla .fecha { white-space: nowrap; }
    small { display: block; color: var(--color-text-muted); font-size: 0.7rem; }
    .estado { display: inline-block; border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.75rem; font-weight: 700; border: 1px solid var(--color-border); }
    .estado[data-estado='POR_VENCER'] { color: var(--color-warning); border-color: var(--color-warning); }
    .estado[data-estado='VENCIDO'] { color: var(--color-danger); border-color: var(--color-danger); }
    .estado[data-estado='AGOTADO'] { color: var(--color-text-muted); }
    .estado[data-estado='VIGENTE'] { color: var(--color-success); border-color: var(--color-success); }
    .vacio { color: var(--color-text-muted); }
    .anular { border: 1px dashed var(--color-border); border-radius: var(--radius-control); padding: var(--space-3); margin-top: var(--space-4); }
    .anular textarea { width: 100%; }
    .acciones { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-2); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); }
  `
})
export class InsumoDetalleDialog {
  protected readonly dialogRef = inject(DialogRef<boolean>);
  protected readonly data = inject<InsumoDetalleDialogData>(DIALOG_DATA);
  private readonly api = inject(LotesInsumoApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pestana = signal<'kardex' | 'lotes'>(this.data.pestana ?? 'kardex');
  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly lotes = signal<LoteInsumoResponse[]>([]);
  protected readonly anulando = signal<LoteInsumoResponse | null>(null);
  protected readonly motivo = signal('');
  protected readonly enviando = signal(false);
  protected readonly errorAnular = signal<string | null>(null);
  /** true si se anuló algo: la lista de insumos debe recargarse al cerrar. */
  protected readonly huboCambios = signal(false);
  private readonly kardex = viewChild(KardexVistaComponent);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.listar(this.data.insumo.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (l) => {
        this.lotes.set(l);
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

  /** Un ingreso sin usar (disponible = inicial) que no es el lote de arrastre. */
  protected puedeAnular(l: LoteInsumoResponse): boolean {
    return l.codigo !== 'INICIAL' && l.cantidadInicial > 0 && l.cantidadDisponible === l.cantidadInicial;
  }

  protected anular(l: LoteInsumoResponse): void {
    if (this.enviando() || !this.motivo().trim()) return;
    this.enviando.set(true);
    this.errorAnular.set(null);
    this.api.anular(l.id, this.motivo().trim()).subscribe({
      next: () => {
        this.enviando.set(false);
        this.anulando.set(null);
        this.motivo.set('');
        this.huboCambios.set(true);
        this.cargar();
        this.kardex()?.recargar();
      },
      error: (e) => {
        this.enviando.set(false);
        this.errorAnular.set(mapHttpError(e).mensaje);
      }
    });
  }
}
