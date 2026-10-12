import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { fechaHoyLima } from '../../../../shared/util/fecha';
import { ETIQUETA_MOVIMIENTO, Kardex, TipoItemKardex } from '../../data-access/kardex.models';
import { KardexApi } from '../../data-access/kardex.api';

const TAMANO_PAGINA = 50;

/** Primer día del mes actual (hora de Lima), en formato ISO yyyy-mm-dd. */
function inicioDeMes(): string {
  return `${fechaHoyLima().slice(0, 8)}01`;
}

/**
 * Kardex por cantidades de un item (leche, insumo o presentación). Solo presenta lo que calcula el backend:
 * saldo inicial del período, entradas/salidas del período completo, saldo final y, por fila, el saldo
 * acumulado real. Período por defecto: mes actual; vaciar las fechas muestra todo el historial.
 */
@Component({
  selector: 'app-kardex-vista',
  imports: [DecimalPipe, DatePipe, LoadingStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="filtros-kardex" (submit)="$event.preventDefault(); aplicar()" aria-label="Período del kardex">
      <div class="field">
        <label [for]="idBase + '-desde'">Desde</label>
        <input [id]="idBase + '-desde'" type="date" [value]="desde()" (change)="desde.set($any($event.target).value)">
      </div>
      <div class="field">
        <label [for]="idBase + '-hasta'">Hasta</label>
        <input [id]="idBase + '-hasta'" type="date" [value]="hasta()" (change)="hasta.set($any($event.target).value)">
      </div>
      <button type="submit" class="btn small">Aplicar</button>
      <button type="button" class="btn small ghost" (click)="todoElHistorial()">Todo el historial</button>
    </form>
    @if (errorFiltro()) { <p class="error" role="alert">{{ errorFiltro() }}</p> }

    @if (cargando() && !kardex()) {
      <ui-loading-state mensaje="Cargando kardex…" />
    } @else if (error()) {
      <ui-error-state [error]="error()" (reintentar)="cargar()" />
    } @else if (kardex(); as k) {
      <dl class="resumen" aria-label="Resumen del período">
        <div><dt>Saldo inicial</dt><dd>{{ k.saldoInicial | number: '1.0-2' }} {{ k.unidadMedida }}</dd></div>
        <div><dt>Entradas</dt><dd class="entrada">+{{ k.totalEntradas | number: '1.0-2' }}</dd></div>
        <div><dt>Salidas</dt><dd class="salida">−{{ k.totalSalidas | number: '1.0-2' }}</dd></div>
        <div><dt>Saldo final</dt><dd>{{ k.saldoFinal | number: '1.0-2' }} {{ k.unidadMedida }}</dd></div>
      </dl>
      <p class="nota">{{ periodo() }} · Solo cantidades (sin costos ni valorización).</p>

      @if (k.movimientos.contenido.length === 0) {
        <p class="vacio" role="status">No hay movimientos en este período.</p>
      } @else {
        <div class="tabla-scroll" [attr.aria-busy]="cargando()">
          <table class="tabla">
            <caption class="visually-hidden">Movimientos de {{ k.itemNombre }}</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Movimiento</th>
                <th scope="col">Documento</th>
                <th scope="col" class="num">Entrada</th>
                <th scope="col" class="num">Salida</th>
                <th scope="col" class="num">Saldo</th>
                <th scope="col">Usuario</th>
              </tr>
            </thead>
            <tbody>
              @for (m of k.movimientos.contenido; track m.id) {
                <tr>
                  <td class="fecha">{{ m.fecha | date: 'dd/MM/yyyy HH:mm' }}</td>
                  <td>{{ etiqueta(m.tipoMovimiento) }}</td>
                  <td>
                    {{ m.referencia ?? '—' }}
                    @if (m.documentoFecha) { <small>{{ m.documentoFecha | date: 'dd/MM/yyyy' }}</small> }
                    @if (m.motivo) { <small>Motivo: {{ m.motivo }}</small> }
                  </td>
                  <td class="num entrada">{{ m.entrada === null ? '' : (m.entrada | number: '1.0-2') }}</td>
                  <td class="num salida">{{ m.salida === null ? '' : (m.salida | number: '1.0-2') }}</td>
                  <td class="num saldo">{{ m.saldo | number: '1.0-2' }}</td>
                  <td>{{ m.usuarioNombre ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="paginacion-kardex">
          <span>Página {{ k.movimientos.paginaActual + 1 }} de {{ k.movimientos.totalPaginas }} · {{ k.movimientos.totalElementos }} movimientos</span>
          <button type="button" class="btn small" (click)="irA(-1)" [disabled]="cargando() || k.movimientos.paginaActual === 0">Anterior</button>
          <button type="button" class="btn small" (click)="irA(1)"
                  [disabled]="cargando() || k.movimientos.paginaActual + 1 >= k.movimientos.totalPaginas">Siguiente</button>
        </div>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .filtros-kardex { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-3); margin-bottom: var(--space-3); }
    .filtros-kardex .field { margin: 0; }
    .resumen { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); margin: 0; }
    .resumen dt { color: var(--color-text-muted); font-size: 0.75rem; }
    .resumen dd { margin: 0.2rem 0 0; font-weight: 800; font-size: var(--font-size-lg); }
    .entrada { color: var(--color-success); }
    .salida { color: var(--color-danger); }
    .nota, small { color: var(--color-text-muted); font-size: 0.75rem; }
    small { display: block; }
    .error { color: var(--color-danger); font-size: var(--font-size-sm); font-weight: 600; }
    .vacio { color: var(--color-text-muted); padding: var(--space-4) 0; }
    .tabla-scroll { overflow-x: auto; }
    .tabla { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
    .tabla th, .tabla td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--color-border); vertical-align: top; }
    .tabla thead th { color: var(--color-text-muted); font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
    .tabla .num { text-align: right; white-space: nowrap; }
    .tabla .saldo { font-weight: 700; }
    .tabla .fecha { white-space: nowrap; }
    .paginacion-kardex { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-3); font-size: var(--font-size-sm); }
    @media (max-width: 560px) { .resumen { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `
})
export class KardexVistaComponent implements OnInit {
  readonly tipo = input.required<TipoItemKardex>();
  readonly itemId = input<string | null>(null);

  private readonly api = inject(KardexApi);
  private readonly destroyRef = inject(DestroyRef);
  private consulta?: Subscription;

  protected readonly idBase = `kardex-${Math.random().toString(36).slice(2, 8)}`;
  protected readonly desde = signal(inicioDeMes());
  protected readonly hasta = signal(fechaHoyLima());
  protected readonly pagina = signal(0);
  protected readonly cargando = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly errorFiltro = signal<string | null>(null);
  protected readonly kardex = signal<Kardex | null>(null);

  protected readonly periodo = computed(() => {
    const k = this.kardex();
    if (!k) return '';
    if (!k.desde && !k.hasta) return 'Todo el historial';
    return `Período: ${k.desde ?? 'inicio'} a ${k.hasta ?? 'hoy'}`;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.consulta?.unsubscribe());
  }

  ngOnInit(): void {
    this.cargar();
  }

  protected etiqueta(tipo: string): string {
    return ETIQUETA_MOVIMIENTO[tipo] ?? tipo;
  }

  protected aplicar(): void {
    if (this.desde() && this.hasta() && this.desde() > this.hasta()) {
      this.errorFiltro.set('La fecha "Desde" no puede ser posterior a "Hasta".');
      return;
    }
    this.errorFiltro.set(null);
    this.pagina.set(0);
    this.cargar();
  }

  protected todoElHistorial(): void {
    this.desde.set('');
    this.hasta.set('');
    this.aplicar();
  }

  protected irA(delta: number): void {
    this.pagina.update((p) => Math.max(0, p + delta));
    this.cargar();
  }

  /** Vuelve a consultar (p. ej. después de registrar un ingreso o ajuste). */
  recargar(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.consulta?.unsubscribe(); // una respuesta vieja nunca pisa a una nueva
    this.cargando.set(true);
    this.error.set(null);
    this.consulta = this.api
      .kardex(this.tipo(), this.itemId(), {
        desde: this.desde() || undefined,
        hasta: this.hasta() || undefined,
        page: this.pagina(),
        size: TAMANO_PAGINA
      })
      .subscribe({
        next: (k) => {
          this.kardex.set(k);
          this.cargando.set(false);
        },
        error: (e) => {
          this.error.set(mapHttpError(e));
          this.cargando.set(false);
        }
      });
  }
}
