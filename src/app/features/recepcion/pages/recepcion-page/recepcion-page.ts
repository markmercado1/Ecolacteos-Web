import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { TAMANOS_PAGINA, TAMANO_PAGINA_POR_DEFECTO } from '../../../../shared/util/paginacion';
import { Dialog } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { UnidadResponse } from '../../../unidades/data-access/unidad.models';
import { UnidadesApi } from '../../../unidades/data-access/unidades.api';
import { RecepcionPlanta } from '../../data-access/recepcion.models';
import { RecepcionApi } from '../../data-access/recepcion.api';
import { RecepcionDetalleDialog } from '../../ui/recepcion-detalle-dialog/recepcion-detalle-dialog';
import { ExportarExcelComponent } from '../../../../shared/ui/exportar-excel/exportar-excel';
import { formatearFecha } from '../../../../shared/util/fecha';


@Component({
  selector: 'app-recepcion-page',
  imports: [ExportarExcelComponent, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recepcion-page.html',
  styleUrl: './recepcion-page.css',
})
export class RecepcionPage {
  protected readonly formatearFecha = formatearFecha;
  private readonly api = inject(RecepcionApi);
  private readonly unidadesApi = inject(UnidadesApi);
  private readonly dialog = inject(Dialog);
  private readonly destroy = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly recepciones = signal<RecepcionPlanta[]>([]);
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);
  protected readonly pagina = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  protected readonly tamanos = TAMANOS_PAGINA;
  /** Texto del buscador estándar (placa o responsable): se envía al servidor y busca entre todas las recepciones. */
  private readonly busquedaAplicada = signal('');
  private peticion?: Subscription;
  protected readonly filtroFecha = signal('');
  protected readonly filtroUnidad = signal('');

  /** GET /api/unidades/operativo: accesible a RECEPCION, a diferencia de /api/admin/unidades (solo ADMIN). */
  protected readonly unidades = toSignal(this.unidadesApi.listarOperativo(), { initialValue: [] as UnidadResponse[] });

  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'fecha', etiqueta: 'Fecha' },
    { clave: 'unidad', etiqueta: 'Unidad' },
    { clave: 'litrosCampo', etiqueta: 'Litros campo', alinearFin: true },
    { clave: 'litrosPlanta', etiqueta: 'Litros planta', alinearFin: true },
    { clave: 'diferencia', etiqueta: 'Diferencia', alinearFin: true },
    { clave: 'estado', etiqueta: 'Estado' },
    { clave: 'acciones', etiqueta: '' },
  ];

  /** Filtros y búsqueda vigentes: el Excel trae todas las recepciones que los cumplen, no solo la página visible. */
  protected readonly filtroExportacion = computed(() => ({ unidadId: this.filtroUnidad() || undefined, fecha: this.filtroFecha() || undefined, busqueda: this.busquedaAplicada() || undefined }));

  constructor() {
    this.cargar();
  }

  protected placa(unidadId: string): string {
    return this.unidades().find((u) => u.id === unidadId)?.placa ?? unidadId;
  }

  protected cargar(): void {
    this.peticion?.unsubscribe();
    this.cargando.set(true);
    this.error.set(null);
    this.peticion = this.api
      .listar({
        page: this.pagina(),
        size: this.tamano(),
        unidadId: this.filtroUnidad() || undefined,
        fecha: this.filtroFecha() || undefined,
        busqueda: this.busquedaAplicada() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.recepciones.set(r.contenido);
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

  protected cambiarFiltroFecha(fecha: string): void {
    this.filtroFecha.set(fecha);
    this.pagina.set(0);
    this.cargar();
  }

  protected cambiarFiltroUnidad(unidadId: string): void {
    this.filtroUnidad.set(unidadId);
    this.pagina.set(0);
    this.cargar();
  }

  protected buscar(texto: string): void {
    this.busquedaAplicada.set(texto);
    this.pagina.set(0);
    this.cargar();
  }

  protected cambiarPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginas()) return;
    this.pagina.set(pagina);
    this.cargar();
  }

  protected cambiarTamano(tamano: number): void {
    this.tamano.set(tamano);
    this.pagina.set(0);
    this.cargar();
  }

  protected verDetalle(recepcion: RecepcionPlanta): void {
    this.dialog.open(RecepcionDetalleDialog, {
      ariaLabel: `Detalle de la recepción del ${recepcion.fecha}`,
      data: { recepcion, placa: this.placa(recepcion.unidadId) },
    });
  }
}
