import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Dialog } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { JornadaBandeja } from '../../data-access/jornada.models';
import { JornadasApi } from '../../data-access/jornadas.api';
import { ListaLocal } from '../../../../shared/util/lista-local';
import { JornadaDetalleDialog } from '../../ui/jornada-detalle-dialog/jornada-detalle-dialog';

@Component({
  selector: 'app-jornadas-page',
  imports: [DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './jornadas-page.html',
  styleUrl: './jornadas-page.css',
})
export class JornadasPage {
  private readonly api = inject(JornadasApi);
  private readonly dialog = inject(Dialog);
  private readonly destroy = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly jornadas = signal<JornadaBandeja[]>([]);

  /**
   * La bandeja llega completa y en el orden de llegada a planta (el mismo contrato que usa la app móvil): se busca y se
   * pagina en el cliente sin reordenar.
   */
  protected readonly lista = new ListaLocal(this.jornadas, {
    campos: (j) => [j.acopiadorNombre, j.unidadPlaca],
    id: (j) => j.id,
    destroyRef: this.destroy
  });

  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'acopiadorNombre', etiqueta: 'Acopiador' },
    { clave: 'unidadPlaca', etiqueta: 'Vehículo' },
    { clave: 'horaInicio', etiqueta: 'Inicio' },
    { clave: 'cantidadProveedores', etiqueta: 'Proveedores', alinearFin: true },
    { clave: 'litrosEsperados', etiqueta: 'Litros esperados', alinearFin: true },
    { clave: 'acciones', etiqueta: '' },
  ];

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api
      .listarBandeja()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.jornadas.set(r);
          this.cargando.set(false);
        },
        error: (e) => {
          this.error.set(mapHttpError(e));
          this.cargando.set(false);
        },
      });
  }

  protected verDetalle(jornada: JornadaBandeja): void {
    this.dialog.open(JornadaDetalleDialog, {
      ariaLabel: `Detalle de la jornada de ${jornada.acopiadorNombre}`,
      data: { id: jornada.id },
    });
  }
}
