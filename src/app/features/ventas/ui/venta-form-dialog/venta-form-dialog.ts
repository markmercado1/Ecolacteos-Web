import { TipoPrecioResponse } from '../../../tipos-precio/data-access/tipo-precio.models';
import { TiposPrecioApi } from '../../../tipos-precio/data-access/tipos-precio.api';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { DialogRef } from '@angular/cdk/dialog';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { mapHttpError } from '../../../../core/http/app-error';
import { ProductoResponse } from '../../../catalogos/data-access/producto.models';
import { ProductosApi } from '../../../catalogos/data-access/productos.api';
import { InventarioApi } from '../../../inventario/data-access/inventario.api';
import { CompradorSelectorComponent } from '../../../clientes/ui/comprador-selector/comprador-selector';
import { CompradorSeleccion } from '../../../clientes/ui/registro-cliente-dialog/registro-cliente-dialog';
import { CrearVentaCarritoRequest, DetalleVentaRequest, TipoClienteVenta, VentaResumenResponse } from '../../data-access/venta.models';
import { VentasApi } from '../../data-access/ventas.api';

type Paso = 'formulario' | 'resumen' | 'resultado';

export interface VentaFormDialogResultado {
  venta: VentaResumenResponse;
  verDetalle: boolean;
}

export interface FilaCarrito {
  id: string;
  productoId: string;
  presentacionId: string;
  cantidad: number | null;
  precioVigente: number | null;
  cargandoPrecio: boolean;
  errorPrecio: string | null;
  /** Fase 2: lo que se puede VENDER hoy (lotes vigentes; igual al físico si el producto no controla vencimiento). */
  stockDisponible: number | null;
  /** Fase 2: existencias que están en inventario pero no se pueden vender (vencidas o sin trazabilidad). */
  stockNoVendible: number;
  cargandoStock: boolean;
}

function fechaHoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const ETIQUETAS_CANAL: Record<TipoClienteVenta, string> = {
  MAYORISTA: 'Mayorista',
  PROVEEDOR: 'Proveedor',
  PUBLICO: 'Público'
};

function filaVacia(): FilaCarrito {
  return {
    id: crypto.randomUUID(),
    productoId: '',
    presentacionId: '',
    cantidad: null,
    precioVigente: null,
    cargandoPrecio: false,
    errorPrecio: null,
    stockDisponible: null,
    stockNoVendible: 0,
    cargandoStock: false
  };
}

/**
 * Fase 4 (Venta multi-línea / carrito): una venta puede tener una o más líneas, cada una con su propia
 * presentación y cantidad -- ya no una sola línea por venta (ver docs/FASES.md). El precio y el stock de
 * CADA línea se consultan por separado (mismo endpoint puntual que antes, uno por presentación), nunca se
 * inventa una equivalencia entre presentaciones distintas. El backend vuelve a resolver precio y validar
 * stock de forma independiente al confirmar (POST /api/ventas/carrito) -- esta vista previa es solo UX.
 *
 * Las filas del carrito se manejan como un signal de objetos planos (no FormArray): cada selección de
 * presentación dispara una consulta async independiente (precio + stock) que debe poder cancelarse por
 * fila sin afectar a las demás -- más simple de razonar aquí que coordinar un FormArray con streams async
 * por control.
 *
 * El paso "resultado" es también la boleta interactiva: un comprobante visual en pantalla (sin validez
 * tributaria) que se puede imprimir o guardar como PDF con el diálogo de impresión del propio navegador
 * (@media print más abajo oculta todo lo demás del diálogo al imprimir) -- no depende de ningún servicio ni
 * librería nueva.
 *
 * Fase H: quien compra. PÚBLICO admite «Cliente varios» (sin datos) o un comprador identificado; MAYORISTA exige un cliente que ADMIN
 * habilitó como mayorista; PROVEEDOR exige un proveedor del padrón. Al elegir un proveedor se propone el canal PROVEEDOR (puede comprar
 * también a precio PÚBLICO); a un cliente, su canal habitual (MAYORISTA solo si está habilitado); a cualquier otro, PÚBLICO. El canal sigue decidiendo el precio y el servidor vuelve a validar todo.
 *
 * El uuidCliente se genera una sola vez por instancia de este diálogo y se conserva en cualquier reintento
 * de esa misma venta, incluido un fallo de red: mismo patrón de idempotencia que el resto de la app
 * (RegistrarLoteDialog, AjustarStockDialog).
 */
@Component({
  selector: 'app-venta-form-dialog',
  imports: [ReactiveFormsModule, DecimalPipe, CompradorSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './venta-form-dialog.html',
  styleUrl: './venta-form-dialog.css'
})
export class VentaFormDialog {
  protected readonly dialogRef = inject(DialogRef<VentaFormDialogResultado | undefined>);
  private readonly fb = inject(FormBuilder);
  private readonly ventasApi = inject(VentasApi);
  private readonly productosApi = inject(ProductosApi);
  private readonly inventarioApi = inject(InventarioApi);
  private readonly auth = inject(AuthService);
  private readonly tiposPrecioApi = inject(TiposPrecioApi);
  private readonly destroy = inject(DestroyRef);

  /** Una sola vez por operación; se conserva ante cualquier reintento (idempotencia del backend). */
  protected readonly uuidCliente = crypto.randomUUID();

  protected readonly paso = signal<Paso>('formulario');
  protected readonly productos = signal<ProductoResponse[]>([]);
  protected readonly cargandoProductos = signal(true);
  protected readonly errorProductos = signal<string | null>(null);

  protected readonly filas = signal<FilaCarrito[]>([]);
  protected readonly errorSinFilas = signal(false);
  private readonly peticionesPrecio = new Map<string, Subscription>();
  private readonly peticionesStock = new Map<string, Subscription>();

  protected readonly form = this.fb.group({
    fecha: this.fb.nonNullable.control(fechaHoyIso(), Validators.required),
    tipoCliente: this.fb.nonNullable.control<TipoClienteVenta | ''>('', Validators.required)
  });

  /** Señal del canal: leer `form.controls.tipoCliente.value` directamente dentro de un `computed()` no lo
   *  vuelve a evaluar cuando cambia (un FormControl no es una señal) -- por eso `puedeContinuar` se quedaba
   *  congelado en "false" desde antes de elegir el canal, aunque el resto del carrito ya estuviera completo. */
  protected readonly tipoClienteValor = toSignal(this.form.controls.tipoCliente.valueChanges, {
    initialValue: this.form.controls.tipoCliente.value
  });

  /** Fase H: comprador elegido (null = cliente varios). */
  protected readonly comprador = signal<CompradorSeleccion | null>(null);
  protected readonly eligiendoComprador = signal(false);

  /** Canales que admite el comprador actual (el servidor aplica la misma regla). */
  protected canalPermitido(canal: TipoClienteVenta): boolean {
    const c = this.comprador();
    if (canal === 'PUBLICO') return true;
    if (canal === 'MAYORISTA') return !!c && c.tipo === 'CLIENTE' && c.mayorista;
    return !!c && c.tipo === 'PROVEEDOR';
  }

  protected motivoCanal(canal: TipoClienteVenta): string {
    if (canal === 'MAYORISTA') return 'requiere un cliente habilitado como mayorista';
    if (canal === 'PROVEEDOR') return 'requiere elegir al proveedor que compra';
    return '';
  }

  protected elegirComprador(c: CompradorSeleccion | null): void {
    this.comprador.set(c);
    this.eligiendoComprador.set(false);
    // proveedor -> se propone PROVEEDOR; un cliente -> su canal habitual si lo puede usar (MAYORISTA solo habilitado); si no, PUBLICO
    const habitual = c?.tipo === 'CLIENTE' && c.canalHabitual === 'MAYORISTA' && c.mayorista ? 'MAYORISTA' : 'PUBLICO';
    const propuesto = c?.tipo === 'PROVEEDOR' ? 'PROVEEDOR' : habitual;
    // un tipo desactivado no se propone (el servidor tampoco lo acepta)
    const activos = this.tiposActivos();
    this.form.controls.tipoCliente.setValue(activos.some((t) => t.codigo === propuesto) ? propuesto : (activos.find((t) => t.codigo === 'PUBLICO') ?? activos[0])?.codigo ?? '');
  }

  /** Tipos de precio activos: los únicos que se ofrecen para una venta nueva. Vienen del servidor, no de una lista fija. */
  protected readonly tiposActivos = signal<TipoPrecioResponse[]>([]);

  protected readonly etiquetaCanal = computed(() => {
    const canal = this.tipoClienteValor();
    return canal ? ETIQUETAS_CANAL[canal] : '—';
  });

  /** Por fila: sus opciones de presentación excluyen las ya elegidas en OTRAS filas (evita duplicados en la UI). */
  protected presentacionesDeFila(fila: FilaCarrito) {
    const producto = this.productos().find((p) => p.id === fila.productoId);
    if (!producto) return [];
    const usadasEnOtras = new Set(
      this.filas().filter((f) => f.id !== fila.id).map((f) => f.presentacionId).filter(Boolean)
    );
    return producto.presentaciones.filter((p) => p.activo && !usadasEnOtras.has(p.id));
  }

  protected nombrePresentacion(fila: FilaCarrito): string {
    const producto = this.productos().find((p) => p.id === fila.productoId);
    return producto?.presentaciones.find((p) => p.id === fila.presentacionId)?.nombre ?? '—';
  }

  protected nombreProducto(fila: FilaCarrito): string {
    return this.productos().find((p) => p.id === fila.productoId)?.nombre ?? '—';
  }

  protected subtotal(fila: FilaCarrito): number | null {
    return fila.cantidad && fila.precioVigente !== null ? fila.cantidad * fila.precioVigente : null;
  }

  protected cantidadExcedeStock(fila: FilaCarrito): boolean {
    return fila.cantidad !== null && fila.stockDisponible !== null && fila.cantidad > fila.stockDisponible;
  }

  protected readonly totalEstimado = computed(() => {
    const filas = this.filas();
    if (filas.length === 0) return null;
    let total = 0;
    for (const f of filas) {
      const sub = this.subtotal(f);
      if (sub === null) return null;
      total += sub;
    }
    return total;
  });

  protected readonly puedeContinuar = computed(() => {
    if (this.cargandoProductos() || this.productos().length === 0) return false;
    const canal = this.tipoClienteValor();
    if (!canal || !this.canalPermitido(canal)) return false;
    const filas = this.filas();
    if (filas.length === 0) return false;
    return filas.every(
      (f) =>
        !!f.productoId &&
        !!f.presentacionId &&
        f.cantidad !== null &&
        f.cantidad >= 1 &&
        !f.cargandoPrecio &&
        f.precioVigente !== null &&
        !this.cantidadExcedeStock(f)
    );
  });

  constructor() {
    this.tiposPrecioApi.listar(true).subscribe({ next: (t) => this.tiposActivos.set(t), error: () => this.tiposActivos.set([]) });
    this.cargarProductos();
    this.agregarLinea();

    // Cambiar fecha o canal invalida el precio ya consultado de TODAS las filas (el precio vigente depende
    // de ambos) -- se vuelve a pedir para cada presentación ya seleccionada, con el mismo criterio.
    this.form.controls.fecha.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.reconsultarPreciosDeTodas());
    this.form.controls.tipoCliente.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.reconsultarPreciosDeTodas());
  }

  protected cargarProductos(): void {
    this.cargandoProductos.set(true);
    this.errorProductos.set(null);
    const esAdmin = this.auth.usuario()?.rolNombre === 'ADMIN';
    const catalogo$ = esAdmin ? this.productosApi.listar() : this.productosApi.listarOperativo();
    catalogo$.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (productos) => {
        this.productos.set(productos.filter((p) => p.activo));
        this.cargandoProductos.set(false);
      },
      error: (error) => {
        this.errorProductos.set(mapHttpError(error).mensaje);
        this.cargandoProductos.set(false);
      }
    });
  }

  protected agregarLinea(): void {
    this.errorSinFilas.set(false);
    this.filas.update((filas) => [...filas, filaVacia()]);
  }

  protected quitarLinea(id: string): void {
    this.peticionesPrecio.get(id)?.unsubscribe();
    this.peticionesPrecio.delete(id);
    this.peticionesStock.get(id)?.unsubscribe();
    this.peticionesStock.delete(id);
    this.filas.update((filas) => filas.filter((f) => f.id !== id));
  }

  private actualizarFila(id: string, cambios: Partial<FilaCarrito>): void {
    this.filas.update((filas) => filas.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  }

  protected cambiarProducto(id: string, productoId: string): void {
    this.peticionesPrecio.get(id)?.unsubscribe();
    this.peticionesStock.get(id)?.unsubscribe();
    this.actualizarFila(id, {
      productoId,
      presentacionId: '',
      precioVigente: null,
      errorPrecio: null,
      stockDisponible: null,
      stockNoVendible: 0
    });
  }

  protected cambiarPresentacion(id: string, presentacionId: string): void {
    this.actualizarFila(id, { presentacionId, precioVigente: null, errorPrecio: null, stockDisponible: null, stockNoVendible: 0 });
    if (presentacionId) this.consultarPrecioYStock(id);
  }

  protected cambiarCantidad(id: string, valor: string): void {
    const cantidad = valor === '' ? null : Number(valor);
    this.actualizarFila(id, { cantidad: cantidad !== null && Number.isFinite(cantidad) ? cantidad : null });
  }

  /** Fecha/canal cambian el precio vigente de TODAS las líneas ya seleccionadas -- pero nunca su stock (el
   *  stock de una presentación no depende de la fecha ni del canal, no hace falta volver a pedirlo). */
  private reconsultarPreciosDeTodas(): void {
    for (const fila of this.filas()) {
      if (fila.presentacionId) this.consultarPrecio(fila.id);
    }
  }

  /** Se dispara al elegir una presentación por primera vez en una fila: precio y stock, ambos nuevos. */
  private consultarPrecioYStock(id: string): void {
    this.consultarPrecio(id);
    this.consultarStock(id);
  }

  /**
   * Cancela la petición de precio anterior de ESA fila antes de lanzar la nueva -- una respuesta tardía de
   * una selección vieja (o de una fecha/canal ya reemplazados) nunca debe pisar el precio actual de esa fila
   * (mismo criterio que el resto de la app, ahora aplicado por fila en vez de a todo el formulario).
   */
  private consultarPrecio(id: string): void {
    const fila = this.filas().find((f) => f.id === id);
    const tipoCliente = this.form.controls.tipoCliente.value;
    const fecha = this.form.controls.fecha.value;
    if (!fila || !fila.presentacionId || !tipoCliente || !fecha) return;

    this.peticionesPrecio.get(id)?.unsubscribe();
    this.actualizarFila(id, { cargandoPrecio: true, errorPrecio: null });
    const precio$ = this.ventasApi.precioVigente(fila.presentacionId, tipoCliente, fecha).subscribe({
      next: (precio) => this.actualizarFila(id, { precioVigente: precio.precio, cargandoPrecio: false }),
      error: (error) => this.actualizarFila(id, { errorPrecio: mapHttpError(error).mensaje, cargandoPrecio: false })
    });
    this.peticionesPrecio.set(id, precio$);
  }

  /** Informativa (sin bloqueo): un fallo aquí no bloquea el carrito, solo no se muestra el stock de esa línea. */
  private consultarStock(id: string): void {
    const fila = this.filas().find((f) => f.id === id);
    if (!fila || !fila.presentacionId) return;

    this.peticionesStock.get(id)?.unsubscribe();
    this.actualizarFila(id, { cargandoStock: true });
    // Fase 2: se consulta el stock VENDIBLE (lotes vigentes), no el físico: lo vencido y lo sin trazabilidad no se venden.
    const stock$ = this.inventarioApi.obtenerExistencias(fila.presentacionId).subscribe({
      next: (e) => this.actualizarFila(id, {
        stockDisponible: e.stockVendible,
        stockNoVendible: Math.max(e.stockFisico - e.stockVendible, 0),
        cargandoStock: false
      }),
      error: () => this.actualizarFila(id, { cargandoStock: false })
    });
    this.peticionesStock.set(id, stock$);
  }

  protected readonly enviando = signal(false);
  /** true cuando el último intento falló por red (respuesta incierta): el reintento debe reenviar el mismo payload. */
  protected readonly incierto = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);
  protected readonly resultado = signal<VentaResumenResponse | null>(null);

  /** Payload congelado en el primer intento de confirmación; solo se reconstruye si el error anterior no fue de red. */
  private solicitudEnviada: CrearVentaCarritoRequest | null = null;

  protected continuarARevision(): void {
    if (this.filas().length === 0) {
      this.errorSinFilas.set(true);
      this.form.markAllAsTouched();
      return;
    }
    if (this.form.invalid || !this.puedeContinuar()) {
      this.form.markAllAsTouched();
      return;
    }
    this.paso.set('resumen');
  }

  protected volverAFormulario(): void {
    this.paso.set('formulario');
  }

  protected confirmar(): void {
    if (this.enviando()) return;

    if (!this.incierto()) {
      const { fecha, tipoCliente } = this.form.getRawValue();
      if (!tipoCliente || !this.puedeContinuar()) return;
      const detalles: DetalleVentaRequest[] = this.filas().map((f) => ({ presentacionId: f.presentacionId, cantidad: f.cantidad! }));
      const c = this.comprador();
      this.solicitudEnviada = { uuidCliente: this.uuidCliente, fecha, tipoCliente, detalles, comprador: c ? { tipo: c.tipo, id: c.id } : null };
    }
    // Si incierto() es true, se reenvía this.solicitudEnviada tal cual quedó armado la primera vez.

    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.ventasApi.crearCarrito(this.solicitudEnviada!).subscribe({
      next: (venta) => {
        this.enviando.set(false);
        this.incierto.set(false);
        this.resultado.set(venta);
        this.paso.set('resultado');
      },
      error: (error) => {
        this.enviando.set(false);
        const appError = mapHttpError(error);
        if (appError.tipo === 'red') {
          this.incierto.set(true);
          this.errorEnvio.set(
            'No se pudo confirmar si la venta quedó registrada por un problema de conexión. ' +
              'Presiona "Reintentar" sin cambiar los datos: el identificador de esta venta se conserva y el servidor no la duplicará.'
          );
        } else {
          this.incierto.set(false);
          this.solicitudEnviada = null;
          this.errorEnvio.set(appError.mensaje);
        }
      }
    });
  }

  protected imprimir(): void {
    window.print();
  }

  protected verDetalle(): void {
    const venta = this.resultado();
    if (venta) this.dialogRef.close({ venta, verDetalle: true });
  }

  protected cerrar(): void {
    const venta = this.resultado();
    this.dialogRef.close(venta ? { venta, verDetalle: false } : undefined);
  }
}
