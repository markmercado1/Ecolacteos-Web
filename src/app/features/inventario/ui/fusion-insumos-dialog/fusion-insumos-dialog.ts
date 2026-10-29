import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DialogRef } from '@angular/cdk/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { FusionInsumosApi } from '../../../catalogos/data-access/fusion-insumos.api';
import { DuplicadosInsumoResponse, FusionInsumoResponse, GrupoDuplicados, VistaPreviaFusion } from '../../../catalogos/data-access/fusion-insumos.models';

/**
 * Fusión de insumos duplicados (solo ADMIN). Por cada grupo (mismo nombre sin mayúsculas ni tildes) se elige el insumo que
 * se CONSERVA; cada uno de los demás se revisa en una vista previa (qué historial pasa, qué stock queda, qué lo impide) y
 * solo entonces se confirma. No se borra nada: el insumo fusionado queda inactivo y la fusión queda auditada.
 */
@Component({
  selector: 'app-fusion-insumos-dialog',
  imports: [DecimalPipe, LoadingStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <div>
        <h2 id="fusion-titulo">Insumos duplicados</h2>
        <p class="sub">Dos insumos con el mismo nombre (sin mayúsculas ni tildes) parten su stock y su kardex. Fusiónalos sin perder historial.</p>
      </div>
      <button type="button" class="close" (click)="cerrar()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="fusion-titulo">
      @if (cargando()) {
        <ui-loading-state mensaje="Buscando duplicados…" />
      } @else if (error()) {
        <ui-error-state [error]="error()" (reintentar)="cargar()" />
      } @else if (datos(); as d) {
        @if (d.grupos.length === 0) {
          <p class="vacio" role="status">No hay insumos duplicados.</p>
        }
        @for (g of d.grupos; track g.clave) {
          <section class="grupo" [attr.aria-label]="'Duplicados de ' + g.clave">
            <p class="instruccion">Elige el insumo que <strong>se conserva</strong>; los demás se fusionan en él.</p>
            @for (i of g.insumos; track i.id) {
              <div class="insumo" [class.conservar]="destino(g) === i.id">
                <label>
                  <input type="radio" [name]="'destino-' + g.clave" [checked]="destino(g) === i.id" (change)="elegirDestino(g, i.id)">
                  <strong>{{ i.nombre }}</strong>
                  <span class="meta">{{ i.stock | number: '1.0-2' }} {{ i.unidadMedida }} · {{ i.movimientos }} movimientos{{ i.activo ? '' : ' · desactivado' }}</span>
                </label>
                @if (destino(g) !== i.id) {
                  <button type="button" class="btn small" [disabled]="ocupado()" (click)="revisar(g, i.id)">Revisar fusión</button>
                } @else {
                  <span class="etiqueta">Se conserva</span>
                }
              </div>
              @if (vista()[i.id]; as v) {
                <div class="vista" role="group" [attr.aria-label]="'Vista previa de fusionar ' + v.origenNombre">
                  <p>
                    «{{ v.origenNombre }}» → «{{ v.destinoNombre }}»: pasan {{ v.movimientos }} movimientos, {{ v.retiros }} retiros,
                    {{ v.recetas }} recetas y {{ v.lotesProduccion }} lotes de producción. Stock resultante:
                    <strong>{{ v.stockResultante | number: '1.0-2' }} {{ v.unidadMedida }}</strong>
                    ({{ v.stockOrigen | number: '1.0-2' }} + {{ v.stockDestino | number: '1.0-2' }}).
                  </p>
                  @if (!v.fusionable) {
                    <ul class="impedimentos">
                      @for (m of v.impedimentos; track m) { <li>{{ m }}</li> }
                    </ul>
                  } @else {
                    <p class="hint">«{{ v.origenNombre }}» quedará desactivado, con stock 0. No se borra nada y la fusión queda auditada.</p>
                    <button type="button" class="btn primary small" [disabled]="ocupado()" (click)="confirmar(v)">
                      {{ ocupado() ? 'Fusionando…' : 'Confirmar fusión' }}
                    </button>
                  }
                </div>
              }
            }
          </section>
        }
        @if (d.grupos.length === 0 && d.indiceUnicoActivo) {
          <p class="hint">La base de datos ya impide crear insumos con el mismo nombre.</p>
        }
      }
      @if (errorAccion()) { <p class="server-error" role="alert">{{ errorAccion() }}</p> }
      @if (hechas().length > 0) {
        <ul class="hechas" aria-label="Fusiones realizadas">
          @for (h of hechas(); track h.id) {
            <li>Fusionado «{{ h.origenNombre }}» en «{{ h.destinoNombre }}»: stock {{ h.stockDestinoDespues | number: '1.0-2' }} {{ h.unidadMedida }}.</li>
          }
        </ul>
      }
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="cerrar()">Cerrar</button>
    </div>
  `,
  styles: `
    :host { display: block; width: min(44rem, 100%); background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto; }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .sub { color: var(--color-text-muted); font-size: var(--font-size-sm); margin: 0.25rem 0 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; flex-shrink: 0; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .dialog-foot { display: flex; justify-content: flex-end; padding: 0 var(--space-6) var(--space-6); }
    .grupo { border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-3); margin-bottom: var(--space-4); }
    .instruccion { margin: 0 0 var(--space-2); font-size: var(--font-size-sm); }
    .insumo { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); padding: var(--space-2); border-radius: var(--radius-control); }
    .insumo.conservar { background: var(--color-success-bg, rgba(0, 128, 0, 0.08)); }
    .insumo label { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2); }
    .meta { color: var(--color-text-muted); font-size: 0.75rem; }
    .etiqueta { font-size: 0.75rem; font-weight: 700; color: var(--color-success); }
    .vista { margin: 0 0 var(--space-3) var(--space-6); padding: var(--space-3); background: var(--color-surface-alt, rgba(0,0,0,0.03)); border-radius: var(--radius-control); font-size: var(--font-size-sm); }
    .vista p { margin: 0 0 var(--space-2); }
    .impedimentos { color: var(--color-danger); margin: 0; padding-left: 1.2rem; font-weight: 600; }
    .hint, .vacio { color: var(--color-text-muted); font-size: 0.75rem; }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); }
    .hechas { color: var(--color-success); font-size: var(--font-size-sm); padding-left: 1.2rem; }
  `
})
export class FusionInsumosDialog {
  protected readonly dialogRef = inject(DialogRef<boolean>);
  private readonly api = inject(FusionInsumosApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly datos = signal<DuplicadosInsumoResponse | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly ocupado = signal(false);
  /** Insumo que se conserva por grupo (clave -> id). Por defecto el que tiene más movimientos. */
  private readonly destinos = signal<Record<string, string>>({});
  /** Vista previa por insumo de origen (id -> vista). */
  protected readonly vista = signal<Record<string, VistaPreviaFusion>>({});
  protected readonly hechas = signal<FusionInsumoResponse[]>([]);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.duplicados().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        const destinos: Record<string, string> = {};
        for (const g of d.grupos) {
          destinos[g.clave] = [...g.insumos].sort((a, b) => b.movimientos - a.movimientos)[0].id;
        }
        this.destinos.set(destinos);
        this.vista.set({});
        this.datos.set(d);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mapHttpError(e));
        this.cargando.set(false);
      }
    });
  }

  protected destino(g: GrupoDuplicados): string | undefined {
    return this.destinos()[g.clave];
  }

  protected elegirDestino(g: GrupoDuplicados, id: string): void {
    this.destinos.update((d) => ({ ...d, [g.clave]: id }));
    this.vista.set({});
    this.errorAccion.set(null);
  }

  protected revisar(g: GrupoDuplicados, origenId: string): void {
    const destinoId = this.destino(g);
    if (!destinoId || this.ocupado()) return;
    this.errorAccion.set(null);
    this.api.vistaPrevia(origenId, destinoId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (v) => this.vista.update((m) => ({ ...m, [origenId]: v })),
      error: (e) => this.errorAccion.set(mapHttpError(e).mensaje)
    });
  }

  protected confirmar(v: VistaPreviaFusion): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.api.fusionar(v.origenId, v.destinoId).subscribe({
      next: (r) => {
        this.ocupado.set(false);
        this.hechas.update((h) => [...h, r]);
        this.cargar();
      },
      error: (e) => {
        this.ocupado.set(false);
        this.errorAccion.set(mapHttpError(e).mensaje);
      }
    });
  }

  /** Devuelve true si se fusionó algo, para que la lista de insumos se recargue. */
  protected cerrar(): void {
    this.dialogRef.close(this.hechas().length > 0);
  }
}
