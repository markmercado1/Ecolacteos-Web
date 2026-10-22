import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ContentChild, Signal, TemplateRef, computed, input, output } from '@angular/core';
import { AppError } from '../../../core/http/app-error';
import { BuscadorComponent } from '../buscador/buscador';
import { PaginadorComponent } from '../paginador/paginador';
import { EmptyStateComponent } from '../state/empty-state';
import { ErrorStateComponent } from '../state/error-state';
import { LoadingStateComponent } from '../state/loading-state';
import { TAMANOS_PAGINA } from '../../util/paginacion';

export interface ColumnaTabla {
  clave: string;
  etiqueta: string;
  alinearFin?: boolean;
}

/**
 * Lo que la tabla necesita de una lista que se busca y pagina en el cliente (ver `ListaLocal`): con `[lista]` la tabla
 * toma de ahí las filas, el buscador, el paginador y el resaltado, sin repetir cada atributo en la plantilla.
 */
export interface ListaParaTabla<T> {
  readonly filas: Signal<T[]>;
  readonly busqueda: Signal<string>;
  readonly paginaActual: Signal<number>;
  readonly totalPaginas: Signal<number>;
  readonly totalElementos: Signal<number>;
  readonly tamano: Signal<number>;
  esResaltada(fila: T): boolean;
  buscar(texto: string): void;
  irA(pagina: number): void;
  cambiarTamano(tamano: number): void;
}

/**
 * Tabla genérica: el encabezado sale de columnas(), y cada celda se resuelve
 * con la plantilla proyectada marcada como #celda, usando { $implicit: fila,
 * columna }. Sin plantilla proyectada, muestra fila[columna] como texto.
 *
 * Estándar de las tablas del sistema (mismo comportamiento en todas):
 * - Buscador: `buscable` pone el `ui-buscador` único en la barra de la tabla y emite `buscar(texto)`; quien usa la
 *   tabla decide si consulta al servidor o filtra en el cliente, y vuelve a la página 0.
 * - Paginación: pasando `totalPaginas` (+ `pagina`, `totalElementos`, `tamano`, `unidad`) el pie muestra el
 *   `ui-paginador` único («Mostrando 21–40 de 87…», Anterior/Siguiente, números de página y, con `tamanos`, «Filas»)
 *   y emite `cambiarPagina(n)` / `cambiarTamano(n)`. Sin `totalPaginas`, el pie solo muestra `piePagina` (texto).
 * - Fila nueva: `resaltarFila` marca (unos segundos, lo decide quien la usa) la fila recién creada.
 * - Lista en el cliente: `[lista]` (una `ListaLocal`) reemplaza a `filas`, al buscador, al paginador y al resaltado de
 *   arriba para los catálogos y listas pequeñas que el backend entrega completas. Solo hay que dar `unidad`.
 *
 * La plantilla de celda se busca por el nombre de referencia local `#celda`
 * (no por tipo `TemplateRef` a secas): un `@ContentChild(TemplateRef)` sin
 * selector encuentra CUALQUIER TemplateRef proyectado, incluido el que
 * generan internamente los bloques `@for`/`@if` de un toolbar proyectado
 * (p. ej. las `<option>` de un `<select>` de filtro). Cuando eso ocurre, la
 * tabla reutiliza esa plantilla ajena como si fuera la de celda, con el
 * contexto de la fila, y por eso columnas distintas terminan mostrando el
 * mismo campo (bug real reproducido en data-table.spec.ts). Exigir `#celda`
 * hace la búsqueda inequívoca sin importar qué más haya proyectado.
 */
@Component({
  selector: 'ui-data-table',
  imports: [NgTemplateOutlet, LoadingStateComponent, EmptyStateComponent, ErrorStateComponent, BuscadorComponent, PaginadorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card table-card">
      @if (titulo() || esBuscable()) {
        <div class="table-toolbar">
          <div>
            @if (titulo()) { <h2>{{ titulo() }}</h2> }
            @if (subtitulo()) { <p>{{ subtitulo() }}</p> }
          </div>
          <div class="toolbar-controles">
            @if (esBuscable()) {
              <ui-buscador
                [placeholder]="placeholderBusqueda()"
                [etiqueta]="etiquetaBusqueda()"
                [valorInicial]="busquedaMostrada()"
                (buscar)="buscarTexto($event)"
              />
            }
            <ng-content select="[toolbar]"></ng-content>
          </div>
        </div>
      }
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              @for (columna of columnas(); track columna.clave) {
                <th [class.align-end]="columna.alinearFin">{{ columna.etiqueta }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @if (cargando()) {
              <tr><td [attr.colspan]="columnas().length"><ui-loading-state /></td></tr>
            } @else if (error()) {
              <tr><td [attr.colspan]="columnas().length">
                <ui-error-state [error]="error()" (reintentar)="reintentar.emit()" />
              </td></tr>
            } @else if (filasMostradas().length === 0) {
              <tr><td [attr.colspan]="columnas().length">
                <ui-empty-state [mensaje]="mensajeSinFilas()" />
              </td></tr>
            } @else {
              @for (fila of filasMostradas(); track trackByFn()(fila)) {
                <tr [class.resaltada]="filaResaltada()(fila)">
                  @for (columna of columnas(); track columna.clave) {
                    <td [class.align-end]="columna.alinearFin">
                      <ng-container
                        *ngTemplateOutlet="celda ?? celdaPorDefecto; context: { $implicit: fila, columna: columna.clave }">
                      </ng-container>
                    </td>
                  }
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
      <ng-template #celdaPorDefecto let-fila let-columna="columna">{{ fila[columna] }}</ng-template>
      @if (totalPaginasMostradas() !== null && !cargando() && !error()) {
        <div class="table-foot">
          <ui-paginador
            [pagina]="paginaMostrada()"
            [totalPaginas]="totalPaginasMostradas() ?? 0"
            [totalElementos]="totalElementosMostrados()"
            [tamano]="tamanoMostrado()"
            [unidad]="unidad()"
            [tamanos]="tamanosMostrados()"
            (cambiar)="irAPagina($event)"
            (cambiarTamano)="cambiarTamanoTabla($event)"
          />
        </div>
      } @else if (piePagina()) {
        <div class="table-foot">
          <span>{{ piePagina() }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .table-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-4);
      border-bottom: 1px solid var(--color-border);
      flex-wrap: wrap;
    }
    .toolbar-controles {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }
    .table-toolbar h2 { font-size: var(--font-size-base); font-weight: 800; margin: 0; }
    .table-toolbar p { font-size: 0.75rem; color: var(--color-text-muted); margin: var(--space-1) 0 0; }
    .table-scroll { overflow: auto; }
    table { border-collapse: collapse; width: 100%; min-width: 40rem; text-align: left; }
    th {
      background: var(--color-surface-soft);
      color: var(--color-text-muted);
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: var(--space-3) var(--space-4);
      font-weight: 800;
      white-space: nowrap;
    }
    td {
      padding: var(--space-3) var(--space-4);
      border-top: 1px solid var(--color-surface-soft);
      font-size: var(--font-size-sm);
      color: var(--color-text);
    }
    td small {
      display: block;
      color: var(--color-text-muted);
      font-size: 0.7rem;
      margin-top: 0.15rem;
    }
    th.align-end, td.align-end { text-align: right; }
    tbody tr:hover { background: var(--color-surface-soft); }
    /* Fila recién creada: se ve un rato y se desvanece (sin movimiento para quien prefiere menos animación). */
    tbody tr.resaltada { animation: resaltar 4s ease-out; background: var(--color-surface-soft); }
    @keyframes resaltar {
      0%, 60% { background: var(--color-warning-bg, #fdf3d7); }
      100% { background: transparent; }
    }
    @media (prefers-reduced-motion: reduce) {
      tbody tr.resaltada { animation: none; background: var(--color-warning-bg, #fdf3d7); }
    }
    .table-foot {
      padding: var(--space-3) var(--space-4);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      border-top: 1px solid var(--color-border);
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }
  `
})
export class DataTableComponent<T = unknown> {
  readonly columnas = input.required<ColumnaTabla[]>();
  readonly filas = input<T[]>([]);
  readonly cargando = input(false);
  readonly error = input<AppError | null>(null);
  readonly mensajeVacio = input('No hay resultados para mostrar.');
  readonly titulo = input<string>();
  readonly subtitulo = input<string>();
  /** Pie de texto simple, para tablas SIN paginador (con `totalPaginas` se ignora). */
  readonly piePagina = input<string>();
  readonly identificarFila = input<(fila: T) => unknown>((fila) => fila);
  readonly reintentar = output<void>();

  // --- Buscador estándar ---
  readonly buscable = input(false);
  readonly placeholderBusqueda = input('Buscar…');
  readonly etiquetaBusqueda = input('');
  readonly busquedaInicial = input('');
  readonly buscar = output<string>();

  // --- Paginador estándar (se activa al pasar totalPaginas) ---
  readonly pagina = input(0);
  readonly totalPaginas = input<number | null>(null);
  readonly totalElementos = input(0);
  readonly tamano = input(20);
  /** Sustantivo plural del resumen: «proveedores», «pagos»… */
  readonly unidad = input('resultados');
  readonly tamanos = input<number[]>([]);
  readonly cambiarPagina = output<number>();
  readonly cambiarTamano = output<number>();

  /** ¿Esta fila es la recién creada? Se dibuja resaltada. */
  readonly resaltarFila = input<(fila: T) => boolean>(() => false);

  // --- Lista que se busca y pagina en el cliente (ListaLocal): reemplaza a filas/buscable/paginador/resaltarFila ---
  readonly lista = input<ListaParaTabla<T> | null>(null);

  protected readonly filasMostradas = computed(() => this.lista()?.filas() ?? this.filas());
  protected readonly esBuscable = computed(() => this.lista() !== null || this.buscable());
  protected readonly busquedaMostrada = computed(() => this.lista()?.busqueda() ?? this.busquedaInicial());
  protected readonly paginaMostrada = computed(() => this.lista()?.paginaActual() ?? this.pagina());
  protected readonly totalPaginasMostradas = computed(() => {
    const lista = this.lista();
    return lista ? lista.totalPaginas() : this.totalPaginas();
  });
  protected readonly totalElementosMostrados = computed(() => this.lista()?.totalElementos() ?? this.totalElementos());
  protected readonly tamanoMostrado = computed(() => this.lista()?.tamano() ?? this.tamano());
  protected readonly tamanosMostrados = computed(() => {
    const tamanos = this.tamanos();
    return this.lista() !== null && tamanos.length === 0 ? TAMANOS_PAGINA : tamanos;
  });
  protected readonly filaResaltada = computed<(fila: T) => boolean>(() => {
    const lista = this.lista();
    return lista ? (fila) => lista.esResaltada(fila) : this.resaltarFila();
  });
  /** Con una búsqueda activa que no encuentra nada, lo dice (en vez del vacío genérico de la tabla). */
  protected readonly mensajeSinFilas = computed(() => {
    const busqueda = this.lista()?.busqueda();
    return busqueda ? `Ningún resultado coincide con «${busqueda}».` : this.mensajeVacio();
  });

  protected buscarTexto(texto: string): void {
    const lista = this.lista();
    if (lista) lista.buscar(texto);
    else this.buscar.emit(texto);
  }

  protected irAPagina(pagina: number): void {
    const lista = this.lista();
    if (lista) lista.irA(pagina);
    else this.cambiarPagina.emit(pagina);
  }

  protected cambiarTamanoTabla(tamano: number): void {
    const lista = this.lista();
    if (lista) lista.cambiarTamano(tamano);
    else this.cambiarTamano.emit(tamano);
  }

  @ContentChild('celda', { read: TemplateRef }) celda?: TemplateRef<{ $implicit: T; columna: string }>;

  trackByFn(): (fila: T) => unknown {
    return this.identificarFila();
  }
}
