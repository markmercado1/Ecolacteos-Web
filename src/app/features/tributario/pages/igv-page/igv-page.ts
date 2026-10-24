import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { Subscription } from 'rxjs';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { TAMANOS_PAGINA, TAMANO_PAGINA_POR_DEFECTO, paginaCorregida } from '../../../../shared/util/paginacion';
import {
  EstadoIgvResponse,
  etiquetaAfectacion,
  FilaAfectacionIgvResponse,
  TasaIgvResponse
} from '../../data-access/igv.models';
import { IgvApi } from '../../data-access/igv.api';
import { AfectacionIgvDialog } from '../../ui/afectacion-igv-dialog/afectacion-igv-dialog';
import { TasaIgvDialog } from '../../ui/tasa-igv-dialog/tasa-igv-dialog';

/**
 * Fase G: configuración del IGV de las ventas (solo ADMIN). Los precios son finales: el IGV se desglosa dentro del precio, nunca se
 * suma. Esta pantalla PREPARA la configuración (tasa con vigencia y afectación por presentación); si el cálculo está apagado en el
 * servidor (estado PENDIENTE, por defecto hasta que confirme el contador) nada de lo registrado cambia una venta.
 */
@Component({
  selector: 'app-igv-page',
  imports: [DatePipe, DecimalPipe, DataTableComponent, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">COMERCIAL</div>
        <h1>IGV de las ventas</h1>
        <p>
          Los precios son <strong>finales</strong>: lo publicado es lo que paga el cliente. Cuando una venta está gravada, el IGV se
          <strong>desglosa dentro</strong> del precio; nunca se suma.
        </p>
      </div>
      <div class="heading-actions">
        <button type="button" class="btn primary" (click)="registrarTasa()">Registrar tasa</button>
      </div>
    </div>

    @if (cargandoEstado()) {
      <ui-loading-state mensaje="Cargando la configuración…" />
    } @else if (errorEstado()) {
      <ui-error-state [error]="errorEstado()" (reintentar)="cargarEstado()" />
    } @else if (estado(); as e) {
      <div class="estado card card-pad" [class.pendiente]="e.estado === 'PENDIENTE'" data-testid="estado-igv" role="status">
        <div class="estado-titulo">
          @if (e.estado === 'PENDIENTE') {
            <span class="badge amber">Pendiente</span> Cálculo del IGV desactivado
          } @else {
            <span class="badge">Activo</span> Cálculo del IGV activo
          }
        </div>
        @if (e.estado === 'PENDIENTE') {
          <p class="estado-texto">
            Configuración pendiente de la confirmación del contador. Puedes preparar la tasa y la afectación de cada presentación, pero
            <strong>las ventas se siguen registrando como hasta ahora, sin desglose</strong>, hasta que se active el cálculo en el servidor.
          </p>
        }
        @if (avisosExtra(e).length) {
          <ul class="avisos">
            @for (a of avisosExtra(e); track a) { <li data-testid="aviso-igv">{{ a }}</li> }
          </ul>
        }
      </div>

      <div class="resumen">
        <div class="card card-pad" data-testid="tasa-vigente">
          <div class="cifra">{{ e.tasaVigente ? (e.tasaVigente.tasa | number: '1.0-2') + ' %' : '—' }}</div>
          <div>Tasa vigente{{ e.tasaVigente ? ' desde ' + (e.tasaVigente.vigenteDesde | date: 'dd/MM/yyyy') : ' (sin registrar)' }}</div>
          @if (e.tasaProgramada; as t) { <div class="muted">Programada: {{ t.tasa | number: '1.0-2' }} % desde {{ t.vigenteDesde | date: 'dd/MM/yyyy' }}</div> }
        </div>
        <div class="card card-pad" data-testid="conteo-afectacion">
          <div class="cifra">{{ e.sinDefinir }} / {{ e.presentacionesActivas }}</div>
          <div>Presentaciones activas sin afectación definida</div>
          <div class="muted">Gravadas {{ e.gravadas }} · Exoneradas {{ e.exoneradas }} · Inafectas {{ e.inafectas }}</div>
        </div>
      </div>
    }

    <div class="card card-pad">
      <div class="section-head"><h2>Tasas registradas</h2></div>
      @if (errorTasas()) {
        <ui-error-state [error]="errorTasas()" (reintentar)="cargarTasas()" />
      } @else if (tasas().length === 0) {
        <ui-empty-state mensaje="No hay tasas de IGV registradas." />
      } @else {
        <div class="tabla-scroll" tabindex="0" role="region" aria-label="Tasas de IGV">
          <table>
            <thead><tr><th scope="col">Vigente desde</th><th scope="col" class="num">Tasa</th><th scope="col">Motivo</th><th scope="col">Registrada por</th></tr></thead>
            <tbody>
              @for (t of tasas(); track t.id) {
                <tr data-testid="tasa">
                  <td>{{ t.vigenteDesde | date: 'dd/MM/yyyy' }}</td>
                  <td class="num">{{ t.tasa | number: '1.2-2' }} %</td>
                  <td>{{ t.motivo }}</td>
                  <td>{{ t.usuarioNombre ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <ui-data-table
      [columnas]="columnas"
      [filas]="filas()"
      [cargando]="cargandoFilas()"
      [error]="errorFilas()"
      mensajeVacio="No hay presentaciones activas que coincidan."
      titulo="Afectación por presentación"
      subtitulo="Ninguna presentación viene clasificada: la afectación la decide el contador. Las ventas ya registradas no cambian."
      [buscable]="true"
      placeholderBusqueda="Buscar por producto o presentación"
      etiquetaBusqueda="Buscar presentación por producto o nombre"
      [pagina]="pagina()"
      [totalPaginas]="totalPaginas()"
      [totalElementos]="totalElementos()"
      [tamano]="tamano()"
      [tamanos]="tamanos"
      unidad="presentaciones"
      (buscar)="buscar($event)"
      (cambiarPagina)="cambiarPagina($event)"
      (cambiarTamano)="cambiarTamano($event)"
      (reintentar)="cargarFilas()"
    >
      <ng-template #celda let-fila let-columna="columna">
        @switch (columna) {
          @case ('producto') { <strong>{{ fila.productoNombre }}</strong><div class="muted">{{ fila.presentacionNombre }}</div> }
          @case ('vigente') {
            <span class="badge" [class.gray]="fila.afectacionVigente === 'SIN_DEFINIR'" data-testid="afectacion-vigente">{{ etiqueta(fila.afectacionVigente) }}</span>
            @if (fila.vigenteDesde) { <div class="muted">desde {{ fila.vigenteDesde | date: 'dd/MM/yyyy' }}</div> }
          }
          @case ('programada') {
            @if (fila.afectacionProgramada) { {{ etiqueta(fila.afectacionProgramada) }} <span class="muted">desde {{ fila.programadaDesde | date: 'dd/MM/yyyy' }}</span> }
            @else { — }
          }
          @case ('acciones') { <button type="button" class="row-link" (click)="abrirAfectacion(fila)">Historial y cambio</button> }
          @default { {{ fila[columna] ?? '—' }} }
        }
      </ng-template>
    </ui-data-table>
  `,
  styles: `
    .estado { margin-bottom: var(--space-4); border-left: 4px solid var(--color-primary, currentColor); }
    .estado.pendiente { border-left-color: var(--color-warning); background: var(--color-warning-bg); }
    .estado-titulo { font-weight: 700; display: flex; align-items: center; gap: var(--space-2); }
    .estado-texto { margin: var(--space-2) 0 0; font-size: var(--font-size-sm); }
    .avisos { margin: var(--space-2) 0 0; padding-left: 1.2rem; font-size: var(--font-size-sm); }
    .resumen { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: var(--space-4); margin-bottom: var(--space-4); }
    .cifra { font-size: 1.75rem; font-weight: 800; }
    .muted { color: var(--color-text-muted); font-size: 0.75rem; }
    .card + .card, .card + ui-data-table { display: block; margin-top: var(--space-4); }
    .tabla-scroll { overflow-x: auto; border: 1px solid var(--color-border); border-radius: var(--radius-control); }
    table { width: 100%; min-width: 32rem; border-collapse: collapse; font-size: var(--font-size-sm); }
    th, td { padding: var(--space-3); border-bottom: 1px solid var(--color-border); text-align: left; }
    th { font-size: 0.75rem; color: var(--color-text-muted); font-weight: 700; background: var(--color-surface-soft); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
  `
})
export class IgvPage {
  private readonly api = inject(IgvApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly cargandoEstado = signal(true);
  protected readonly errorEstado = signal<AppError | null>(null);
  protected readonly estado = signal<EstadoIgvResponse | null>(null);

  protected readonly tasas = signal<TasaIgvResponse[]>([]);
  protected readonly errorTasas = signal<AppError | null>(null);

  protected readonly filas = signal<FilaAfectacionIgvResponse[]>([]);
  protected readonly cargandoFilas = signal(true);
  protected readonly errorFilas = signal<AppError | null>(null);
  protected readonly pagina = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  protected readonly tamanos = TAMANOS_PAGINA;
  protected readonly totalPaginas = signal(0);
  protected readonly totalElementos = signal(0);
  private readonly busqueda = signal('');
  private peticion?: Subscription;

  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'producto', etiqueta: 'Producto y presentación' },
    { clave: 'familiaNombre', etiqueta: 'Familia' },
    { clave: 'vigente', etiqueta: 'Afectación vigente' },
    { clave: 'programada', etiqueta: 'Programada' },
    { clave: 'acciones', etiqueta: '' }
  ];

  constructor() {
    this.cargarEstado();
    this.cargarTasas();
    this.cargarFilas();
  }

  /** Avisos del servidor sin repetir el de «configuración pendiente», que ya explica el recuadro. */
  protected avisosExtra(e: EstadoIgvResponse): string[] {
    return e.estado === 'PENDIENTE' ? e.avisos.filter((a) => !a.includes('pendiente de la confirmación del contador')) : e.avisos;
  }

  protected etiqueta(a: string | null): string {
    return etiquetaAfectacion(a);
  }

  protected cargarEstado(): void {
    this.cargandoEstado.set(true);
    this.errorEstado.set(null);
    this.api.estado().subscribe({
      next: (e) => {
        this.estado.set(e);
        this.cargandoEstado.set(false);
      },
      error: (e) => {
        this.errorEstado.set(mapHttpError(e));
        this.cargandoEstado.set(false);
      }
    });
  }

  protected cargarTasas(): void {
    this.errorTasas.set(null);
    this.api.tasas().subscribe({
      next: (t) => this.tasas.set(t),
      error: (e) => this.errorTasas.set(mapHttpError(e))
    });
  }

  protected cargarFilas(): void {
    this.peticion?.unsubscribe();
    this.cargandoFilas.set(true);
    this.errorFilas.set(null);
    this.peticion = this.api.afectaciones({ busqueda: this.busqueda() || undefined, page: this.pagina(), size: this.tamano() }).subscribe({
      next: (respuesta) => {
        const corregida = paginaCorregida(respuesta);
        if (corregida !== null) {
          this.pagina.set(corregida);
          this.cargarFilas();
          return;
        }
        this.filas.set(respuesta.contenido);
        this.totalPaginas.set(respuesta.totalPaginas);
        this.totalElementos.set(respuesta.totalElementos);
        this.cargandoFilas.set(false);
      },
      error: (e) => {
        this.errorFilas.set(mapHttpError(e));
        this.cargandoFilas.set(false);
      }
    });
  }

  protected buscar(texto: string): void {
    this.busqueda.set(texto);
    this.pagina.set(0);
    this.cargarFilas();
  }

  protected cambiarPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginas()) return;
    this.pagina.set(pagina);
    this.cargarFilas();
  }

  protected cambiarTamano(tamano: number): void {
    this.tamano.set(tamano);
    this.pagina.set(0);
    this.cargarFilas();
  }

  protected registrarTasa(): void {
    const ref = this.dialog.open<TasaIgvResponse | undefined>(TasaIgvDialog, { ariaLabel: 'Registrar tasa de IGV' });
    ref.closed.subscribe((tasa) => {
      if (tasa) {
        this.toast.exito(`Tasa de ${tasa.tasa} % registrada desde el ${tasa.vigenteDesde}.`);
        this.cargarEstado();
        this.cargarTasas();
      }
    });
  }

  protected abrirAfectacion(fila: FilaAfectacionIgvResponse): void {
    const ref = this.dialog.open<boolean | undefined>(AfectacionIgvDialog, {
      ariaLabel: `Afectación al IGV de ${fila.productoNombre}, ${fila.presentacionNombre}`,
      data: { fila }
    });
    ref.closed.subscribe((cambio) => {
      if (cambio) {
        this.cargarEstado();
        this.cargarFilas();
      }
    });
  }
}
