import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { Subscription, catchError, forkJoin, map, of } from 'rxjs';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { BarChartComponent, BarraChart } from '../../../../shared/ui/chart/bar-chart';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ZonaResponse } from '../../../catalogos/data-access/zona.models';
import { ZonasApi } from '../../../catalogos/data-access/zonas.api';
import { PanelEconomico } from '../../../calidad/data-access/calidad.models';
import { CalidadApi } from '../../../calidad/data-access/calidad.api';
import { ResultadoZonaPanel, clasificarErrorPanel, consolidar } from '../../util/panel-consolidado';

const ETIQUETAS_CANAL: Record<string, string> = {
  MAYORISTA: 'Mayorista',
  PROVEEDOR: 'Proveedor',
  PUBLICO: 'Público',
};

/** Valor del selector para la vista consolidada de todas las zonas (vista inicial). */
export const TODAS_LAS_ZONAS = 'todas';

/**
 * Panel económico (Fase 4, Bloque 6), ruta ADMIN-only (igual que `GET /api/innovacion/panel-economico`,
 * `hasRole('ADMIN')`).
 *
 * Vista inicial = CONSOLIDADO de todas las zonas activas. El backend no tiene un endpoint consolidado, así que se
 * pide el panel de cada zona activa en paralelo y se suma en el cliente (`util/panel-consolidado.ts`). Elegir una
 * zona muestra su detalle, que sigue siendo UNA sola llamada por zona (PanelEconomicoService.construirPanel).
 *
 * Limitación real del backend, no inventada: si la zona no tiene todavía una proyección semanal
 * calculada, `ForecastingService.obtenerUltima` lanza un 404 que `PanelEconomicoService` no captura —
 * el endpoint completo responde 404, no solo el campo de proyección. Por eso, cuando el 404 indica
 * específicamente ausencia de proyección (mensaje real del servidor), esta página no puede mostrar NINGÚN
 * indicador de esa zona, ni siquiera los que no dependen del forecast (riesgo valorizado, simulación) —
 * ver "BACKEND NECESARIO" en docs/REGISTRO.md. En el consolidado esas zonas se listan como «Sin proyección» y no
 * entran en las sumas. Otros 404 (p. ej. zona inexistente) y cualquier otro código HTTP se muestran como error
 * real, nunca como "sin proyección".
 */
@Component({
  selector: 'app-panel-page',
  imports: [BarChartComponent, DataTableComponent, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel-page.html',
  styleUrl: './panel-page.css',
})
export class PanelPage {
  private readonly calidadApi = inject(CalidadApi);
  private readonly zonasApi = inject(ZonasApi);
  private readonly destroy = inject(DestroyRef);

  protected readonly TODAS = TODAS_LAS_ZONAS;

  protected readonly zonas = signal<ZonaResponse[]>([]);
  protected readonly errorZonas = signal(false);
  protected readonly zonaSeleccionada = signal(TODAS_LAS_ZONAS);
  protected readonly esConsolidado = computed(() => this.zonaSeleccionada() === TODAS_LAS_ZONAS);
  protected readonly zonaNombre = computed(
    () => this.zonas().find((z) => z.id === this.zonaSeleccionada())?.nombre ?? '',
  );

  // --- Detalle de una zona ---
  protected readonly cargando = signal(false);
  protected readonly error = signal<AppError | null>(null);
  /** 404 específicamente por falta de proyección semanal para la zona (mensaje real del servidor). */
  protected readonly sinProyeccion = signal(false);
  protected readonly panel = signal<PanelEconomico | null>(null);

  protected readonly datosVentasCanal = computed<BarraChart[]>(() => this.aBarras(this.panel()?.margenPorCanal ?? []));

  // --- Consolidado de todas las zonas ---
  protected readonly cargandoConsolidado = signal(false);
  protected readonly resultados = signal<ResultadoZonaPanel[]>([]);
  private peticionConsolidado?: Subscription;

  protected readonly consolidado = computed(() => consolidar(this.resultados()));
  protected readonly sinZonasActivas = computed(
    () => this.zonas().length > 0 && this.zonas().every((z) => !z.activa),
  );
  protected readonly datosVentasConsolidado = computed<BarraChart[]>(() => this.aBarras(this.consolidado().margenPorCanal));
  protected readonly columnasZonas: ColumnaTabla[] = [
    { clave: 'zona', etiqueta: 'Zona' },
    { clave: 'semana', etiqueta: 'Semana de la proyección' },
    { clave: 'litrosEstimados', etiqueta: 'Litros estimados', alinearFin: true },
    { clave: 'flujoCaja', etiqueta: 'Flujo de caja', alinearFin: true },
    { clave: 'riesgo', etiqueta: 'Riesgo valorizado', alinearFin: true },
    { clave: 'rechazo', etiqueta: 'Rechazo estimado', alinearFin: true },
    { clave: 'acciones', etiqueta: '' },
  ];

  constructor() {
    this.cargarZonas();
  }

  private aBarras(margen: { tipoCliente: string; totalVentas: number }[]): BarraChart[] {
    return margen.map((m) => ({ etiqueta: ETIQUETAS_CANAL[m.tipoCliente] ?? m.tipoCliente, valor: m.totalVentas }));
  }

  protected cargarZonas(): void {
    this.errorZonas.set(false);
    this.zonasApi
      .listarAdmin()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (z) => {
          this.zonas.set(z);
          // La vista inicial es el consolidado: se carga en cuanto se conocen las zonas.
          if (this.esConsolidado()) this.cargarConsolidado();
        },
        error: () => this.errorZonas.set(true),
      });
  }

  protected cambiarZona(zonaId: string): void {
    this.zonaSeleccionada.set(zonaId || TODAS_LAS_ZONAS);
    this.panel.set(null);
    this.error.set(null);
    this.sinProyeccion.set(false);
    if (this.esConsolidado()) {
      this.cargarConsolidado();
    } else {
      this.peticionConsolidado?.unsubscribe();
      this.cargandoConsolidado.set(false);
      this.cargarPanel(zonaId);
    }
  }

  /** Pide el panel de cada zona ACTIVA en paralelo; una zona que falla no tumba a las demás. */
  protected cargarConsolidado(): void {
    this.peticionConsolidado?.unsubscribe();
    const activas = this.zonas().filter((z) => z.activa);
    this.resultados.set([]);
    if (activas.length === 0) {
      this.cargandoConsolidado.set(false);
      return;
    }
    this.cargandoConsolidado.set(true);
    this.peticionConsolidado = forkJoin(
      activas.map((zona) =>
        this.calidadApi.panelEconomico(zona.id).pipe(
          map((panel): ResultadoZonaPanel => ({ zona: { id: zona.id, nombre: zona.nombre }, estado: 'ok', panel, mensaje: null })),
          catchError((e) => {
            const { estado, mensaje } = clasificarErrorPanel(e);
            return of<ResultadoZonaPanel>({ zona: { id: zona.id, nombre: zona.nombre }, estado, panel: null, mensaje });
          }),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((resultados) => {
        this.resultados.set(resultados);
        this.cargandoConsolidado.set(false);
      });
  }

  protected cargarPanel(zonaId: string): void {
    this.cargando.set(true);
    this.error.set(null);
    this.sinProyeccion.set(false);
    this.calidadApi
      .panelEconomico(zonaId)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (p) => {
          this.panel.set(p);
          this.cargando.set(false);
        },
        error: (e) => {
          this.cargando.set(false);
          const { estado } = clasificarErrorPanel(e);
          if (estado === 'sinProyeccion') {
            this.sinProyeccion.set(true);
          } else {
            this.error.set(mapHttpError(e));
          }
        },
      });
  }
}
