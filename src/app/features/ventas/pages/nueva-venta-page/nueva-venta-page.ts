import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { mapHttpError } from '../../../../core/http/app-error';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { fechaHoyLima } from '../../../../shared/util/fecha';
import { CompradorSelectorComponent } from '../../../clientes/ui/comprador-selector/comprador-selector';
import { CompradorSeleccion } from '../../../clientes/ui/registro-cliente-dialog/registro-cliente-dialog';
import { TipoPrecioResponse } from '../../../tipos-precio/data-access/tipo-precio.models';
import { TiposPrecioApi } from '../../../tipos-precio/data-access/tipos-precio.api';
import { ComprobanteVentaService } from '../../data-access/comprobante-venta.service';
import {
  CrearVentaCarritoRequest,
  ETIQUETAS_COMPROBANTE,
  TipoComprobante,
  VentaResumenResponse
} from '../../data-access/venta.models';
import { VentasApi } from '../../data-access/ventas.api';
import { BuscadorProductosComponent, ProductoElegido } from '../../ui/buscador-productos/buscador-productos';
import { EnviarWhatsappDialog, EnviarWhatsappDialogData } from '../../ui/enviar-whatsapp-dialog/enviar-whatsapp-dialog';

export interface LineaCarrito {
  presentacionId: string;
  productoNombre: string;
  presentacionNombre: string;
  codigo: string;
  cantidad: number;
  /** null = sin precio vigente para el canal y la fecha elegidos (la línea bloquea el registro). */
  precio: number | null;
  /** Lo que se puede VENDER hoy de esta presentación (lotes vigentes; el servidor lo vuelve a validar al registrar). */
  stockVendible: number;
  cargandoPrecio: boolean;
  errorPrecio: string | null;
}

/** Importes en céntimos para no arrastrar errores de coma flotante al sumar. */
function centimos(importe: number): number {
  return Math.round(importe * 100);
}

/**
 * Pantalla «Nueva venta»: el cliente, el carrito y el comprobante en una sola vista, con el total siempre visible. Reemplaza al formulario
 * en ventana de tres pasos. Los productos se agregan con un buscador con autocompletado (sin «Agregar línea»): al elegir uno entra al
 * carrito con su precio y su stock ya consultados; elegir el mismo producto otra vez suma a la línea existente. El precio NO se edita aquí:
 * el servidor siempre lo resuelve (canal y fecha de la venta) y vuelve a validar precio y stock al registrar.
 *
 * Reglas heredadas del formulario anterior: el canal decide el precio y el comprador debe corresponder al canal (PÚBLICO admite «Cliente
 * varios»; MAYORISTA exige un cliente habilitado; PROVEEDOR, un proveedor del padrón); cambiar canal o fecha vuelve a consultar el precio de
 * cada línea. El `uuidCliente` se genera una vez por venta y se conserva en cualquier reintento, incluido un fallo de red (idempotencia).
 *
 * Tipo de comprobante: nota de venta (NV01) o boleta (B001), cada uno con su propio correlativo, que asigna el servidor al registrar. Son
 * comprobantes internos mientras no exista la integración con SUNAT.
 */
@Component({
  selector: 'app-nueva-venta-page',
  imports: [DecimalPipe, RouterLink, BuscadorProductosComponent, CompradorSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nueva-venta-page.html',
  styleUrl: './nueva-venta-page.css'
})
export class NuevaVentaPage {
  private readonly ventasApi = inject(VentasApi);
  private readonly tiposPrecioApi = inject(TiposPrecioApi);
  private readonly comprobanteService = inject(ComprobanteVentaService);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);
  private readonly buscador = viewChild(BuscadorProductosComponent);

  protected readonly etiquetasComprobante = ETIQUETAS_COMPROBANTE;
  protected readonly tiposComprobante: TipoComprobante[] = ['NOTA_VENTA', 'BOLETA'];
  protected readonly seriePorTipo: Record<TipoComprobante, string> = { NOTA_VENTA: 'NV01', BOLETA: 'B001' };

  /** Una sola vez por venta; se conserva ante cualquier reintento y se renueva al empezar otra venta. */
  private uuidCliente = crypto.randomUUID();

  protected readonly tiposActivos = signal<TipoPrecioResponse[]>([]);
  protected readonly cargandoTipos = signal(true);
  protected readonly fecha = signal(fechaHoyLima());
  protected readonly canal = signal('PUBLICO');
  protected readonly tipoComprobante = signal<TipoComprobante>('NOTA_VENTA');
  protected readonly comprador = signal<CompradorSeleccion | null>(null);
  protected readonly eligiendoComprador = signal(false);
  protected readonly lineas = signal<LineaCarrito[]>([]);

  protected readonly enviando = signal(false);
  /** true cuando el último intento falló por red (respuesta incierta): el reintento reenvía el mismo payload. */
  protected readonly incierto = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);
  protected readonly resultado = signal<VentaResumenResponse | null>(null);
  protected readonly imprimiendo = signal(false);
  protected readonly descargando = signal(false);

  private solicitudEnviada: CrearVentaCarritoRequest | null = null;
  private readonly peticionesPrecio = new Map<string, Subscription>();

  constructor() {
    this.tiposPrecioApi.listar(true).subscribe({
      next: (t) => {
        this.tiposActivos.set(t);
        this.cargandoTipos.set(false);
        // PÚBLICO es el canal por defecto; si el catálogo no lo tiene activo, se pide elegir uno.
        if (!t.some((x) => x.codigo === this.canal())) this.canal.set('');
      },
      error: () => {
        this.tiposActivos.set([]);
        this.cargandoTipos.set(false);
        this.canal.set('');
      }
    });
  }

  // ------------------------------------------------------------------ comprador y canal

  protected etiquetaCanal(codigo: string): string {
    return this.tiposActivos().find((t) => t.codigo === codigo)?.nombre ?? codigo;
  }

  /** Canales que admite el comprador actual (el servidor aplica la misma regla). */
  protected canalPermitido(codigo: string): boolean {
    const c = this.comprador();
    const regla = this.tiposActivos().find((t) => t.codigo === codigo)?.reglaComprador;
    if (regla === 'CLIENTE_HABILITADO') return !!c && c.tipo === 'CLIENTE' && (c.tiposHabilitados ?? []).includes(codigo);
    if (regla === 'PROVEEDOR_PADRON') return !!c && c.tipo === 'PROVEEDOR';
    return true;
  }

  protected motivoCanal(codigo: string): string {
    const regla = this.tiposActivos().find((t) => t.codigo === codigo)?.reglaComprador;
    if (regla === 'CLIENTE_HABILITADO') return 'requiere un cliente habilitado para este tipo';
    if (regla === 'PROVEEDOR_PADRON') return 'requiere elegir al proveedor que compra';
    return '';
  }

  protected readonly canalIncorrecto = computed(() => !!this.canal() && !this.canalPermitido(this.canal()));
  protected readonly motivoCanalActual = computed(() => (this.canalIncorrecto() ? this.motivoCanal(this.canal()) : ''));

  protected elegirComprador(c: CompradorSeleccion | null): void {
    this.comprador.set(c);
    this.eligiendoComprador.set(false);
    // Un proveedor propone el tipo para proveedores del padrón; un cliente, su canal habitual; cualquier otro, PÚBLICO. Solo se propone si sigue
    // activo y la ficha puede usarlo: si no, se deja vacío y se pide elegir uno válido (no se cambia nada guardado).
    const activos = this.tiposActivos();
    const propuesto =
      c?.tipo === 'PROVEEDOR'
        ? activos.find((t) => t.reglaComprador === 'PROVEEDOR_PADRON')?.codigo
        : c?.tipo === 'CLIENTE'
          ? (c.canalHabitual ?? 'PUBLICO')
          : activos.find((t) => t.codigo === 'PUBLICO')?.codigo;
    this.cambiarCanal(propuesto && activos.some((t) => t.codigo === propuesto) && this.canalPermitido(propuesto) ? propuesto : '');
  }

  protected cambiarCanal(codigo: string): void {
    if (codigo === this.canal()) return; // sin cambio no hay precio que reconsultar
    this.canal.set(codigo);
    this.reconsultarPrecios();
  }

  protected cambiarFecha(valor: string): void {
    if (valor === this.fecha()) return;
    this.fecha.set(valor);
    this.reconsultarPrecios();
  }

  protected cambiarTipoComprobante(valor: string): void {
    this.tipoComprobante.set(valor as TipoComprobante);
  }

  // ------------------------------------------------------------------ carrito

  protected agregarProducto({ resultado, cantidad }: ProductoElegido): void {
    const existente = this.lineas().find((l) => l.presentacionId === resultado.presentacionId);
    const pedida = (existente?.cantidad ?? 0) + cantidad;
    const cantidadFinal = Math.min(pedida, resultado.stockVendible);
    if (cantidadFinal < pedida) {
      this.toast.error(`Solo hay ${resultado.stockVendible} de ${resultado.productoNombre} (${resultado.presentacionNombre}); se ajustó la cantidad.`);
    }
    if (existente) {
      this.actualizar(existente.presentacionId, { cantidad: cantidadFinal, stockVendible: resultado.stockVendible, precio: resultado.precio, errorPrecio: null });
      return;
    }
    this.lineas.update((l) => [
      ...l,
      {
        presentacionId: resultado.presentacionId,
        productoNombre: resultado.productoNombre,
        presentacionNombre: resultado.presentacionNombre,
        codigo: resultado.codigo,
        cantidad: cantidadFinal,
        precio: resultado.precio,
        stockVendible: resultado.stockVendible,
        cargandoPrecio: false,
        errorPrecio: null
      }
    ]);
  }

  private actualizar(presentacionId: string, cambios: Partial<LineaCarrito>): void {
    this.lineas.update((ls) => ls.map((l) => (l.presentacionId === presentacionId ? { ...l, ...cambios } : l)));
  }

  protected cambiarCantidad(linea: LineaCarrito, valor: string | number): void {
    const n = Math.floor(Number(valor));
    let cantidad = Number.isFinite(n) && n >= 1 ? n : 1;
    if (cantidad > linea.stockVendible) {
      cantidad = linea.stockVendible;
      this.toast.error(`Solo hay ${linea.stockVendible} de ${linea.productoNombre} (${linea.presentacionNombre}).`);
    }
    this.actualizar(linea.presentacionId, { cantidad });
  }

  protected sumar(linea: LineaCarrito, paso: 1 | -1): void {
    const cantidad = linea.cantidad + paso;
    if (cantidad < 1 || cantidad > linea.stockVendible) return;
    this.actualizar(linea.presentacionId, { cantidad });
  }

  protected quitar(linea: LineaCarrito): void {
    this.peticionesPrecio.get(linea.presentacionId)?.unsubscribe();
    this.peticionesPrecio.delete(linea.presentacionId);
    this.lineas.update((ls) => ls.filter((l) => l.presentacionId !== linea.presentacionId));
    this.buscador()?.enfocar();
  }

  protected vaciar(): void {
    if (this.lineas().length === 0 && !this.comprador()) return;
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      ariaLabel: 'Vaciar venta',
      data: {
        titulo: 'Vaciar la venta',
        mensaje: 'Se quitarán todos los productos del carrito y el comprador elegido. La venta todavía no se ha registrado.',
        etiquetaConfirmar: 'Vaciar venta',
        peligroso: true
      }
    });
    ref.closed.subscribe((ok) => {
      if (ok) this.reiniciar();
    });
  }

  /** Cambiar canal o fecha cambia el precio vigente de CADA línea: se vuelve a pedir (el stock no depende de ninguno de los dos). */
  private reconsultarPrecios(): void {
    const canal = this.canal();
    const fecha = this.fecha();
    for (const linea of this.lineas()) {
      this.peticionesPrecio.get(linea.presentacionId)?.unsubscribe();
      if (!canal || !fecha) {
        // Sin canal o sin fecha no hay precio que consultar: se conserva el último y el registro queda bloqueado (ver `pendientes`); al elegir uno válido se reconsulta.
        this.actualizar(linea.presentacionId, { cargandoPrecio: false });
        continue;
      }
      this.actualizar(linea.presentacionId, { cargandoPrecio: true, errorPrecio: null });
      // Cada consulta cancela la anterior de ESA línea: una respuesta tardía de un canal o fecha ya reemplazados nunca pisa el precio actual.
      const sub = this.ventasApi.precioVigente(linea.presentacionId, canal, fecha).subscribe({
        next: (p) => this.actualizar(linea.presentacionId, { precio: p.precio, cargandoPrecio: false }),
        error: (e) => this.actualizar(linea.presentacionId, { precio: null, cargandoPrecio: false, errorPrecio: mapHttpError(e).mensaje })
      });
      this.peticionesPrecio.set(linea.presentacionId, sub);
    }
  }

  // ------------------------------------------------------------------ totales y validación

  protected subtotal(linea: LineaCarrito): number | null {
    return linea.precio === null ? null : centimos(linea.precio) * linea.cantidad / 100;
  }

  protected readonly articulos = computed(() => this.lineas().reduce((suma, l) => suma + l.cantidad, 0));

  protected readonly total = computed(() => {
    let cent = 0;
    for (const l of this.lineas()) {
      if (l.precio === null) continue;
      cent += centimos(l.precio) * l.cantidad;
    }
    return cent / 100;
  });

  /** Qué falta para poder registrar (vacío = listo). */
  protected readonly pendientes = computed(() => {
    const lista: string[] = [];
    if (!this.fecha()) lista.push('indica la fecha');
    if (!this.canal()) lista.push('elige el canal');
    else if (this.canalIncorrecto()) lista.push(`el canal no corresponde al comprador (${this.motivoCanalActual()})`);
    const ls = this.lineas();
    if (ls.length === 0) lista.push('agrega al menos un producto');
    else if (ls.some((l) => l.cargandoPrecio)) lista.push('espera a que se consulte el precio');
    else if (ls.some((l) => l.precio === null)) lista.push('hay productos sin precio para este canal y fecha');
    return lista;
  });

  protected readonly puedeRegistrar = computed(() => this.pendientes().length === 0 && !this.enviando());

  // ------------------------------------------------------------------ registrar

  /** F9: registrar sin soltar el teclado (igual que el botón). */
  @HostListener('document:keydown.f9', ['$event'])
  protected atajoRegistrar(e: Event): void {
    e.preventDefault();
    if (!this.resultado()) this.registrar();
  }

  protected registrar(): void {
    if (this.enviando() || !this.puedeRegistrar()) return;

    if (!this.incierto()) {
      const c = this.comprador();
      this.solicitudEnviada = {
        uuidCliente: this.uuidCliente,
        fecha: this.fecha(),
        tipoCliente: this.canal(),
        detalles: this.lineas().map((l) => ({ presentacionId: l.presentacionId, cantidad: l.cantidad })),
        comprador: c ? { tipo: c.tipo, id: c.id } : null,
        tipoComprobante: this.tipoComprobante()
      };
    }
    // Si incierto() es true, se reenvía this.solicitudEnviada tal cual quedó armada la primera vez.

    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.ventasApi.crearCarrito(this.solicitudEnviada!).subscribe({
      next: (venta) => {
        this.enviando.set(false);
        this.incierto.set(false);
        this.resultado.set(venta);
        this.toast.exito(`Venta registrada. Total: S/ ${venta.total.toFixed(2)}.`);
      },
      error: (error) => {
        this.enviando.set(false);
        const appError = mapHttpError(error);
        if (appError.tipo === 'red') {
          this.incierto.set(true);
          this.errorEnvio.set(
            'No se pudo confirmar si la venta quedó registrada por un problema de conexión. ' +
              'Presiona «Registrar venta» otra vez sin cambiar los datos: esta venta conserva su identificador, así que no se registrará dos veces.'
          );
        } else {
          this.incierto.set(false);
          this.solicitudEnviada = null;
          this.errorEnvio.set(appError.mensaje);
        }
      }
    });
  }

  // ------------------------------------------------------------------ después de registrar

  protected imprimir(): void {
    const venta = this.resultado();
    if (!venta || this.imprimiendo()) return;
    this.imprimiendo.set(true);
    this.comprobanteService.imprimir(venta.id).subscribe({
      next: () => this.imprimiendo.set(false),
      error: (e) => {
        this.imprimiendo.set(false);
        this.toast.error(mapHttpError(e).mensaje);
      }
    });
  }

  protected descargar(): void {
    const venta = this.resultado();
    if (!venta || this.descargando()) return;
    this.descargando.set(true);
    this.comprobanteService.descargar(venta.id, venta.comprobante).subscribe({
      next: () => this.descargando.set(false),
      error: (e) => {
        this.descargando.set(false);
        this.toast.error(mapHttpError(e).mensaje);
      }
    });
  }

  /** Abre el diálogo para enviar el comprobante por WhatsApp (el número se puede cambiar en cada envío). */
  protected enviarWhatsapp(): void {
    const venta = this.resultado();
    if (!venta) return;
    this.dialog.open<boolean>(EnviarWhatsappDialog, { ariaLabel: 'Enviar por WhatsApp', data: { venta } satisfies EnviarWhatsappDialogData });
  }

  /** Empieza una venta nueva: vacía todo, renueva el identificador de la operación y deja el cursor en el buscador. */
  protected nuevaVenta(): void {
    this.reiniciar();
    setTimeout(() => this.buscador()?.enfocar());
  }

  private reiniciar(): void {
    for (const sub of this.peticionesPrecio.values()) sub.unsubscribe();
    this.peticionesPrecio.clear();
    this.uuidCliente = crypto.randomUUID();
    this.solicitudEnviada = null;
    this.lineas.set([]);
    this.comprador.set(null);
    this.eligiendoComprador.set(false);
    this.fecha.set(fechaHoyLima());
    this.canal.set(this.tiposActivos().some((t) => t.codigo === 'PUBLICO') ? 'PUBLICO' : '');
    this.tipoComprobante.set('NOTA_VENTA');
    this.incierto.set(false);
    this.errorEnvio.set(null);
    this.resultado.set(null);
  }

  /** «Viernes 30 de octubre de 2026», sin pasar por la zona horaria (se arma al mediodía de esa fecha). */
  protected fechaLarga(iso: string): string {
    if (!iso) return '';
    const d = new Date(`${iso}T12:00:00`);
    const texto = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
}
