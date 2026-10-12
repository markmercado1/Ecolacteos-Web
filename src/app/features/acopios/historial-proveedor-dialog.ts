import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AcopiosApi, RegistroAcopioResumen } from './acopios.api';
import { AppError, mapHttpError } from '../../core/http/app-error';
import { ErrorStateComponent } from '../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../shared/ui/state/loading-state';
import { EmptyStateComponent } from '../../shared/ui/state/empty-state';
import { PaginadorComponent } from '../../shared/ui/paginador/paginador';
import { paginaCorregida } from '../../shared/util/paginacion';
import { AnalisisCalidad } from '../calidad/data-access/calidad.models';
import { CalidadApi } from '../calidad/data-access/calidad.api';

export interface HistorialProveedorDialogData {
  proveedorId: string;
  proveedorNombre: string;
}

interface EstadoAnalisisFila {
  cargando: boolean;
  error: AppError | null;
  resultados: AnalisisCalidad[] | null;
}

/** El diálogo es angosto: páginas más cortas que en las tablas de pantalla completa. */
const TAMANO_PAGINA_HISTORIAL = 10;

/**
 * Historial de entregas de un proveedor (RF-TRA-01), solo lectura. Paginado en el servidor con
 * GET /api/registros-acopio/proveedor/{id}/paginado (la lista completa sin paginar queda para la app móvil).
 */
@Component({
  selector: 'app-historial-proveedor-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, ErrorStateComponent, LoadingStateComponent, EmptyStateComponent, PaginadorComponent],
  template: `
    <header>
      <div>
        <div class="eyebrow">HISTORIAL DE ENTREGAS</div>
        <h2 id="historial-titulo">{{ data.proveedorNombre }}</h2>
      </div>
      <button class="btn" (click)="ref.close()" aria-label="Cerrar historial">×</button>
    </header>
    @if (cargando()) {
      <ui-loading-state mensaje="Cargando historial…" />
    } @else if (error()) {
      <ui-error-state [error]="error()" (reintentar)="cargar()" />
    } @else if (historial().length === 0) {
      <ui-empty-state mensaje="Este proveedor no tiene entregas registradas." />
    } @else {
      <table class="tabla-historial">
        <thead>
          <tr>
            <th>Fecha y hora</th>
            <th class="align-end">Litros</th>
            <th>Observación</th>
            <th>Disponible para lote</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (h of historial(); track h.id) {
            <tr>
              <td>{{ h.fechaHora | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
              <td class="align-end">{{ h.litros | number: '1.0-3' }} L</td>
              <td>{{ h.tieneObservacion ? 'Con observación' : 'Sin observación' }}</td>
              <td>{{ h.disponibleParaLote ? 'Sí' : 'No' }}</td>
              <td><button type="button" class="row-link" (click)="alternarAnalisis(h.id)">
                {{ analisisExpandido() === h.id ? 'Ocultar análisis' : 'Ver análisis' }}
              </button></td>
            </tr>
            @if (analisisExpandido() === h.id) {
              <tr class="fila-analisis">
                <td colspan="5">
                  @if (estadoAnalisis(h.id).cargando) {
                    <ui-loading-state mensaje="Cargando análisis…" />
                  } @else if (estadoAnalisis(h.id).error) {
                    <ui-error-state [error]="estadoAnalisis(h.id).error" (reintentar)="cargarAnalisis(h.id)" />
                  } @else if (!estadoAnalisis(h.id).resultados?.length) {
                    <ui-empty-state mensaje="Este registro no tiene análisis de calidad." />
                  } @else {
                    <table class="tabla-analisis">
                      <thead>
                        <tr>
                          <th>Folio</th>
                          <th>Resultado</th>
                          <th>Agua añadida</th>
                          <th>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (a of estadoAnalisis(h.id).resultados; track a.id) {
                          <tr>
                            <td>{{ a.folioMuestra }}</td>
                            <td>
                              <span class="badge" [class.red]="a.resultado === 'RECHAZADO'">{{ a.resultado }}</span>
                            </td>
                            <td>{{ a.aguaAnadida === null ? 'No informado' : (a.aguaAnadida ? 'Sí' : 'No') }}</td>
                            <td>{{ a.creadoEn | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
      <ui-paginador
        [pagina]="pagina()"
        [totalPaginas]="totalPaginas()"
        [totalElementos]="totalElementos()"
        unidad="entregas"
        (cambiar)="irAPagina($event)"
      />
    }
  `,
  styles: `
    :host {
      display: block;
      width: min(40rem, calc(100vw - 2rem));
      max-height: 85vh;
      overflow: auto;
      padding: var(--space-6);
      background: var(--color-surface);
      border-radius: var(--radius-dialog);
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 1rem;
    }
    h2 {
      margin-top: 0;
    }
    .tabla-historial {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--font-size-sm);
    }
    .tabla-historial th,
    .tabla-historial td {
      text-align: left;
      padding: 0.5rem 0.6rem;
      border-bottom: 1px solid var(--color-border);
    }
    .align-end {
      text-align: right;
    }
    .fila-analisis td {
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface-soft);
      padding: var(--space-3);
    }
    .tabla-analisis {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--font-size-sm);
    }
    .tabla-analisis th,
    .tabla-analisis td {
      text-align: left;
      padding: 0.3rem 0.5rem;
    }
  `,
})
export class HistorialProveedorDialog {
  protected readonly ref = inject(DialogRef);
  protected readonly data = inject<HistorialProveedorDialogData>(DIALOG_DATA);
  private readonly api = inject(AcopiosApi);
  private readonly calidadApi = inject(CalidadApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly historial = signal<RegistroAcopioResumen[]>([]);
  protected readonly pagina = signal(0);
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);
  private peticion?: Subscription;
  /** Un análisis expandido a la vez; se consulta bajo demanda por fila, nunca para todo el historial de golpe. */
  protected readonly analisisExpandido = signal<string | null>(null);
  private readonly analisisPorRegistro = signal<Record<string, EstadoAnalisisFila>>({});
  constructor() {
    this.cargar();
  }
  protected cargar() {
    this.cargando.set(true);
    this.error.set(null);
    this.peticion?.unsubscribe();
    this.peticion = this.api
      .porProveedor(this.data.proveedorId, { page: this.pagina(), size: TAMANO_PAGINA_HISTORIAL })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          const corregida = paginaCorregida(r);
          if (corregida !== null) {
            this.pagina.set(corregida);
            this.cargar();
            return;
          }
          this.historial.set(r.contenido);
          this.totalElementos.set(r.totalElementos);
          this.totalPaginas.set(r.totalPaginas);
          this.cargando.set(false);
        },
        error: (e) => {
          this.error.set(mapHttpError(e));
          this.cargando.set(false);
        },
      });
  }
  protected irAPagina(pagina: number) {
    if (pagina < 0 || pagina >= this.totalPaginas()) return;
    this.pagina.set(pagina);
    this.analisisExpandido.set(null);
    this.cargar();
  }
  protected estadoAnalisis(registroAcopioId: string): EstadoAnalisisFila {
    return this.analisisPorRegistro()[registroAcopioId] ?? { cargando: false, error: null, resultados: null };
  }
  protected alternarAnalisis(registroAcopioId: string) {
    if (this.analisisExpandido() === registroAcopioId) {
      this.analisisExpandido.set(null);
      return;
    }
    this.analisisExpandido.set(registroAcopioId);
    if (!this.analisisPorRegistro()[registroAcopioId]) {
      this.cargarAnalisis(registroAcopioId);
    }
  }
  protected cargarAnalisis(registroAcopioId: string) {
    this.actualizarEstadoAnalisis(registroAcopioId, { cargando: true, error: null, resultados: null });
    this.calidadApi
      .porRegistro(registroAcopioId)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (resultados) => this.actualizarEstadoAnalisis(registroAcopioId, { cargando: false, error: null, resultados }),
        error: (e) =>
          this.actualizarEstadoAnalisis(registroAcopioId, { cargando: false, error: mapHttpError(e), resultados: null }),
      });
  }
  private actualizarEstadoAnalisis(registroAcopioId: string, estado: EstadoAnalisisFila) {
    this.analisisPorRegistro.update((actual) => ({ ...actual, [registroAcopioId]: estado }));
  }
}
