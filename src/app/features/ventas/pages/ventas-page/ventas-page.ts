import { TiposPrecioApi } from '../../../tipos-precio/data-access/tipos-precio.api';
import { TipoPrecioResponse } from '../../../tipos-precio/data-access/tipo-precio.models';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { ExportarExcelComponent } from '../../../../shared/ui/exportar-excel/exportar-excel';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { TAMANOS_PAGINA, TAMANO_PAGINA_POR_DEFECTO } from '../../../../shared/util/paginacion';
import { ComprobanteVentaService } from '../../data-access/comprobante-venta.service';
import { ETIQUETAS_COMPROBANTE, TipoClienteVenta, VentaResumenResponse } from '../../data-access/venta.models';
import { ResumenVentas, VentasApi } from '../../data-access/ventas.api';
import { EnviarWhatsappDialog, EnviarWhatsappDialogData } from '../../ui/enviar-whatsapp-dialog/enviar-whatsapp-dialog';
import { VentaDetalleDialog, VentaDetalleDialogData } from '../../ui/venta-detalle-dialog/venta-detalle-dialog';
import { formatearFecha } from '../../../../shared/util/fecha';

type Accion = 'imprimir' | 'descargar';

/**
 * Historial de ventas: solo consulta. Registrar una venta es otra pantalla («Nueva venta», /ventas/nueva). Cada fila ofrece sus acciones
 * directas: ver el detalle, imprimir el comprobante y descargarlo en PDF, sin pasar por ninguna ventana intermedia. Arriba, los totales de
 * TODAS las ventas del filtro (no solo de la página que se ve): cuántas son, cuánto suman y el promedio por venta.
 */
@Component({
  selector: 'app-ventas-page',
  imports: [DataTableComponent, ExportarExcelComponent, DecimalPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ventas-page.html',
  styleUrl: './ventas-page.css'
})
export class VentasPage {
  protected readonly formatearFecha = formatearFecha;
  protected readonly etiquetasComprobante = ETIQUETAS_COMPROBANTE;
  private readonly ventasApi = inject(VentasApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);
  private readonly tiposPrecioApi = inject(TiposPrecioApi);
  private readonly comprobanteService = inject(ComprobanteVentaService);

  /** Todos los tipos del catálogo (también los desactivados): el filtro y las etiquetas cubren lo histórico. */
  protected readonly tiposPrecio = signal<TipoPrecioResponse[]>([]);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly ventas = signal<VentaResumenResponse[]>([]);
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);
  /** Totales del filtro vigente; null mientras se consultan o si la consulta falló. */
  protected readonly resumen = signal<ResumenVentas | null>(null);
  protected readonly promedio = computed(() => {
    const r = this.resumen();
    return r && r.cantidad > 0 ? r.total / r.cantidad : null;
  });

  protected readonly pagina = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  protected readonly tamanos = TAMANOS_PAGINA;
  /** Texto del buscador estándar (comprobante, comprador, vendedor o producto): se envía al servidor y busca entre todas las ventas. */
  private readonly busquedaAplicada = signal('');
  private peticion?: Subscription;
  private peticionResumen?: Subscription;
  protected readonly filtroDesde = signal('');
  protected readonly filtroHasta = signal('');
  protected readonly filtroTipoCliente = signal<TipoClienteVenta | ''>('');
  protected readonly hayFiltros = computed(() => !!(this.filtroDesde() || this.filtroHasta() || this.filtroTipoCliente() || this.busquedaAplicada()));
  protected readonly rangoInvalido = computed(() => !!this.filtroDesde() && !!this.filtroHasta() && this.filtroDesde() > this.filtroHasta());

  /** Filtros y búsqueda vigentes: el Excel trae todas las ventas que cumplen esto (una fila por línea), no solo la página. */
  protected readonly filtroExportacion = computed(() => ({
    desde: this.filtroDesde() || undefined,
    hasta: this.filtroHasta() || undefined,
    tipoCliente: this.filtroTipoCliente() || undefined,
    busqueda: this.busquedaAplicada() || undefined
  }));

  /** Qué comprobante se está imprimiendo o descargando (para deshabilitar solo ese botón). */
  protected readonly trabajando = signal<{ id: string; accion: Accion } | null>(null);

  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'comprobante', etiqueta: 'Comprobante' },
    { clave: 'fecha', etiqueta: 'Fecha' },
    { clave: 'comprador', etiqueta: 'Comprador' },
    { clave: 'vendedor', etiqueta: 'Vendedor' },
    { clave: 'canal', etiqueta: 'Canal' },
    { clave: 'lineas', etiqueta: 'Productos' },
    { clave: 'total', etiqueta: 'Total', alinearFin: true },
    { clave: 'acciones', etiqueta: '' }
  ];

  constructor() {
    this.tiposPrecioApi.listar(false).subscribe({ next: (t) => this.tiposPrecio.set(t), error: () => this.tiposPrecio.set([]) });
    this.cargar();
    this.cargarResumen();
  }

  private filtroActual() {
    return {
      desde: this.filtroDesde() || undefined,
      hasta: this.filtroHasta() || undefined,
      tipoCliente: this.filtroTipoCliente() || undefined,
      busqueda: this.busquedaAplicada() || undefined
    };
  }

  protected cargar(): void {
    this.peticion?.unsubscribe();
    if (this.rangoInvalido()) {
      // Un rango al revés no se le manda al servidor: se avisa junto a los campos y la tabla queda como estaba.
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.peticion = this.ventasApi.listar({ page: this.pagina(), size: this.tamano(), ...this.filtroActual() }).subscribe({
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

  /** Los totales dependen solo del filtro (no de la página): se piden al cambiar un filtro, no al pasar de página. */
  private cargarResumen(): void {
    this.peticionResumen?.unsubscribe();
    this.resumen.set(null);
    if (this.rangoInvalido()) return;
    this.peticionResumen = this.ventasApi.resumen(this.filtroActual()).subscribe({
      next: (r) => this.resumen.set(r),
      error: () => this.resumen.set(null)
    });
  }

  private filtrar(): void {
    this.pagina.set(0);
    this.cargar();
    this.cargarResumen();
  }

  protected cambiarFiltroDesde(fecha: string): void {
    this.filtroDesde.set(fecha);
    this.filtrar();
  }

  protected cambiarFiltroHasta(fecha: string): void {
    this.filtroHasta.set(fecha);
    this.filtrar();
  }

  protected cambiarFiltroTipoCliente(valor: string): void {
    this.filtroTipoCliente.set(valor as TipoClienteVenta | '');
    this.filtrar();
  }

  protected buscar(texto: string): void {
    this.busquedaAplicada.set(texto);
    this.filtrar();
  }

  protected limpiarFiltros(): void {
    this.filtroDesde.set('');
    this.filtroHasta.set('');
    this.filtroTipoCliente.set('');
    this.busquedaAplicada.set('');
    this.filtrar();
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

  /** Nombre del tipo de precio de una venta (activo o no: lo histórico sigue mostrando su tipo); sin catálogo, el código estable. */
  protected etiquetaCanal(canal: TipoClienteVenta): string {
    return this.tiposPrecio().find((t) => t.codigo === canal)?.nombre ?? canal;
  }

  /** «Nota de venta» o «Boleta de venta electrónica» (null si la venta no trae tipo: backend anterior). */
  protected tipoComprobante(venta: VentaResumenResponse): string | null {
    return venta.tipoComprobante ? ETIQUETAS_COMPROBANTE[venta.tipoComprobante] : null;
  }

  /** Nombre usado en la venta (copia histórica); «Cliente varios» si no se identificó al comprador. */
  protected comprador(venta: VentaResumenResponse): string {
    return venta.comprador?.nombre?.trim() || 'Cliente varios';
  }

  /** «16:27» de la hora real del registro (la fecha de la columna es la de la venta, que puede ser anterior). */
  protected hora(venta: VentaResumenResponse): string {
    const m = /[T ](\d{2}:\d{2})/.exec(venta.creadoEn ?? '');
    return m ? m[1] : '';
  }

  /** Resumen corto de las líneas para la fila de la tabla (el detalle completo está a un clic, en «Ver»). */
  protected resumenLineas(venta: VentaResumenResponse): string {
    if (venta.detalles.length === 1) {
      const l = venta.detalles[0];
      return `${l.cantidad} × ${l.presentacionNombre}`;
    }
    return `${venta.detalles.length} líneas`;
  }

  protected abrirDetalle(venta: VentaResumenResponse): void {
    const data: VentaDetalleDialogData = { id: venta.id, etiquetaCanal: this.etiquetaCanal(venta.tipoCliente) };
    this.dialog.open(VentaDetalleDialog, { ariaLabel: 'Detalle de venta', data });
  }

  protected imprimir(venta: VentaResumenResponse): void {
    this.ejecutar(venta, 'imprimir', this.comprobanteService.imprimir(venta.id));
  }

  protected descargar(venta: VentaResumenResponse): void {
    this.ejecutar(venta, 'descargar', this.comprobanteService.descargar(venta.id, venta.comprobante));
  }

  /** Abre el diálogo de WhatsApp para esa venta: el número se propone (el último usado) y se puede cambiar en cada envío. */
  protected enviarWhatsapp(venta: VentaResumenResponse): void {
    this.dialog.open<boolean>(EnviarWhatsappDialog, { ariaLabel: 'Enviar por WhatsApp', data: { venta } satisfies EnviarWhatsappDialogData });
  }

  protected estaTrabajando(venta: VentaResumenResponse, accion: Accion): boolean {
    const t = this.trabajando();
    return !!t && t.id === venta.id && t.accion === accion;
  }

  private ejecutar(venta: VentaResumenResponse, accion: Accion, trabajo: ReturnType<ComprobanteVentaService['imprimir']>): void {
    if (this.trabajando()) return;
    this.trabajando.set({ id: venta.id, accion });
    trabajo.subscribe({
      next: () => this.trabajando.set(null),
      error: (e) => {
        this.trabajando.set(null);
        this.toast.error(mapHttpError(e).mensaje);
      }
    });
  }
}
