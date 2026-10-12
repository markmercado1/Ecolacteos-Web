import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { BarChartComponent, BarraChart } from '../../../../shared/ui/chart/bar-chart';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ZonaResponse } from '../../../catalogos/data-access/zona.models';
import { ZonasApi } from '../../../catalogos/data-access/zonas.api';
import { PanelEconomico } from '../../../calidad/data-access/calidad.models';
import { CalidadApi } from '../../../calidad/data-access/calidad.api';

const ETIQUETAS_CANAL: Record<string, string> = {
  MAYORISTA: 'Mayorista',
  PROVEEDOR: 'Proveedor',
  PUBLICO: 'Público',
};

/**
 * Panel económico (Fase 4, Bloque 6), ruta ADMIN-only (igual que `GET /api/innovacion/panel-economico`,
 * `hasRole('ADMIN')`). Los 4 indicadores de esta pantalla vienen de UNA sola llamada por zona
 * (PanelEconomicoService.construirPanel): no hay endpoints separados para pedirlos por partes.
 *
 * Limitación real del backend, no inventada: si la zona no tiene todavía una proyección semanal
 * calculada, `ForecastingService.obtenerUltima` lanza un 404 que `PanelEconomicoService` no captura —
 * el endpoint completo responde 404, no solo el campo de proyección. Por eso, cuando el 404 indica
 * específicamente ausencia de proyección (mensaje real del servidor), esta página no puede mostrar NINGÚN
 * indicador de esa zona, ni siquiera los que no dependen del forecast (riesgo valorizado, simulación) —
 * ver "BACKEND NECESARIO" en docs/REGISTRO.md. Otros 404 (p. ej. zona inexistente) y cualquier otro
 * código HTTP se muestran como error real, nunca como "sin proyección".
 */
@Component({
  selector: 'app-panel-page',
  imports: [BarChartComponent, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel-page.html',
  styleUrl: './panel-page.css',
})
export class PanelPage {
  private readonly calidadApi = inject(CalidadApi);
  private readonly zonasApi = inject(ZonasApi);
  private readonly destroy = inject(DestroyRef);

  protected readonly zonas = signal<ZonaResponse[]>([]);
  protected readonly errorZonas = signal(false);
  protected readonly zonaSeleccionada = signal('');
  protected readonly zonaNombre = computed(
    () => this.zonas().find((z) => z.id === this.zonaSeleccionada())?.nombre ?? '',
  );

  protected readonly cargando = signal(false);
  protected readonly error = signal<AppError | null>(null);
  /** 404 específicamente por falta de proyección semanal para la zona (mensaje real del servidor). */
  protected readonly sinProyeccion = signal(false);
  protected readonly panel = signal<PanelEconomico | null>(null);

  protected readonly datosVentasCanal = computed<BarraChart[]>(() =>
    (this.panel()?.margenPorCanal ?? []).map((m) => ({
      etiqueta: ETIQUETAS_CANAL[m.tipoCliente] ?? m.tipoCliente,
      valor: m.totalVentas,
    })),
  );

  constructor() {
    this.cargarZonas();
  }

  protected cargarZonas(): void {
    this.errorZonas.set(false);
    this.zonasApi
      .listarAdmin()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (z) => this.zonas.set(z), error: () => this.errorZonas.set(true) });
  }

  protected cambiarZona(zonaId: string): void {
    this.zonaSeleccionada.set(zonaId);
    this.panel.set(null);
    this.error.set(null);
    this.sinProyeccion.set(false);
    if (zonaId) this.cargarPanel(zonaId);
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
          const mensaje = e instanceof HttpErrorResponse ? (e.error?.mensaje as string | undefined) : undefined;
          if (e instanceof HttpErrorResponse && e.status === 404 && mensaje?.toLowerCase().includes('prediccion')) {
            this.sinProyeccion.set(true);
          } else {
            this.error.set(mapHttpError(e));
          }
        },
      });
  }
}
