import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { Subscription } from 'rxjs';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { paginaCorregida } from '../../../../shared/util/paginacion';
import { COLOR_ESTADO, ESTADOS_FILTRABLES, ETIQUETAS_ESTADO } from '../../data-access/reserva.etiquetas';
import { EstadoReserva, ReservaResumenResponse } from '../../data-access/reserva.models';
import { ReservasApi } from '../../data-access/reservas.api';
import { ReservaDetalleDialog } from '../../ui/reserva-detalle-dialog/reserva-detalle-dialog';

const TAMANO_PAGINA = 20;

/** Estados que se resumen arriba como contadores de atajo (el total lo informa el servidor, no se suma aquí). */
const ESTADOS_RESUMEN: EstadoReserva[] = ['PENDIENTE', 'CONFIRMADA', 'VENCIDA'];

/**
 * Panel de reservas (VENTAS y ADMIN). Listado paginado y filtrado en el servidor; cada fila abre el detalle, donde
 * se gestionan las acciones. Los contadores salen de consultas al servidor (total por estado), nunca de sumar la página.
 */
@Component({
  selector: 'app-reservas-page',
  imports: [DataTableComponent, DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reservas-page.html',
  styleUrl: './reservas-page.css'
})
export class ReservasPage {
  private readonly api = inject(ReservasApi);
  private readonly dialog = inject(Dialog);
  private consulta?: Subscription;
  private readonly consultasResumen: Subscription[] = [];

  protected readonly estadosFiltrables = ESTADOS_FILTRABLES;
  protected readonly estadosResumen = ESTADOS_RESUMEN;

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly reservas = signal<ReservaResumenResponse[]>([]);
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);
  protected readonly pagina = signal(0);

  protected readonly filtroEstado = signal<EstadoReserva | ''>('');
  protected readonly filtroFecha = signal('');
  protected readonly filtroTelefono = signal('');
  protected readonly filtroCodigo = signal('');
  protected readonly hayFiltros = computed(
    () => !!(this.filtroEstado() || this.filtroFecha() || this.filtroTelefono().trim() || this.filtroCodigo().trim())
  );

  /** Total por estado informado por el servidor; null = aún no cargado o falló (se muestra «—»). */
  protected readonly totales = signal<Partial<Record<EstadoReserva, number | null>>>({});

  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'codigo', etiqueta: 'Código' },
    { clave: 'cliente', etiqueta: 'Cliente' },
    { clave: 'fechaRetiro', etiqueta: 'Retiro' },
    { clave: 'estado', etiqueta: 'Estado' },
    { clave: 'unidades', etiqueta: 'Unidades', alinearFin: true },
    { clave: 'total', etiqueta: 'Total', alinearFin: true },
    { clave: 'acciones', etiqueta: '' }
  ];
  protected readonly identificarFila = (fila: ReservaResumenResponse) => fila.id;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.consulta?.unsubscribe();
      this.consultasResumen.forEach((s) => s.unsubscribe());
    });
    this.cargar();
    this.cargarResumen();
  }

  protected cargar(): void {
    this.consulta?.unsubscribe();
    this.cargando.set(true);
    this.error.set(null);
    this.consulta = this.api
      .listar({
        page: this.pagina(),
        size: TAMANO_PAGINA,
        estado: this.filtroEstado() || undefined,
        fechaRetiro: this.filtroFecha() || undefined,
        telefono: this.filtroTelefono(),
        codigo: this.filtroCodigo()
      })
      .subscribe({
        next: (respuesta) => {
          const corregida = paginaCorregida(respuesta);
          if (corregida !== null) {
            this.pagina.set(corregida);
            this.cargar();
            return;
          }
          this.reservas.set(respuesta.contenido);
          this.totalElementos.set(respuesta.totalElementos);
          this.totalPaginas.set(respuesta.totalPaginas);
          this.cargando.set(false);
        },
        error: (error) => {
          this.error.set(mapHttpError(error));
          this.cargando.set(false);
        }
      });
  }

  /** Un contador por estado de atajo; cada uno falla de forma independiente sin tumbar el listado. */
  protected cargarResumen(): void {
    this.consultasResumen.splice(0).forEach((s) => s.unsubscribe());
    for (const estado of ESTADOS_RESUMEN) {
      this.consultasResumen.push(
        this.api.listar({ estado, page: 0, size: 1 }).subscribe({
          next: (r) => this.totales.update((t) => ({ ...t, [estado]: r.totalElementos })),
          error: () => this.totales.update((t) => ({ ...t, [estado]: null }))
        })
      );
    }
  }

  protected total(estado: EstadoReserva): string {
    const valor = this.totales()[estado];
    return valor === undefined || valor === null ? '—' : String(valor);
  }

  // -------------------------------------------------------------------------------- filtros

  protected cambiarEstado(valor: string): void {
    this.filtroEstado.set(valor as EstadoReserva | '');
    this.aplicarFiltros();
  }

  protected cambiarFecha(valor: string): void {
    this.filtroFecha.set(valor);
    this.aplicarFiltros();
  }

  protected cambiarTelefono(valor: string): void {
    this.filtroTelefono.set(valor);
    this.aplicarFiltros();
  }

  protected cambiarCodigo(valor: string): void {
    this.filtroCodigo.set(valor.trim().toUpperCase());
    this.aplicarFiltros();
  }

  /** Atajo de los contadores: filtra por ese estado (o quita el filtro si ya estaba activo). */
  protected alternarEstado(estado: EstadoReserva): void {
    this.cambiarEstado(this.filtroEstado() === estado ? '' : estado);
  }

  protected limpiarFiltros(): void {
    this.filtroEstado.set('');
    this.filtroFecha.set('');
    this.filtroTelefono.set('');
    this.filtroCodigo.set('');
    this.aplicarFiltros();
  }

  private aplicarFiltros(): void {
    this.pagina.set(0);
    this.cargar();
  }

  protected irAPagina(delta: number): void {
    const siguiente = this.pagina() + delta;
    if (siguiente < 0 || siguiente >= this.totalPaginas()) return;
    this.pagina.set(siguiente);
    this.cargar();
  }

  // -------------------------------------------------------------------------------- presentación

  protected etiquetaEstado(estado: EstadoReserva): string {
    return ETIQUETAS_ESTADO[estado];
  }

  protected colorEstado(estado: EstadoReserva): string {
    return COLOR_ESTADO[estado];
  }

  protected abrirDetalle(id: string): void {
    const ref = this.dialog.open<boolean>(ReservaDetalleDialog, {
      ariaLabel: 'Detalle de reserva',
      data: { id }
    });
    ref.closed.subscribe((huboCambios) => {
      if (!huboCambios) return;
      this.cargar(); // conserva filtros y página
      this.cargarResumen();
    });
  }
}
