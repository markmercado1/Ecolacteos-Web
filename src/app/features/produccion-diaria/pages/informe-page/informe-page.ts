import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { Subscription } from 'rxjs';
import { TAMANOS_PAGINA, TAMANO_PAGINA_POR_DEFECTO } from '../../../../shared/util/paginacion';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { fechaHoyLima } from '../../../../shared/util/fecha';
import { InformeProduccionDiario } from '../../data-access/informe-produccion.models';
import { FiltroInformes, InformesProduccionApi } from '../../data-access/informes-produccion.api';
import { InformeDetalleDialog } from '../../ui/informe-detalle-dialog/informe-detalle-dialog';
import { InformeFormDialog } from '../../ui/informe-form-dialog/informe-form-dialog';
import { ExportarExcelComponent } from '../../../../shared/ui/exportar-excel/exportar-excel';


/**
 * Virtualiza el cuadro en papel "INFORME DE PRODUCCION DE QUESOS DIARIO" (área de producción). Página =
 * lista (historial paginado) + acciones explícitas, mismo patrón que Lotes de Producción
 * (features/produccion/pages/lotes-page): "Registrar informe de hoy" abre InformeFormDialog en modo crear,
 * "Editar" en una fila del historial lo abre en modo editar. Crear/editar SIEMPRE viven en el diálogo, nunca
 * en un formulario embebido en la página -- así se evita el bug de UX reportado: un formulario embebido que
 * se autocargaba en modo edición apenas existía el informe de hoy, quedando "enganchado" ahí sin que el
 * usuario lo pidiera, y reenviando PUT en cada click de "Guardar cambios".
 */
@Component({
  selector: 'app-informe-page',
  imports: [ExportarExcelComponent, DataTableComponent, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './informe-page.html',
  styleUrl: './informe-page.css'
})
export class InformePage {
  private readonly api = inject(InformesProduccionApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);
  private readonly destroy = inject(DestroyRef);

  protected readonly hoy = fechaHoyLima;

  // Se consulta una sola vez al entrar (y se refresca tras cualquier guardado) solo para saber si el botón
  // "Registrar informe de hoy" debe estar habilitado -- nunca alimenta un formulario embebido en la página.
  protected readonly cargandoInformeDeHoy = signal(true);
  protected readonly informeDeHoy = signal<InformeProduccionDiario | null>(null);
  private peticionInformeDeHoy?: Subscription;

  protected readonly cargandoHistorial = signal(true);
  protected readonly errorHistorial = signal<AppError | null>(null);
  protected readonly historial = signal<InformeProduccionDiario[]>([]);
  protected readonly paginaHistorial = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  protected readonly tamanos = TAMANOS_PAGINA;
  /** Texto del buscador estándar (responsable): se envía al servidor y busca entre todos los informes. */
  private readonly busquedaAplicada = signal('');
  protected readonly totalPaginasHistorial = signal(0);
  protected readonly totalElementosHistorial = signal(0);
  private peticionHistorial?: Subscription;

  protected readonly columnasHistorial: ColumnaTabla[] = [
    { clave: 'fecha', etiqueta: 'Fecha' },
    { clave: 'quesosDiarios', etiqueta: 'Diarios', alinearFin: true },
    { clave: 'quesosReparados', etiqueta: 'Reparados', alinearFin: true },
    { clave: 'quesosDeRecorte', etiqueta: 'De recorte', alinearFin: true },
    { clave: 'totalQuesos', etiqueta: 'Total', alinearFin: true },
    { clave: 'recorteEnKilos', etiqueta: 'Recorte (kg)', alinearFin: true },
    { clave: 'acciones', etiqueta: '' }
  ];

  /** Búsqueda vigente: el Excel trae todos los informes que la cumplen, no solo la página visible. */
  protected readonly filtroExportacion = computed(() => ({ busqueda: this.busquedaAplicada() || undefined }));

  constructor() {
    this.cargarInformeDeHoy();
    this.cargarHistorial();
  }

  protected esHoy(fecha: string): boolean {
    return fecha === this.hoy();
  }

  protected cargarInformeDeHoy(): void {
    this.peticionInformeDeHoy?.unsubscribe();
    this.cargandoInformeDeHoy.set(true);
    this.peticionInformeDeHoy = this.api
      .obtenerPorFecha(this.hoy())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (informe) => {
          this.informeDeHoy.set(informe);
          this.cargandoInformeDeHoy.set(false);
        },
        error: (e) => {
          // 404 = todavía no hay informe hoy (esperado, no es un error real). Cualquier otro código se
          // ignora acá para no bloquear el resto de la página -- el botón "Registrar" simplemente asume
          // que se puede intentar; si algo va mal en serio, el diálogo lo va a mostrar al guardar.
          if (mapHttpError(e).status === 404) this.informeDeHoy.set(null);
          this.cargandoInformeDeHoy.set(false);
        }
      });
  }

  protected cargarHistorial(): void {
    this.peticionHistorial?.unsubscribe();
    this.cargandoHistorial.set(true);
    this.errorHistorial.set(null);
    const filtro: FiltroInformes = { page: this.paginaHistorial(), size: this.tamano(), busqueda: this.busquedaAplicada() || undefined };
    this.peticionHistorial = this.api
      .listar(filtro)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.historial.set(r.contenido);
          this.totalElementosHistorial.set(r.totalElementos);
          this.totalPaginasHistorial.set(r.totalPaginas);
          this.cargandoHistorial.set(false);
        },
        error: (e) => {
          this.errorHistorial.set(mapHttpError(e));
          this.cargandoHistorial.set(false);
        }
      });
  }

  protected buscar(texto: string): void {
    this.busquedaAplicada.set(texto);
    this.paginaHistorial.set(0);
    this.cargarHistorial();
  }

  protected cambiarPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginasHistorial()) return;
    this.paginaHistorial.set(pagina);
    this.cargarHistorial();
  }

  protected cambiarTamano(tamano: number): void {
    this.tamano.set(tamano);
    this.paginaHistorial.set(0);
    this.cargarHistorial();
  }

  protected registrarInformeDeHoy(): void {
    const ref = this.dialog.open<InformeProduccionDiario | undefined>(InformeFormDialog, {
      ariaLabel: 'Registrar informe de hoy',
      data: {}
    });
    ref.closed.subscribe((informe) => {
      if (!informe) return;
      this.toast.exito(`Informe del ${informe.fecha} registrado.`);
      this.informeDeHoy.set(informe);
      this.paginaHistorial.set(0);
      this.cargarHistorial();
    });
  }

  protected editarInforme(informe: InformeProduccionDiario): void {
    const ref = this.dialog.open<InformeProduccionDiario | undefined>(InformeFormDialog, {
      ariaLabel: `Editar informe del ${informe.fecha}`,
      data: { informe }
    });
    ref.closed.subscribe((actualizado) => {
      if (!actualizado) return;
      this.toast.exito(`Informe del ${actualizado.fecha} actualizado.`);
      this.informeDeHoy.set(actualizado);
      this.cargarHistorial();
    });
  }

  protected verDetalle(informe: InformeProduccionDiario): void {
    this.dialog.open(InformeDetalleDialog, {
      ariaLabel: `Informe del ${informe.fecha}`,
      data: { informe }
    });
  }
}
