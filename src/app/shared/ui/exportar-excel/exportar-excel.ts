import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { mapHttpError } from '../../../core/http/app-error';
import { DescargaArchivos } from '../../util/descarga-archivos';
import { ToastService } from '../toast/toast.service';
import { ExportacionExcelApi, FiltroExportacion } from './exportacion-excel.api';

/**
 * Botón «Exportar a Excel» único del sistema, para el espacio `[toolbar]` de `ui-data-table`.
 *
 * Pide al servidor el archivo de `recurso` con el MISMO filtro y búsqueda que muestra la tabla (`filtro`), de modo que el
 * Excel trae todas las filas que corresponden, no solo la página visible. El permiso lo valida el backend; ocultar o
 * mostrar el botón es solo comodidad.
 */
@Component({
  selector: 'ui-exportar-excel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="btn"
      [disabled]="exportando() || deshabilitado()"
      [attr.aria-busy]="exportando()"
      (click)="exportar()"
    >
      {{ exportando() ? 'Exportando…' : etiqueta() }}
    </button>
  `
})
export class ExportarExcelComponent {
  private readonly api = inject(ExportacionExcelApi);
  private readonly descarga = inject(DescargaArchivos);
  private readonly toast = inject(ToastService);

  /** Recurso del backend: `GET /exportaciones/{recurso}` (p. ej. `proveedores`). */
  readonly recurso = input.required<string>();
  /** Filtros y búsqueda vigentes de la tabla (los vacíos no se envían). */
  readonly filtro = input<FiltroExportacion>({});
  readonly etiqueta = input('Exportar a Excel');
  readonly deshabilitado = input(false);

  protected readonly exportando = signal(false);

  protected exportar(): void {
    if (this.exportando()) return;
    this.exportando.set(true);
    this.api.descargar(this.recurso(), this.filtro(), `${this.recurso()}.xlsx`).subscribe({
      next: ({ blob, nombre }) => {
        this.exportando.set(false);
        this.descarga.guardar(blob, nombre);
        this.toast.exito(`Se descargó ${nombre}.`);
      },
      error: (error) => {
        this.exportando.set(false);
        this.toast.error(mapHttpError(error).mensaje);
      }
    });
  }
}
