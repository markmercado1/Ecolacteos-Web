import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { RevisionZonasApi } from '../../data-access/revision-zonas.api';
import { etiquetaMotivoSinZona, RevisionZonasResponse } from '../../data-access/revision-zonas.models';

/**
 * Casos de zona pendientes de revisión manual (solo ADMIN). SOLO LECTURA: lista lo que el sistema no pudo decidir y no corrige ningún dato
 * histórico; resolver cada caso es una decisión de negocio pendiente.
 */
@Component({
  selector: 'app-revision-zonas-page',
  imports: [DatePipe, DecimalPipe, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">PROVEEDORES Y LOGÍSTICA</div>
        <h1>Revisión de zonas</h1>
        <p>
          Casos de zona que el sistema no pudo decidir por sí solo. Esta pantalla es de <strong>solo lectura</strong>: no corrige ningún dato
          histórico, y esas entregas siguen sin zona asignada hasta que se resuelvan por otra vía.
        </p>
      </div>
    </div>

    @if (cargando()) {
      <ui-loading-state mensaje="Cargando los casos pendientes…" />
    } @else if (error()) {
      <ui-error-state [error]="error()" (reintentar)="cargar()" />
    } @else if (datos(); as d) {
      <div class="resumen">
        <div class="card card-pad" data-testid="total-periodos">
          <div class="cifra">{{ d.periodos.length }}</div>
          <div>Periodos de zona con fechas invertidas</div>
        </div>
        <div class="card card-pad" data-testid="total-entregas">
          <div class="cifra">{{ d.totalEntregasSinZona | number: '1.0-0' }}</div>
          <div>Entregas sin zona</div>
        </div>
      </div>

      <div class="card card-pad">
        <div class="section-head"><h2>Periodos de zona con fechas invertidas</h2></div>
        <p class="hint">
          Reasignaciones hechas el mismo día con una versión anterior del sistema: el orden real no se puede recuperar. Se conservan, pero no
          deciden la zona de ninguna entrega.
        </p>
        @if (d.periodos.length === 0) {
          <ui-empty-state mensaje="No hay periodos marcados para revisión." />
        } @else {
          <div class="tabla-scroll" tabindex="0" role="region" aria-label="Periodos de zona marcados para revisión">
            <table>
              <thead>
                <tr>
                  <th scope="col">Proveedor</th><th scope="col">Zona</th><th scope="col">Desde</th><th scope="col">Hasta</th><th scope="col">Nota</th>
                </tr>
              </thead>
              <tbody>
                @for (p of d.periodos; track p.id) {
                  <tr data-testid="periodo">
                    <td><strong>{{ p.proveedorNombre }}</strong></td>
                    <td>{{ p.zonaNombre }}</td>
                    <td>{{ p.desde }}</td>
                    <td>{{ p.hasta ?? 'abierto' }} <span class="badge amber" title="La fecha final es anterior a la inicial">Invertido</span></td>
                    <td>{{ p.nota ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <div class="card card-pad">
        <div class="section-head"><h2>Entregas sin zona</h2></div>
        <p class="hint">Entregas cuya zona de ese momento no se pudo determinar. No se rellenan con la zona actual del proveedor.</p>
        @if (d.entregasSinZona.length === 0) {
          <ui-empty-state mensaje="No hay entregas sin zona." />
        } @else {
          @if (d.totalEntregasSinZona > d.entregasSinZona.length) {
            <p class="aviso" role="status" data-testid="aviso-limite">
              Se muestran las primeras {{ d.entregasSinZona.length }} de {{ d.totalEntregasSinZona | number: '1.0-0' }} entregas (límite del informe: {{ d.limiteEntregas }}).
            </p>
          }
          <div class="tabla-scroll" tabindex="0" role="region" aria-label="Entregas sin zona">
            <table>
              <thead>
                <tr>
                  <th scope="col">Proveedor</th><th scope="col">Fecha y hora</th><th scope="col" class="num">Litros</th><th scope="col">Motivo</th>
                </tr>
              </thead>
              <tbody>
                @for (e of d.entregasSinZona; track e.registroId) {
                  <tr data-testid="entrega-sin-zona">
                    <td><strong>{{ e.proveedorNombre }}</strong></td>
                    <td>{{ e.fechaHora | date: 'dd/MM/yyyy HH:mm' }}</td>
                    <td class="num">{{ e.litros | number: '1.0-2' }}</td>
                    <td>{{ motivo(e.motivo) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    }
  `,
  styles: `
    .resumen { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: var(--space-4); margin-bottom: var(--space-4); }
    .cifra { font-size: 1.75rem; font-weight: 800; }
    .card + .card { margin-top: var(--space-4); }
    .hint { color: var(--color-text-muted); font-size: 0.75rem; margin: 0 0 var(--space-3); }
    .aviso { background: var(--color-warning-bg); color: var(--color-warning); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); }
    .tabla-scroll { overflow-x: auto; border: 1px solid var(--color-border); border-radius: var(--radius-control); }
    .tabla-scroll:focus-visible { outline: 2px solid var(--color-primary, currentColor); outline-offset: 2px; }
    table { width: 100%; min-width: 40rem; border-collapse: collapse; font-size: var(--font-size-sm); }
    th, td { padding: var(--space-3); border-bottom: 1px solid var(--color-border); text-align: left; vertical-align: middle; }
    th { font-size: 0.75rem; color: var(--color-text-muted); font-weight: 700; background: var(--color-surface-soft); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
  `
})
export class RevisionZonasPage {
  private readonly api = inject(RevisionZonasApi);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly datos = signal<RevisionZonasResponse | null>(null);

  constructor() {
    this.cargar();
  }

  protected motivo(motivo: string): string {
    return etiquetaMotivoSinZona(motivo);
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.obtener().subscribe({
      next: (datos) => {
        this.datos.set(datos);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(mapHttpError(error));
        this.cargando.set(false);
      }
    });
  }
}
