import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Observable, Subscription } from 'rxjs';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { ExportarExcelComponent } from '../../../../shared/ui/exportar-excel/exportar-excel';
import { ImportarExcelDialog } from '../../../../shared/ui/importar-excel/importar-excel-dialog';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { TAMANOS_PAGINA, TAMANO_PAGINA_POR_DEFECTO, paginaCorregida } from '../../../../shared/util/paginacion';
import { ZonaResponse } from '../../../catalogos/data-access/zona.models';
import { ZonasApi } from '../../../catalogos/data-access/zonas.api';
import { documentoResumen } from '../../data-access/documentos';
import { ProveedorAdminResponse } from '../../data-access/proveedor.models';
import { ProveedoresApi } from '../../data-access/proveedores.api';
import { CambiarZonaDialog } from '../../ui/cambiar-zona-dialog/cambiar-zona-dialog';
import { ProveedorDetalleDialog } from '../../ui/proveedor-detalle-dialog/proveedor-detalle-dialog';
import { ProveedorFormDialog } from '../../ui/proveedor-form-dialog/proveedor-form-dialog';

type FiltroEstado = 'TODOS' | 'ACTIVOS' | 'INACTIVOS';

@Component({
  selector: 'app-proveedores-page',
  imports: [DataTableComponent, ExportarExcelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './proveedores-page.html',
  styleUrl: './proveedores-page.css'
})
export class ProveedoresPage {
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly zonasApi = inject(ZonasApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly proveedores = signal<ProveedorAdminResponse[]>([]);
  protected readonly zonas = signal<ZonaResponse[]>([]);
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);

  protected readonly pagina = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  protected readonly tamanos = TAMANOS_PAGINA;
  protected readonly filtroZona = signal('');
  protected readonly filtroEstado = signal<FiltroEstado>('TODOS');
  /** Texto del buscador estándar (nombre, DNI, RUC o razón social): se envía al servidor y busca en todo el padrón, no en la página. */
  private readonly busquedaAplicada = signal('');
  private peticion?: Subscription;
  protected readonly codigoQrBuscado = signal('');
  /** Filtro y búsqueda vigentes: el Excel trae todas las filas que cumplen esto, no solo la página visible. */
  protected readonly filtroExportacion = computed(() => ({
    zonaId: this.filtroZona() || undefined,
    activo: this.filtroEstado() === 'TODOS' ? undefined : this.filtroEstado() === 'ACTIVOS',
    busqueda: this.busquedaAplicada() || undefined
  }));

  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'nombre', etiqueta: 'Proveedor' },
    { clave: 'documento', etiqueta: 'DNI / RUC' },
    { clave: 'zonaActualNombre', etiqueta: 'Zona actual' },
    { clave: 'telefono', etiqueta: 'Teléfono' },
    { clave: 'estado', etiqueta: 'Estado' },
    { clave: 'acciones', etiqueta: '' }
  ];

  /** Fase G: una persona natural puede tener DNI y RUC; una empresa solo RUC. */
  protected documento(proveedor: ProveedorAdminResponse): string {
    return documentoResumen(proveedor);
  }

  constructor() {
    this.zonasApi.listarAdmin().subscribe({ next: (z) => this.zonas.set(z), error: () => undefined });
    this.cargar();
  }

  protected cargar(): void {
    this.peticion?.unsubscribe();
    this.cargando.set(true);
    this.error.set(null);
    this.peticion = this.proveedoresApi
      .listar({
        page: this.pagina(),
        size: this.tamano(),
        zonaId: this.filtroZona() || undefined,
        activo: this.filtroEstado() === 'TODOS' ? undefined : this.filtroEstado() === 'ACTIVOS',
        busqueda: this.busquedaAplicada() || undefined
      })
      .subscribe({
        next: (respuesta) => {
          const corregida = paginaCorregida(respuesta);
          if (corregida !== null) {
            this.pagina.set(corregida);
            this.cargar();
            return;
          }
          this.proveedores.set(respuesta.contenido);
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

  protected buscar(texto: string): void {
    this.busquedaAplicada.set(texto);
    this.pagina.set(0);
    this.cargar();
  }

  protected cambiarFiltroZona(zonaId: string): void {
    this.filtroZona.set(zonaId);
    this.pagina.set(0);
    this.cargar();
  }

  protected cambiarFiltroEstado(estado: FiltroEstado): void {
    this.filtroEstado.set(estado);
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

  protected buscarPorQr(): void {
    const codigo = this.codigoQrBuscado().trim();
    if (!codigo) return;
    this.proveedoresApi.obtenerPorCodigoQr(codigo).subscribe({
      next: (publico) => this.proveedoresApi.obtener(publico.id).subscribe({
        next: (proveedor) => this.abrirDetalle(proveedor),
        error: (error) => this.toast.error(mapHttpError(error).mensaje)
      }),
      error: (error) => this.toast.error(mapHttpError(error).mensaje)
    });
  }

  protected nuevoProveedor(): void {
    const ref = this.dialog.open<ProveedorAdminResponse | undefined>(ProveedorFormDialog, {
      ariaLabel: 'Nuevo proveedor',
      data: { zonas: this.zonas() }
    });
    ref.closed.subscribe((proveedor) => {
      if (proveedor) {
        this.toast.exito(`Proveedor "${proveedor.nombre}" creado.`);
        this.cargar();
      }
    });
  }

  /** Importa el padrón desde la plantilla oficial de Excel (vista previa + confirmación; solo crea, nunca actualiza). */
  protected importarExcel(): void {
    const ref = this.dialog.open<number | undefined>(ImportarExcelDialog, {
      ariaLabel: 'Importar proveedores desde Excel',
      data: { tipo: 'proveedores', nombre: 'proveedores' }
    });
    ref.closed.subscribe((creados) => {
      if (creados) {
        this.toast.exito(`Se importaron ${creados} ${creados === 1 ? 'proveedor' : 'proveedores'}.`);
        this.pagina.set(0);
        this.cargar();
      }
    });
  }

  protected editar(proveedor: ProveedorAdminResponse): void {
    const ref = this.dialog.open<ProveedorAdminResponse | undefined>(ProveedorFormDialog, {
      ariaLabel: 'Editar proveedor',
      data: { zonas: this.zonas(), proveedor }
    });
    ref.closed.subscribe((actualizado) => {
      if (actualizado) {
        this.toast.exito(`Proveedor "${actualizado.nombre}" actualizado.`);
        this.cargar();
      }
    });
  }

  protected cambiarZona(proveedor: ProveedorAdminResponse): void {
    const ref = this.dialog.open<ProveedorAdminResponse | undefined>(CambiarZonaDialog, {
      ariaLabel: 'Cambiar zona',
      data: { proveedor, zonas: this.zonas() }
    });
    ref.closed.subscribe((actualizado) => {
      if (actualizado) {
        this.toast.exito(`Zona de "${actualizado.nombre}" actualizada.`);
        this.cargar();
      }
    });
  }

  protected abrirDetalle(proveedor: ProveedorAdminResponse): void {
    this.dialog.open(ProveedorDetalleDialog, {
      ariaLabel: `Detalle de ${proveedor.nombre}`,
      data: { proveedor }
    });
  }

  protected alternarEstado(proveedor: ProveedorAdminResponse): void {
    const activar = !proveedor.activo;
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      ariaLabel: activar ? 'Reactivar proveedor' : 'Desactivar proveedor',
      data: {
        titulo: activar ? 'Reactivar proveedor' : 'Desactivar proveedor',
        mensaje: activar
          ? `"${proveedor.nombre}" volverá a estar disponible para acopio.`
          : `"${proveedor.nombre}" dejará de estar disponible para acopio hasta reactivarlo.`,
        etiquetaConfirmar: activar ? 'Reactivar' : 'Desactivar',
        peligroso: !activar
      }
    });
    ref.closed.subscribe((confirmado) => {
      if (!confirmado) return;
      const peticion: Observable<unknown> = activar
        ? this.proveedoresApi.reactivar(proveedor.id)
        : this.proveedoresApi.desactivar(proveedor.id);
      peticion.subscribe({
        next: () => {
          this.toast.exito(activar ? 'Proveedor reactivado.' : 'Proveedor desactivado.');
          this.cargar();
        },
        error: (error) => this.toast.error(mapHttpError(error).mensaje)
      });
    });
  }
}
