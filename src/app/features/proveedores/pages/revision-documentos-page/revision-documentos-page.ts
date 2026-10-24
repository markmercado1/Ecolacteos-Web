import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import {
  etiquetaObservacion,
  etiquetaTipoPersona,
  RevisionDocumentosResponse,
  TipoPersona
} from '../../data-access/proveedor.models';
import { ProveedoresApi } from '../../data-access/proveedores.api';

/**
 * Fase G: documentos de proveedores que no cumplen las reglas actuales (solo ADMIN). SOLO LECTURA: la decisión del usuario es conservar
 * los registros y reportarlos; cada caso se corrige a mano desde «Editar» en Proveedores, si corresponde.
 */
@Component({
  selector: 'app-revision-documentos-page',
  imports: [DecimalPipe, RouterLink, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">PROVEEDORES Y LOGÍSTICA</div>
        <h1>Revisión de documentos</h1>
        <p>
          Proveedores cuyo DNI o RUC no cumple las reglas actuales (registros anteriores o cargados por fuera del panel). Esta pantalla es de
          <strong>solo lectura</strong>: no corrige nada. Si un caso debe corregirse, hazlo desde <a routerLink="/proveedores">Proveedores</a> → Editar.
        </p>
      </div>
    </div>

    @if (cargando()) {
      <ui-loading-state mensaje="Revisando los documentos…" />
    } @else if (error()) {
      <ui-error-state [error]="error()" (reintentar)="cargar()" />
    } @else if (datos(); as d) {
      <div class="resumen">
        <div class="card card-pad" data-testid="total-proveedores">
          <div class="cifra">{{ d.totalProveedores | number: '1.0-0' }}</div>
          <div>Proveedores revisados</div>
        </div>
        <div class="card card-pad" data-testid="total-observados">
          <div class="cifra">{{ d.proveedoresConObservaciones | number: '1.0-0' }}</div>
          <div>Con alguna observación</div>
        </div>
      </div>

      <div class="card card-pad">
        <div class="section-head"><h2>Observaciones</h2></div>
        @if (d.observaciones.length === 0) {
          <ui-empty-state mensaje="Todos los documentos cumplen las reglas actuales." />
        } @else {
          <div class="tabla-scroll" tabindex="0" role="region" aria-label="Observaciones de documentos">
            <table>
              <thead>
                <tr>
                  <th scope="col">Proveedor</th><th scope="col">Tipo</th><th scope="col">DNI</th><th scope="col">RUC</th>
                  <th scope="col">Observación</th><th scope="col">Detalle</th>
                </tr>
              </thead>
              <tbody>
                @for (o of d.observaciones; track o.proveedorId + o.codigo + $index) {
                  <tr data-testid="observacion">
                    <td>
                      <strong>{{ o.nombre }}</strong>
                      @if (!o.activo) { <span class="badge gray">Inactivo</span> }
                    </td>
                    <td>{{ tipo(o.tipoPersona) }}</td>
                    <td class="doc">{{ o.dni ?? '—' }}</td>
                    <td class="doc">{{ o.ruc ?? '—' }}</td>
                    <td><span class="badge amber">{{ etiqueta(o.codigo) }}</span></td>
                    <td>{{ o.detalle }}</td>
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
    .tabla-scroll { overflow-x: auto; border: 1px solid var(--color-border); border-radius: var(--radius-control); }
    .tabla-scroll:focus-visible { outline: 2px solid var(--color-primary, currentColor); outline-offset: 2px; }
    table { width: 100%; min-width: 48rem; border-collapse: collapse; font-size: var(--font-size-sm); }
    th, td { padding: var(--space-3); border-bottom: 1px solid var(--color-border); text-align: left; vertical-align: top; }
    th { font-size: 0.75rem; color: var(--color-text-muted); font-weight: 700; background: var(--color-surface-soft); }
    .doc { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .badge.gray { margin-left: var(--space-2); }
  `
})
export class RevisionDocumentosPage {
  private readonly api = inject(ProveedoresApi);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly datos = signal<RevisionDocumentosResponse | null>(null);

  constructor() {
    this.cargar();
  }

  protected etiqueta(codigo: string): string {
    return etiquetaObservacion(codigo);
  }

  protected tipo(tipo: TipoPersona | null): string {
    return etiquetaTipoPersona(tipo);
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.revisionDocumentos().subscribe({
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
