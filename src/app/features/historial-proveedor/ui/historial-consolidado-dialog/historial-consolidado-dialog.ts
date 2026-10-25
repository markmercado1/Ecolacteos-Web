import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Subscription } from 'rxjs';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { PaginadorComponent } from '../../../../shared/ui/paginador/paginador';
import { paginaCorregida } from '../../../../shared/util/paginacion';
import { HistorialApi } from '../../data-access/historial.api';
import { HistorialEntregaResponse, HistorialResumenResponse, tieneSeccion } from '../../data-access/historial.models';

export interface HistorialConsolidadoDialogData {
  proveedorId: string;
  proveedorNombre: string;
}

const TAMANO_PAGINA = 10;

/**
 * Historial consolidado de un proveedor (Fase D), solo lectura: entregas con su zona de ese momento, calidad y liquidación, y los totales de lo
 * recibido, liquidado, pagado y por pagar. Cada rol recibe SOLO sus secciones del servidor (CALIDAD: calidad; RECEPCION: pagos; ADMIN: todo y
 * las zonas); el panel solo muestra lo que llega y no calcula ningún total.
 */
@Component({
  selector: 'app-historial-consolidado-dialog',
  imports: [DatePipe, DecimalPipe, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent, PaginadorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <div>
        <div class="eyebrow">HISTORIAL CONSOLIDADO</div>
        <h2 id="historial-consolidado-titulo">{{ data.proveedorNombre }}</h2>
        @if (resumen(); as r) {
          <small class="zona-actual">Zona actual: {{ r.zonaActualNombre ?? 'sin zona' }}</small>
        }
      </div>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar historial">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="historial-consolidado-titulo">
      @if (cargandoResumen()) {
        <ui-loading-state mensaje="Cargando resumen…" />
      } @else if (errorResumen()) {
        <ui-error-state [error]="errorResumen()" (reintentar)="cargarResumen()" />
      } @else if (resumen(); as r) {
        @if (r.entregas; as e) {
          <section class="bloque" data-testid="seccion-entregas">
            <h3>Entregas</h3>
            <div class="cifras">
              <div><span>Entregas</span><b data-testid="entregas-total">{{ e.total }}</b></div>
              <div><span>Litros recibidos</span><b>{{ e.litrosRecibidos | number: '1.2-2' }} L</b></div>
              <div><span>Litros efectivos</span><b>{{ e.litrosEfectivos | number: '1.2-2' }} L</b></div>
              <div><span>Corregidas</span><b>{{ e.conCorreccion }}</b></div>
              <div><span>Sin zona</span><b>{{ e.sinZona }}</b></div>
            </div>
            @if (e.primeraEntrega) {
              <small class="meta">Del {{ e.primeraEntrega | date: 'dd/MM/yyyy' }} al {{ e.ultimaEntrega | date: 'dd/MM/yyyy' }}</small>
            }
          </section>
        }
        @if (r.calidad; as c) {
          <section class="bloque" data-testid="seccion-calidad">
            <h3>Calidad</h3>
            <div class="cifras">
              <div><span>Analizadas</span><b>{{ c.analizadas }}</b></div>
              <div><span>Sin análisis</span><b>{{ c.sinAnalisis }}</b></div>
              <div><span>Aprobadas</span><b>{{ c.aprobadas }}</b></div>
              <div><span>Observadas</span><b>{{ c.observadas }}</b></div>
              <div><span>Rechazadas</span><b>{{ c.rechazadas }}</b></div>
              <div><span>Alertas</span><b>{{ c.alertas }}</b></div>
              <div><span>Con precio de calidad</span><b>{{ c.conPrecioDeCalidad }}</b></div>
            </div>
            <small class="meta">Se cuenta el resultado del último análisis de cada entrega.</small>
          </section>
        }
        @if (r.pagos; as p) {
          <section class="bloque" data-testid="seccion-pagos">
            <h3>Liquidaciones y pagos</h3>
            <div class="filas">
              <div class="fila"><span>Liquidaciones</span><b>{{ p.liquidaciones }}</b></div>
              <div class="fila"><span>Litros liquidados</span><b>{{ p.litrosLiquidados | number: '1.2-2' }} L</b></div>
              <div class="fila"><span>Total original</span><b>S/ {{ p.totalOriginal | number: '1.2-2' }}</b></div>
              <div class="fila"><span>Ajuste por precios de calidad</span><b>{{ signo(p.ajusteCalidad) }}S/ {{ absoluto(p.ajusteCalidad) | number: '1.2-2' }}</b></div>
              <div class="fila"><span>Total a pagar (reconocido)</span><b>S/ {{ p.totalReconocido | number: '1.2-2' }}</b></div>
              <div class="fila"><span>Ajustes de litros posteriores</span><b>{{ signo(p.ajustesLitros) }}S/ {{ absoluto(p.ajustesLitros) | number: '1.2-2' }}</b></div>
              <div class="fila"><span>Total con ajustes</span><b>S/ {{ p.totalConAjustes | number: '1.2-2' }}</b></div>
              <div class="fila"><span>Pagado (aplicado)</span><b>S/ {{ p.pagado | number: '1.2-2' }}</b></div>
              <div class="fila"><span>Saldo de las liquidaciones</span><b>{{ p.saldoLiquidaciones < 0 ? '−' : '' }}S/ {{ absoluto(p.saldoLiquidaciones) | number: '1.2-2' }}</b></div>
              <div class="fila"><span>Adelantos sin aplicar</span><b>S/ {{ p.adelantosSinAplicar | number: '1.2-2' }}</b></div>
              <div class="fila total" data-testid="saldo-neto">
                <span>{{ p.saldoNeto < 0 ? 'Saldo neto a favor del proveedor' : 'Saldo neto por pagar' }}</span>
                <b>S/ {{ absoluto(p.saldoNeto) | number: '1.2-2' }}</b>
              </div>
            </div>
            @if (p.entregasSinLiquidar > 0) {
              <small class="meta" data-testid="sin-liquidar">
                {{ p.entregasSinLiquidar }} entrega(s) todavía sin liquidar ({{ p.litrosSinLiquidar | number: '1.2-2' }} L): no están en estos totales.
              </small>
            }
          </section>
        }
        @if (r.compras; as c) {
          <section class="bloque" data-testid="seccion-compras">
            <h3>Compras como comprador</h3>
            <p>{{ c.totalCompras }} compras por S/ {{ c.montoTotal | number: '1.2-2' }} · en {{ c.anio }}: {{ c.comprasAnio }} (S/ {{ c.montoAnio | number: '1.2-2' }})
              @if (c.ultimaCompra) { · última {{ c.ultimaCompra | date: 'dd/MM/yyyy' }} }</p>
            <small>Ventas en las que se eligió a este proveedor como comprador; no se descuentan de sus liquidaciones de leche.</small>
          </section>
        }
        @if (r.zonas; as zonas) {
          <section class="bloque" data-testid="seccion-zonas">
            <h3>Movimientos de zona</h3>
            @for (z of zonas; track z.id) {
              <div class="zona" data-testid="zona-item">
                <span>{{ z.zonaNombre }}</span>
                <small>
                  {{ z.inicioEn | date: 'dd/MM/yyyy HH:mm' }} → {{ z.finEn ? (z.finEn | date: 'dd/MM/yyyy HH:mm') : 'actual' }}
                  @if (z.requiereRevision) { · <b>pendiente de revisión</b> }
                </small>
              </div>
            }
          </section>
        }

        <section class="bloque">
          <h3>Entregas</h3>
          @if (cargandoEntregas()) {
            <ui-loading-state mensaje="Cargando entregas…" />
          } @else if (errorEntregas()) {
            <ui-error-state [error]="errorEntregas()" (reintentar)="cargarEntregas()" />
          } @else if (entregas().length === 0) {
            <ui-empty-state mensaje="Este proveedor no tiene entregas registradas." />
          } @else {
            <div class="tabla-scroll">
              <table class="tabla">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Zona</th>
                    <th class="fin">Litros</th>
                    @if (conCalidad()) { <th>Calidad</th> }
                    @if (conPagos()) { <th>Liquidación</th> }
                  </tr>
                </thead>
                <tbody>
                  @for (f of entregas(); track f.id) {
                    <tr data-testid="entrega">
                      <td>{{ f.fechaHora | date: 'dd/MM/yyyy HH:mm' }}</td>
                      <td>
                        @if (f.zonaNombre) { {{ f.zonaNombre }} } @else { <span class="badge amber" title="No se pudo determinar la zona de esta entrega">Sin zona</span> }
                      </td>
                      <td class="fin">
                        {{ f.litrosEfectivos | number: '1.2-2' }} L
                        @if (f.corregida) {
                          <span class="badge blue" title="Se corrigió la cantidad recibida">Corregida</span>
                          <small class="sub">recibido {{ f.litrosOriginales | number: '1.2-2' }} L</small>
                        }
                      </td>
                      @if (conCalidad()) {
                        <td>
                          @if (f.calidad; as c) {
                            @if (c.resultado) { <span class="badge" [class.amber]="c.resultado !== 'APROBADO'">{{ c.resultado }}</span> } @else { <span class="sub">Sin análisis</span> }
                            @if (c.alertas > 0) { <span class="badge amber">{{ c.alertas }} alerta(s)</span> }
                            @if (c.precioPropio) { <span class="badge blue">Precio propio</span> }
                          }
                        </td>
                      }
                      @if (conPagos()) {
                        <td>
                          @if (f.liquidacion; as l) {
                            {{ l.semanaInicio }} → {{ l.semanaFin }}
                            <small class="sub">{{ l.litrosLiquidados | number: '1.2-2' }} L × S/ {{ l.precioAplicado | number: '1.2-3' }} = S/ {{ l.importe | number: '1.2-2' }}</small>
                          } @else {
                            <span class="sub">Sin liquidar</span>
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <ui-paginador [pagina]="pagina()" [totalPaginas]="totalPaginas()" [totalElementos]="totalElementos()" [tamano]="tamano" unidad="entregas" (cambiar)="irAPagina($event)" />
          }
        </section>
      }
    </div>
  `,
  styles: `
    :host {
      display: block; width: min(60rem, 100%); max-height: 92vh; overflow-y: auto; background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay);
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .zona-actual { color: var(--color-text-muted); }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6) var(--space-6); display: grid; gap: var(--space-4); }
    .bloque { border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-4); }
    .bloque h3 { font-size: var(--font-size-sm); font-weight: 800; margin: 0 0 var(--space-3); }
    .cifras { display: grid; grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr)); gap: var(--space-3); }
    .cifras div { display: grid; gap: var(--space-1); }
    .cifras span, .meta, .sub { color: var(--color-text-muted); font-size: 0.75rem; }
    .meta { display: block; margin-top: var(--space-2); }
    .sub { display: block; }
    .filas .fila { display: flex; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border); font-size: var(--font-size-sm); }
    .filas .fila.total { font-size: var(--font-size-base); border-bottom: 0; }
    .zona { display: flex; justify-content: space-between; gap: var(--space-3); padding: var(--space-1) 0; font-size: var(--font-size-sm); }
    .tabla-scroll { overflow-x: auto; }
    .tabla { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
    .tabla th, .tabla td { text-align: left; padding: var(--space-2); border-bottom: 1px solid var(--color-border); vertical-align: top; }
    .tabla .fin { text-align: right; }
  `
})
export class HistorialConsolidadoDialog {
  protected readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<HistorialConsolidadoDialogData>(DIALOG_DATA);
  private readonly api = inject(HistorialApi);
  private readonly destroy = inject(DestroyRef);

  protected readonly tamano = TAMANO_PAGINA;
  protected readonly cargandoResumen = signal(true);
  protected readonly errorResumen = signal<AppError | null>(null);
  protected readonly resumen = signal<HistorialResumenResponse | null>(null);
  protected readonly conCalidad = computed(() => tieneSeccion(this.resumen(), 'CALIDAD'));
  protected readonly conPagos = computed(() => tieneSeccion(this.resumen(), 'PAGOS'));

  protected readonly cargandoEntregas = signal(false);
  protected readonly errorEntregas = signal<AppError | null>(null);
  protected readonly entregas = signal<HistorialEntregaResponse[]>([]);
  protected readonly pagina = signal(0);
  protected readonly totalPaginas = signal(0);
  protected readonly totalElementos = signal(0);
  private peticion?: Subscription;

  constructor() {
    this.cargarResumen();
  }

  protected cargarResumen(): void {
    this.cargandoResumen.set(true);
    this.errorResumen.set(null);
    this.api.resumen(this.data.proveedorId).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (resumen) => {
        this.resumen.set(resumen);
        this.cargandoResumen.set(false);
        this.cargarEntregas();
      },
      error: (error) => {
        this.errorResumen.set(mapHttpError(error));
        this.cargandoResumen.set(false);
      }
    });
  }

  protected cargarEntregas(): void {
    this.peticion?.unsubscribe();
    this.cargandoEntregas.set(true);
    this.errorEntregas.set(null);
    this.peticion = this.api.entregas(this.data.proveedorId, { page: this.pagina(), size: TAMANO_PAGINA }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (respuesta) => {
        const corregida = paginaCorregida(respuesta);
        if (corregida !== null) {
          this.pagina.set(corregida);
          this.cargarEntregas();
          return;
        }
        this.entregas.set(respuesta.contenido);
        this.totalElementos.set(respuesta.totalElementos);
        this.totalPaginas.set(respuesta.totalPaginas);
        this.cargandoEntregas.set(false);
      },
      error: (error) => {
        this.errorEntregas.set(mapHttpError(error));
        this.cargandoEntregas.set(false);
      }
    });
  }

  protected irAPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginas()) return;
    this.pagina.set(pagina);
    this.cargarEntregas();
  }

  protected signo(n: number): string {
    return n < 0 ? '−' : n > 0 ? '+' : '';
  }

  protected absoluto(n: number): number {
    return Math.abs(n);
  }
}
