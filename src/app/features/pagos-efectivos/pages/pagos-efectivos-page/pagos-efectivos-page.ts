import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { CampoUnicoDialog, CampoUnicoDialogData } from '../../../../shared/ui/dialog/campo-unico-dialog';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { paginaCorregida, TAMANOS_PAGINA, TAMANO_PAGINA_POR_DEFECTO } from '../../../../shared/util/paginacion';
import { ProveedorPublicoResponse } from '../../../proveedores/data-access/proveedor.models';
import { ProveedoresApi } from '../../../proveedores/data-access/proveedores.api';
import { EstadoPagoProveedor, PagoProveedorResponse, etiquetaModalidad } from '../../data-access/pago-proveedor.models';
import { PagosProveedorApi } from '../../data-access/pagos-proveedor.api';
import { AplicarPagoProveedorDialog } from '../../ui/aplicar-pago-proveedor-dialog/aplicar-pago-proveedor-dialog';
import { PagoProveedorDetalleDialog } from '../../ui/pago-proveedor-detalle-dialog/pago-proveedor-detalle-dialog';
import { RegistrarPagoProveedorDialog } from '../../ui/registrar-pago-proveedor-dialog/registrar-pago-proveedor-dialog';

/**
 * Pagos efectivos a proveedores (ADMIN y RECEPCION): lista paginada en el servidor con búsqueda y filtro de estado, registro, aplicación de
 * adelantos y anulación (solo ADMIN). Los importes, aplicaciones y topes los calcula el servidor.
 */
@Component({
  selector: 'app-pagos-efectivos-page',
  imports: [DatePipe, DecimalPipe, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pagos-efectivos-page.html',
  styleUrl: './pagos-efectivos-page.css'
})
export class PagosEfectivosPage {
  private readonly api = inject(PagosProveedorApi);
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly esAdmin = computed(() => this.auth.usuario()?.rolNombre === 'ADMIN');
  protected readonly proveedores = toSignal(this.proveedoresApi.listarOperativo(), { initialValue: [] as ProveedorPublicoResponse[] });

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly pagos = signal<PagoProveedorResponse[]>([]);
  protected readonly pagina = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  protected readonly tamanos = TAMANOS_PAGINA;
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);
  protected readonly estado = signal<EstadoPagoProveedor | ''>('');
  private readonly busquedaAplicada = signal('');
  private peticion?: Subscription;

  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'fecha', etiqueta: 'Fecha' },
    { clave: 'proveedorNombre', etiqueta: 'Proveedor' },
    { clave: 'modalidad', etiqueta: 'Modalidad' },
    { clave: 'monto', etiqueta: 'Monto', alinearFin: true },
    { clave: 'aplicado', etiqueta: 'Aplicado', alinearFin: true },
    { clave: 'estado', etiqueta: 'Estado' },
    { clave: 'acciones', etiqueta: '' }
  ];

  constructor() {
    this.cargar();
  }

  protected modalidad(valor: string): string {
    return etiquetaModalidad(valor);
  }

  protected cargar(): void {
    this.peticion?.unsubscribe();
    this.cargando.set(true);
    this.error.set(null);
    this.peticion = this.api
      .listar({ page: this.pagina(), size: this.tamano(), estado: this.estado(), busqueda: this.busquedaAplicada() || undefined })
      .subscribe({
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

  protected buscar(texto: string): void {
    this.busquedaAplicada.set(texto);
    this.pagina.set(0);
    this.cargar();
  }

  protected cambiarEstado(valor: string): void {
    this.estado.set(valor === 'REGISTRADO' || valor === 'ANULADO' ? valor : '');
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

  protected registrar(): void {
    const ref = this.dialog.open<PagoProveedorResponse | undefined>(RegistrarPagoProveedorDialog, {
      ariaLabel: 'Registrar pago a proveedor',
      data: { proveedores: this.proveedores() }
    });
    ref.closed.subscribe((pago) => {
      if (!pago) return;
      this.toast.exito(`Pago a "${pago.proveedorNombre}" registrado.`);
      this.pagina.set(0);
      this.cargar();
    });
  }

  protected verDetalle(pago: PagoProveedorResponse): void {
    this.dialog.open(PagoProveedorDetalleDialog, { ariaLabel: `Detalle del pago a ${pago.proveedorNombre}`, data: { pago } });
  }

  protected aplicar(pago: PagoProveedorResponse): void {
    const ref = this.dialog.open<PagoProveedorResponse | undefined>(AplicarPagoProveedorDialog, {
      ariaLabel: `Aplicar el pago a ${pago.proveedorNombre}`,
      data: { pago }
    });
    ref.closed.subscribe((aplicado) => {
      if (!aplicado) return;
      this.toast.exito('Pago aplicado a la liquidación.');
      this.cargar();
    });
  }

  protected anular(pago: PagoProveedorResponse): void {
    const datos: CampoUnicoDialogData = {
      titulo: 'Anular pago',
      etiquetaCampo: `Motivo de la anulación del pago de S/ ${pago.monto} a ${pago.proveedorNombre}`,
      valorInicial: '',
      ayuda: 'Se conserva el registro y las liquidaciones recuperan su saldo. No se puede deshacer desde aquí.',
      etiquetaGuardar: 'Anular pago',
      guardar: (motivo) => this.api.anular(pago.id, motivo)
    };
    const ref = this.dialog.open<unknown>(CampoUnicoDialog, { ariaLabel: 'Anular pago', data: datos });
    ref.closed.subscribe((resultado) => {
      if (!resultado) return;
      this.toast.exito('Pago anulado.');
      this.cargar();
    });
  }
}
