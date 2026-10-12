import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Dialog } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { UnidadResponse } from '../../../unidades/data-access/unidad.models';
import { UnidadesApi } from '../../../unidades/data-access/unidades.api';
import { RecepcionPlanta } from '../../data-access/recepcion.models';
import { RecepcionApi } from '../../data-access/recepcion.api';
import { RecepcionDetalleDialog } from '../../ui/recepcion-detalle-dialog/recepcion-detalle-dialog';

const TAMANO_PAGINA = 20;

@Component({
  selector: 'app-recepcion-page',
  imports: [DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recepcion-page.html',
  styleUrl: './recepcion-page.css',
})
export class RecepcionPage {
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

  constructor() {
    this.cargar();
  }

  protected placa(unidadId: string): string {
    return this.unidades().find((u) => u.id === unidadId)?.placa ?? unidadId;
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api
      .listar({
        page: this.pagina(),
        size: TAMANO_PAGINA,
        unidadId: this.filtroUnidad() || undefined,
        fecha: this.filtroFecha() || undefined,
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

  protected irAPagina(delta: number): void {
    const siguiente = this.pagina() + delta;
    if (siguiente < 0 || siguiente >= this.totalPaginas()) return;
    this.pagina.set(siguiente);
    this.cargar();
  }

  protected verDetalle(recepcion: RecepcionPlanta): void {
    this.dialog.open(RecepcionDetalleDialog, {
      ariaLabel: `Detalle de la recepción del ${recepcion.fecha}`,
      data: { recepcion, placa: this.placa(recepcion.unidadId) },
    });
  }
}
