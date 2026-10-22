import { DestroyRef, Signal, computed, signal } from '@angular/core';
import type { ListaParaTabla } from '../ui/data-table/data-table';
import { TAMANO_PAGINA_POR_DEFECTO } from './paginacion';
import { contieneTexto } from './texto';

export interface OpcionesListaLocal<T> {
  /** Textos de cada fila en los que busca el buscador (nombre, placa, etc.). */
  campos: (fila: T) => (string | null | undefined)[];
  /** Identificador estable de la fila (para resaltarla al crearla). */
  id: (fila: T) => string;
  tamano?: number;
  destroyRef?: DestroyRef;
}

/** Cuánto dura el resaltado de la fila recién creada. */
export const MS_RESALTADO_FILA = 4000;

/**
 * Búsqueda + paginación en el cliente para las listas que el backend entrega completas y que son pequeñas por
 * naturaleza: los catálogos (zonas, motivos, familias, productos, insumos, recetas), las unidades y la bandeja de
 * jornadas pendientes. Busca sobre TODO el conjunto cargado (no solo la página visible), sin distinguir mayúsculas ni
 * acentos, igual que la búsqueda del servidor en las tablas grandes. No reordena: respeta el orden de la fuente
 * (alfabético en los catálogos).
 *
 * `revelar(id)` lleva la tabla a la página donde está una fila y la resalta unos segundos: así un registro recién creado
 * (que en orden alfabético cae en cualquier página) no se pierde.
 */
export class ListaLocal<T> implements ListaParaTabla<T> {
  readonly busqueda = signal('');
  readonly pagina = signal(0);
  readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  readonly resaltadoId = signal<string | null>(null);

  readonly filtradas = computed(() => {
    const termino = this.busqueda();
    const filas = this.fuente();
    return termino === '' ? filas : filas.filter((f) => this.opciones.campos(f).some((c) => contieneTexto(c, termino)));
  });
  readonly totalElementos = computed(() => this.filtradas().length);
  readonly totalPaginas = computed(() => Math.ceil(this.totalElementos() / this.tamano()));
  /** Página efectiva: nunca fuera de rango aunque la lista se haya reducido (al desactivar, buscar, etc.). */
  readonly paginaActual = computed(() => Math.min(this.pagina(), Math.max(this.totalPaginas() - 1, 0)));
  readonly filas = computed(() => {
    const inicio = this.paginaActual() * this.tamano();
    return this.filtradas().slice(inicio, inicio + this.tamano());
  });

  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly fuente: Signal<T[]>,
    private readonly opciones: OpcionesListaLocal<T>
  ) {
    if (opciones.tamano) this.tamano.set(opciones.tamano);
    opciones.destroyRef?.onDestroy(() => clearTimeout(this.temporizador));
  }

  /** Aplica el texto del buscador y vuelve a la primera página. */
  buscar(texto: string): void {
    this.busqueda.set(texto.trim());
    this.pagina.set(0);
  }

  irA(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginas()) return;
    this.pagina.set(pagina);
  }

  cambiarTamano(tamano: number): void {
    this.tamano.set(tamano);
    this.pagina.set(0);
  }

  esResaltada = (fila: T): boolean => this.resaltadoId() !== null && this.opciones.id(fila) === this.resaltadoId();

  /**
   * Muestra la fila `id` (quita la búsqueda si la estaba ocultando, va a su página) y la resalta unos segundos.
   * Llamar DESPUÉS de que la fuente ya contenga la fila.
   */
  revelar(id: string): void {
    let indice = this.filtradas().findIndex((f) => this.opciones.id(f) === id);
    if (indice === -1 && this.busqueda() !== '') {
      this.busqueda.set('');
      indice = this.filtradas().findIndex((f) => this.opciones.id(f) === id);
    }
    if (indice === -1) return;
    this.pagina.set(Math.floor(indice / this.tamano()));
    this.resaltadoId.set(id);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.resaltadoId.set(null), MS_RESALTADO_FILA);
  }
}
