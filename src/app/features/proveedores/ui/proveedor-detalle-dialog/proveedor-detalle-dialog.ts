import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { BarChartComponent, BarraChart } from '../../../../shared/ui/chart/bar-chart';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { PaginadorComponent } from '../../../../shared/ui/paginador/paginador';
import { paginaCorregida } from '../../../../shared/util/paginacion';
import { HistorialZonaResponse, ProveedorAdminResponse } from '../../data-access/proveedor.models';
import { ProveedoresApi } from '../../data-access/proveedores.api';
import { PrediccionProveedor, ScoreConfianza } from '../../../calidad/data-access/calidad.models';
import { CalidadApi } from '../../../calidad/data-access/calidad.api';
import { AjustePagoResponse, PagoResponse } from '../../../pagos/data-access/pago.models';
import { PagosApi } from '../../../pagos/data-access/pagos.api';
import { PagoDetalleDialog } from '../../../pagos/ui/pago-detalle-dialog/pago-detalle-dialog';
import { HistorialProveedorDialog } from '../../../acopios/historial-proveedor-dialog';

/** El diálogo es angosto: páginas más cortas que en las tablas de pantalla completa. */
const TAMANO_PAGINA_PAGOS = 10;

export interface ProveedorDetalleDialogData {
  proveedor: ProveedorAdminResponse;
}

type Pestana = 'general' | 'zonas' | 'pagos';

/**
 * Perfil integral del proveedor (Fase 4, Bloque 5): datos generales, QR, score y predicción se cargan al
 * abrir (pestaña "General", la que se ve primero); zonas y pagos/ajustes se cargan bajo demanda, solo al
 * activar su pestaña. Entregas y análisis se acceden desde el botón "Ver historial de entregas", que
 * reutiliza HistorialProveedorDialog (features/acopios) tal cual, sin duplicar esa lista ni la consulta
 * de análisis por registro que ya expone. Un error en una pestaña no afecta a las demás.
 */
@Component({
  selector: 'app-proveedor-detalle-dialog',
  imports: [DatePipe, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent, BarChartComponent, PaginadorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="proveedor-detalle-titulo">{{ data.proveedor.nombre }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>

    <div class="tabs" role="tablist">
      <button type="button" class="tab" [class.active]="pestana() === 'general'" (click)="pestana.set('general')" role="tab">General</button>
      <button type="button" class="tab" [class.active]="pestana() === 'zonas'" (click)="activarZonas()" role="tab">Zonas</button>
      <button type="button" class="tab" [class.active]="pestana() === 'pagos'" (click)="activarPagos()" role="tab">Pagos</button>
    </div>

    <div class="dialog-body" aria-labelledby="proveedor-detalle-titulo">
      @if (pestana() === 'general') {
        <div class="detail-row"><span>DNI</span><b>{{ data.proveedor.dni }}</b></div>
        <div class="detail-row"><span>Teléfono</span><b>{{ data.proveedor.telefono ?? 'No registrado' }}</b></div>
        <div class="detail-row"><span>Zona actual</span><b>{{ data.proveedor.zonaActualNombre ?? 'Sin zona' }}</b></div>
        <div class="detail-row"><span>Estado</span><b>{{ data.proveedor.activo ? 'Activo' : 'Inactivo' }}</b></div>
        <div class="detail-row"><span>Código QR</span><b class="codigo">{{ data.proveedor.codigoQr }}</b></div>

        <button type="button" class="btn historial-btn" (click)="abrirHistorialEntregas()">Ver historial de entregas</button>

        <div class="section-head"><h2>Score de confianza</h2></div>
        @if (cargandoScore()) {
          <ui-loading-state mensaje="Cargando score…" />
        } @else if (errorScore()) {
          <ui-error-state [error]="errorScore()" (reintentar)="cargarScoreYPrediccion()" />
        } @else if (sinScore()) {
          <ui-empty-state mensaje="Aún no hay score calculado para este proveedor (histórico insuficiente)." />
        } @else if (score(); as s) {
          <div class="detail-row"><span>Score (periodo {{ s.periodo }})</span><b>{{ s.score }} / 100</b></div>
          <ui-bar-chart
            titulo="Componentes del score"
            [subtitulo]="'Periodo ' + s.periodo + ' · escala 0-100'"
            [datos]="datosComponentesScore()"
          />
        }

        <div class="section-head"><h2>Predicción de próxima entrega</h2></div>
        @if (cargandoPrediccion()) {
          <ui-loading-state mensaje="Cargando predicción…" />
        } @else if (errorPrediccion()) {
          <ui-error-state [error]="errorPrediccion()" (reintentar)="cargarScoreYPrediccion()" />
        } @else if (sinPrediccion()) {
          <ui-empty-state mensaje="Aún no hay predicción calculada para este proveedor (histórico insuficiente)." />
        } @else if (prediccion(); as p) {
          <div class="detail-row"><span>Fecha prevista</span><b>{{ p.fechaPrevista }}</b></div>
          <div class="detail-row"><span>Rango estimado</span><b>{{ p.litrosEstimadosMin }} – {{ p.litrosEstimadosMax }} L</b></div>
        }
      }

      @if (pestana() === 'zonas') {
        <div class="section-head"><h2>Historial de zona</h2></div>
        @if (cargandoZonas()) {
          <ui-loading-state mensaje="Cargando historial…" />
        } @else if (errorZonas()) {
          <ui-error-state [error]="errorZonas()" (reintentar)="cargarHistorialZona()" />
        } @else if (historialZona().length === 0) {
          <ui-empty-state mensaje="Sin cambios de zona registrados." />
        } @else {
          @for (item of historialZona(); track item.id) {
            <div class="zona-item" data-testid="zona-item">
              <div class="detail-row">
                <span>
                  {{ item.zonaNombre }}
                  @if (item.requiereRevision) { <span class="badge amber">Pendiente de revisión</span> }
                </span>
                @if (item.requiereRevision) {
                  <b>{{ item.desde }} → {{ item.hasta }}</b>
                } @else {
                  <b>{{ item.inicioEn | date: 'dd/MM/yyyy HH:mm' }} → {{ item.finEn ? (item.finEn | date: 'dd/MM/yyyy HH:mm') : 'actual' }}</b>
                }
              </div>
              <small class="meta-zona">
                @if (item.requiereRevision) {
                  {{ item.notaRevision ?? 'Periodo con fechas invertidas heredado de una versión anterior.' }}
                  No decide la zona de ninguna entrega; está en «Revisión de zonas».
                } @else {
                  @if (item.zonaOrigenNombre) { Venía de {{ item.zonaOrigenNombre }} · }
                  {{ item.motivo ?? 'Sin motivo registrado' }}{{ item.usuarioNombre ? ' · ' + item.usuarioNombre : '' }}
                }
              </small>
            </div>
          }
        }
      }

      @if (pestana() === 'pagos') {
        <div class="section-head"><h2>Historial de pagos</h2></div>
        @if (cargandoPagos()) {
          <ui-loading-state mensaje="Cargando pagos…" />
        } @else if (errorPagos()) {
          <ui-error-state [error]="errorPagos()" (reintentar)="cargarPagos()" />
        } @else if (pagos().length === 0) {
          <ui-empty-state mensaje="Este proveedor no tiene pagos registrados." />
        } @else {
          @for (pago of pagos(); track pago.id) {
            <div class="detail-row">
              <span>{{ pago.semanaInicio }} → {{ pago.semanaFin }}</span>
              <b>
                S/ {{ pago.total }}
                <button type="button" class="row-link" (click)="abrirPago(pago)">Ver detalle</button>
              </b>
            </div>
          }
          <ui-paginador
            [pagina]="paginaPagos()"
            [totalPaginas]="totalPaginasPagos()"
            [totalElementos]="totalPagos()"
            [tamano]="tamanoPagos"
            unidad="pagos"
            (cambiar)="irAPaginaPagos($event)"
          />
        }

        <div class="section-head"><h2>Ajustes pendientes de liquidación</h2></div>
        @if (cargandoAjustes()) {
          <ui-loading-state mensaje="Cargando ajustes…" />
        } @else if (errorAjustes()) {
          <ui-error-state [error]="errorAjustes()" (reintentar)="cargarAjustesPendientes()" />
        } @else if (ajustesPendientes().length === 0) {
          <ui-empty-state mensaje="Sin ajustes pendientes de liquidación." />
        } @else {
          @for (ajuste of ajustesPendientes(); track ajuste.id) {
            <div class="detail-row">
              <span>{{ ajuste.litrosDiferencia > 0 ? '+' : '' }}{{ ajuste.litrosDiferencia }} L</span>
              <b>S/ {{ ajuste.monto }} · {{ ajuste.estado }}</b>
            </div>
          }
        }
      }
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="dialogRef.close()">Cerrar</button>
    </div>
  `,
  styles: `
    .meta-zona { display: block; color: var(--color-text-muted); font-size: 0.75rem; padding: var(--space-1) 0 var(--space-2); overflow-wrap: anywhere; }
    .zona-item .badge { margin-left: var(--space-2); }
    :host {
      display: block; width: min(30rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 85vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .tabs { display: flex; gap: var(--space-1); border-bottom: 1px solid var(--color-border); margin: var(--space-4) var(--space-6) 0; }
    .tab { padding: var(--space-2) var(--space-1) var(--space-2); border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--color-text-muted); font-size: var(--font-size-sm); font-weight: 800; }
    .tab.active { color: var(--color-primary); border-bottom-color: var(--brand-500); }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .detail-row { display: flex; justify-content: space-between; gap: var(--space-3); border-bottom: 1px solid var(--color-border); padding: var(--space-3) 0; font-size: var(--font-size-sm); }
    .detail-row span { color: var(--color-text-muted); }
    .detail-row b { text-align: right; }
    .codigo { font-family: monospace; }
    .historial-btn { width: 100%; margin: var(--space-4) 0; }
    ui-bar-chart { display: block; margin-top: var(--space-3); }
    .section-head { display: flex; justify-content: space-between; align-items: baseline; margin: var(--space-5) 0 var(--space-2); }
    .section-head h2 { font-size: var(--font-size-sm); font-weight: 800; margin: 0; }
    .dialog-foot { display: flex; justify-content: flex-end; padding: 0 var(--space-6) var(--space-6); }
  `
})
export class ProveedorDetalleDialog {
  protected readonly tamanoPagos = TAMANO_PAGINA_PAGOS;
  protected readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<ProveedorDetalleDialogData>(DIALOG_DATA);
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly calidadApi = inject(CalidadApi);
  private readonly pagosApi = inject(PagosApi);
  private readonly dialog = inject(Dialog);
  private readonly destroy = inject(DestroyRef);

  protected readonly pestana = signal<Pestana>('general');

  protected readonly cargandoScore = signal(false);
  protected readonly errorScore = signal<AppError | null>(null);
  protected readonly sinScore = signal(false);
  protected readonly score = signal<ScoreConfianza | null>(null);
  protected readonly datosComponentesScore = computed<BarraChart[]>(() => {
    const s = this.score();
    if (!s) return [];
    return [
      { etiqueta: 'Calidad', valor: s.componenteCalidad },
      { etiqueta: 'Regularidad', valor: s.componenteRegularidad },
      { etiqueta: 'Anomalías', valor: s.componenteAnomalias },
    ];
  });
  protected readonly cargandoPrediccion = signal(false);
  protected readonly errorPrediccion = signal<AppError | null>(null);
  protected readonly sinPrediccion = signal(false);
  protected readonly prediccion = signal<PrediccionProveedor | null>(null);

  protected readonly cargandoZonas = signal(false);
  protected readonly errorZonas = signal<AppError | null>(null);
  protected readonly historialZona = signal<HistorialZonaResponse[]>([]);
  private zonasCargadas = false;

  protected readonly cargandoPagos = signal(false);
  protected readonly errorPagos = signal<AppError | null>(null);
  protected readonly pagos = signal<PagoResponse[]>([]);
  protected readonly paginaPagos = signal(0);
  protected readonly totalPagos = signal(0);
  protected readonly totalPaginasPagos = signal(0);
  protected readonly cargandoAjustes = signal(false);
  protected readonly errorAjustes = signal<AppError | null>(null);
  protected readonly ajustesPendientes = signal<AjustePagoResponse[]>([]);
  private pagosCargados = false;

  constructor() {
    this.cargarScoreYPrediccion();
  }

  protected activarZonas(): void {
    this.pestana.set('zonas');
    if (!this.zonasCargadas) this.cargarHistorialZona();
  }

  protected activarPagos(): void {
    this.pestana.set('pagos');
    if (!this.pagosCargados) {
      this.cargarPagos();
      this.cargarAjustesPendientes();
    }
  }

  protected cargarScoreYPrediccion(): void {
    const id = this.data.proveedor.id;

    this.cargandoScore.set(true);
    this.errorScore.set(null);
    this.sinScore.set(false);
    this.calidadApi
      .score(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (s) => {
          this.score.set(s);
          this.cargandoScore.set(false);
        },
        error: (e) => {
          this.cargandoScore.set(false);
          if (e instanceof HttpErrorResponse && e.status === 404) this.sinScore.set(true);
          else this.errorScore.set(mapHttpError(e));
        }
      });

    this.cargandoPrediccion.set(true);
    this.errorPrediccion.set(null);
    this.sinPrediccion.set(false);
    this.calidadApi
      .prediccion(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (p) => {
          this.prediccion.set(p);
          this.cargandoPrediccion.set(false);
        },
        error: (e) => {
          this.cargandoPrediccion.set(false);
          if (e instanceof HttpErrorResponse && e.status === 404) this.sinPrediccion.set(true);
          else this.errorPrediccion.set(mapHttpError(e));
        }
      });
  }

  protected cargarHistorialZona(): void {
    this.cargandoZonas.set(true);
    this.errorZonas.set(null);
    this.proveedoresApi
      .historialZona(this.data.proveedor.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (historial) => {
          this.historialZona.set(historial);
          this.cargandoZonas.set(false);
          this.zonasCargadas = true;
        },
        error: (error) => {
          this.errorZonas.set(mapHttpError(error));
          this.cargandoZonas.set(false);
        }
      });
  }

  protected cargarPagos(): void {
    this.cargandoPagos.set(true);
    this.errorPagos.set(null);
    this.pagosApi
      .historialPorProveedor(this.data.proveedor.id, { page: this.paginaPagos(), size: TAMANO_PAGINA_PAGOS })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (respuesta) => {
          const corregida = paginaCorregida(respuesta);
          if (corregida !== null) {
            this.paginaPagos.set(corregida);
            this.cargarPagos();
            return;
          }
          this.pagos.set(respuesta.contenido);
          this.totalPagos.set(respuesta.totalElementos);
          this.totalPaginasPagos.set(respuesta.totalPaginas);
          this.cargandoPagos.set(false);
          this.pagosCargados = true;
        },
        error: (error) => {
          this.errorPagos.set(mapHttpError(error));
          this.cargandoPagos.set(false);
        }
      });
  }

  protected irAPaginaPagos(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginasPagos()) return;
    this.paginaPagos.set(pagina);
    this.cargarPagos();
  }

  protected cargarAjustesPendientes(): void {
    this.cargandoAjustes.set(true);
    this.errorAjustes.set(null);
    this.pagosApi
      .ajustesPendientes(this.data.proveedor.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (ajustes) => {
          this.ajustesPendientes.set(ajustes);
          this.cargandoAjustes.set(false);
        },
        error: (error) => {
          this.errorAjustes.set(mapHttpError(error));
          this.cargandoAjustes.set(false);
        }
      });
  }

  protected abrirPago(pago: PagoResponse): void {
    // esAdmin: true es seguro aquí porque /proveedores (única ruta que abre este diálogo) ya es ADMIN-only.
    this.dialog.open(PagoDetalleDialog, {
      ariaLabel: `Detalle del pago de ${this.data.proveedor.nombre}`,
      data: { pago, esAdmin: true }
    });
  }

  protected abrirHistorialEntregas(): void {
    this.dialog.open(HistorialProveedorDialog, {
      ariaLabel: `Historial de entregas de ${this.data.proveedor.nombre}`,
      data: { proveedorId: this.data.proveedor.id, proveedorNombre: this.data.proveedor.nombre }
    });
  }
}
