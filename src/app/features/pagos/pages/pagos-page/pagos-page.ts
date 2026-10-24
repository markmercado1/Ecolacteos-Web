import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { ExportarExcelComponent } from '../../../../shared/ui/exportar-excel/exportar-excel';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { paginaCorregida, TAMANOS_PAGINA, TAMANO_PAGINA_POR_DEFECTO } from '../../../../shared/util/paginacion';
import { ProveedorPublicoResponse } from '../../../proveedores/data-access/proveedor.models';
import { ProveedoresApi } from '../../../proveedores/data-access/proveedores.api';
import { AjustePagoResponse, PagoResponse, pagoAjustado, pagoConAjusteDeCalidad, puedeVerHistorialDeCalidad } from '../../data-access/pago.models';
import { PagosApi } from '../../data-access/pagos.api';
import { GenerarPagoDialog } from '../../ui/generar-pago-dialog/generar-pago-dialog';
import { PagoDetalleDialog } from '../../ui/pago-detalle-dialog/pago-detalle-dialog';
import { HistorialConsolidadoDialog } from '../../../historial-proveedor/ui/historial-consolidado-dialog/historial-consolidado-dialog';

type Pestana = 'liquidaciones' | 'ajustes';

@Component({
  selector: 'app-pagos-page',
  imports: [DecimalPipe, DataTableComponent, ExportarExcelComponent, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pagos-page.html',
  styleUrl: './pagos-page.css'
})
export class PagosPage {
  private readonly pagosApi = inject(PagosApi);
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly esAdmin = computed(() => this.auth.usuario()?.rolNombre === 'ADMIN');
  protected readonly pestana = signal<Pestana>('liquidaciones');

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly pagos = signal<PagoResponse[]>([]);
  protected readonly pagina = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  protected readonly tamanos = TAMANOS_PAGINA;
  /** Texto del buscador estándar (proveedor, DNI, RUC o razón social): se envía al servidor y busca entre todos los pagos. */
  private readonly busquedaAplicada = signal('');
  /** Búsqueda vigente: el Excel trae todos los pagos que la cumplen, no solo la página visible. */
  protected readonly filtroExportacion = computed(() => ({ busqueda: this.busquedaAplicada() || undefined }));
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);
  private peticion?: Subscription;

  protected readonly proveedores = toSignal(this.proveedoresApi.listarOperativo(), {
    initialValue: [] as ProveedorPublicoResponse[]
  });
  protected readonly proveedorAjustes = signal('');
  protected readonly cargandoAjustes = signal(false);
  protected readonly errorAjustes = signal<AppError | null>(null);
  protected readonly ajustesPendientes = signal<AjustePagoResponse[]>([]);
  protected readonly consultado = signal(false);

  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'proveedorNombre', etiqueta: 'Proveedor / pago' },
    { clave: 'semana', etiqueta: 'Semana' },
    { clave: 'litrosTotales', etiqueta: 'Litros liquidados', alinearFin: true },
    { clave: 'total', etiqueta: 'Importe', alinearFin: true },
    { clave: 'comprobante', etiqueta: 'Comprobante' },
    { clave: 'acciones', etiqueta: '' }
  ];

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.peticion?.unsubscribe();
    this.cargando.set(true);
    this.error.set(null);
    this.peticion = this.pagosApi.listar({ page: this.pagina(), size: this.tamano(), busqueda: this.busquedaAplicada() || undefined }).subscribe({
      next: (respuesta) => {
        const corregida = paginaCorregida(respuesta);
        if (corregida !== null) {
          this.pagina.set(corregida);
          this.cargar();
          return;
        }
        this.pagos.set(respuesta.contenido);
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

  protected conCalidad(pago: PagoResponse): boolean {
    return pagoConAjusteDeCalidad(pago);
  }

  protected ajustado(pago: PagoResponse): boolean {
    return pagoAjustado(pago);
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

  protected generarPago(): void {
    const ref = this.dialog.open<PagoResponse | undefined>(GenerarPagoDialog, {
      ariaLabel: 'Generar liquidación',
      data: { proveedores: this.proveedores() }
    });
    ref.closed.subscribe((pago) => {
      if (pago) {
        this.toast.exito(`Pago de "${pago.proveedorNombre}" generado.`);
        this.pagina.set(0);
        this.cargar();
      }
    });
  }

  protected verDetalle(pago: PagoResponse): void {
    const ref = this.dialog.open<boolean>(PagoDetalleDialog, {
      ariaLabel: `Detalle del pago de ${pago.proveedorNombre}`,
      data: { pago, esAdmin: this.esAdmin(), puedeVerHistorialCalidad: puedeVerHistorialDeCalidad(this.auth.usuario()?.rolNombre) }
    });
    ref.closed.subscribe((cambiado) => { if (cambiado) this.cargar(); });
  }

  /** Historial consolidado del proveedor de este pago (ADMIN y RECEPCION: recibe solo sus secciones). */
  protected verHistorial(pago: PagoResponse): void {
    this.dialog.open(HistorialConsolidadoDialog, {
      ariaLabel: `Historial consolidado de ${pago.proveedorNombre}`,
      data: { proveedorId: pago.proveedorId, proveedorNombre: pago.proveedorNombre }
    });
  }

  protected consultarAjustes(): void {
    const proveedorId = this.proveedorAjustes();
    if (!proveedorId) return;
    this.cargandoAjustes.set(true);
    this.errorAjustes.set(null);
    this.consultado.set(true);
    this.pagosApi.ajustesPendientes(proveedorId).subscribe({
      next: (ajustes) => {
        this.ajustesPendientes.set(ajustes);
        this.cargandoAjustes.set(false);
      },
      error: (error) => {
        this.errorAjustes.set(mapHttpError(error));
        this.cargandoAjustes.set(false);
      }
    });
  }

  protected liquidarAjuste(ajuste: AjustePagoResponse): void {
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      ariaLabel: 'Liquidar ajuste',
      data: {
        titulo: 'Liquidar ajuste',
        mensaje: `Se marcará como liquidado el ajuste de S/ ${ajuste.monto} (${ajuste.litrosDiferencia} L). No se puede deshacer desde aquí.`,
        etiquetaConfirmar: 'Liquidar'
      }
    });
    ref.closed.subscribe((confirmado) => {
      if (!confirmado) return;
      this.pagosApi.liquidarAjuste(ajuste.id).subscribe({
        next: () => {
          this.toast.exito('Ajuste liquidado.');
          this.ajustesPendientes.update((actual) => actual.filter((a) => a.id !== ajuste.id));
        },
        error: (error) => this.toast.error(mapHttpError(error).mensaje)
      });
    });
  }
}
