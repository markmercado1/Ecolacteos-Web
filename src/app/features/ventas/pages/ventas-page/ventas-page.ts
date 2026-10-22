import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Subscription } from 'rxjs';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { TAMANOS_PAGINA, TAMANO_PAGINA_POR_DEFECTO } from '../../../../shared/util/paginacion';
import { TipoClienteVenta, VentaResumenResponse } from '../../data-access/venta.models';
import { VentasApi } from '../../data-access/ventas.api';
import { VentaDetalleDialog } from '../../ui/venta-detalle-dialog/venta-detalle-dialog';
import { VentaFormDialog, VentaFormDialogResultado } from '../../ui/venta-form-dialog/venta-form-dialog';

@Component({
  selector: 'app-ventas-page',
  imports: [DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ventas-page.html',
  styleUrl: './ventas-page.css'
})
export class VentasPage {
  private readonly ventasApi = inject(VentasApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly ventas = signal<VentaResumenResponse[]>([]);
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);

  protected readonly pagina = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  protected readonly tamanos = TAMANOS_PAGINA;
  /** Texto del buscador estándar (vendedor, producto o presentación): se envía al servidor y busca entre todas las ventas. */
  private readonly busquedaAplicada = signal('');
  private peticion?: Subscription;
  protected readonly filtroFecha = signal('');
  protected readonly filtroTipoCliente = signal<TipoClienteVenta | ''>('');

  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'fecha', etiqueta: 'Fecha' },
    { clave: 'canal', etiqueta: 'Canal' },
    { clave: 'lineas', etiqueta: 'Líneas' },
    { clave: 'total', etiqueta: 'Total', alinearFin: true },
    { clave: 'acciones', etiqueta: '' }
  ];

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.peticion?.unsubscribe();
    this.cargando.set(true);
    this.error.set(null);
    this.peticion = this.ventasApi
      .listar({
        page: this.pagina(),
        size: this.tamano(),
        fecha: this.filtroFecha() || undefined,
        tipoCliente: this.filtroTipoCliente() || undefined,
        busqueda: this.busquedaAplicada() || undefined
      })
      .subscribe({
        next: (respuesta) => {
          this.ventas.set(respuesta.contenido);
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

  protected cambiarFiltroFecha(fecha: string): void {
    this.filtroFecha.set(fecha);
    this.pagina.set(0);
    this.cargar();
  }

  protected cambiarFiltroTipoCliente(valor: string): void {
    this.filtroTipoCliente.set(valor as TipoClienteVenta | '');
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

  protected etiquetaCanal(canal: TipoClienteVenta): string {
    switch (canal) {
      case 'MAYORISTA':
        return 'Mayorista';
      case 'PROVEEDOR':
        return 'Proveedor';
      case 'PUBLICO':
        return 'Público';
    }
  }

  /** Resumen corto de las líneas para la fila de la tabla (el detalle completo está a un clic, en "Ver detalle"). */
  protected resumenLineas(venta: VentaResumenResponse): string {
    if (venta.detalles.length === 1) {
      const l = venta.detalles[0];
      return `${l.cantidad} × ${l.presentacionNombre}`;
    }
    return `${venta.detalles.length} líneas`;
  }

  protected nuevaVenta(): void {
    const ref = this.dialog.open<VentaFormDialogResultado | undefined>(VentaFormDialog, {
      ariaLabel: 'Registrar venta'
    });
    ref.closed.subscribe((resultado) => {
      if (!resultado) return;
      this.toast.exito(`Venta registrada. Total: S/ ${resultado.venta.total.toFixed(2)}.`);
      this.pagina.set(0);
      this.cargar();
      if (resultado.verDetalle) {
        this.abrirDetalle(resultado.venta.id);
      }
    });
  }

  protected abrirDetalle(id: string): void {
    this.dialog.open(VentaDetalleDialog, {
      ariaLabel: 'Detalle de venta',
      data: { id }
    });
  }
}
