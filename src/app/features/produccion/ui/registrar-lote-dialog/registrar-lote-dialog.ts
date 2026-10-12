import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { AuthService } from '../../../../core/auth/auth.service';
import { mapHttpError } from '../../../../core/http/app-error';
import { fechaHoyLima } from '../../../../shared/util/fecha';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { InventarioApi } from '../../../inventario/data-access/inventario.api';
import {
  PresentacionResponse,
  ProductoResponse
} from '../../../catalogos/data-access/producto.models';
import { ProductosApi } from '../../../catalogos/data-access/productos.api';
import { InsumoResponse } from '../../../catalogos/data-access/insumo.models';
import { InsumosApi } from '../../../catalogos/data-access/insumos.api';
import {
  CrearLoteRequest,
  DetalleSalidaRequest,
  InsumoLoteRequest,
  LoteProduccion
} from '../../data-access/lote-produccion.models';
import { LotesProduccionApi } from '../../data-access/lotes-produccion.api';
import { revisarProduccion } from '../../domain/revision-produccion';
import { litrosProduccionValidator } from '../../domain/validadores-produccion';

/** Asistente: 1 leche -> 2 insumos -> 3 producto obtenido -> 4 resumen. Nada se guarda hasta "Finalizar". */
type Paso = 'leche' | 'insumos' | 'obtenido' | 'resumen' | 'resultado';
type CampoLote = 'fecha' | 'productoId' | 'litrosUsados';

/** MAX_DIGITOS_ENTEROS_LITROS_USADOS de la app móvil: columna real precision=9, scale=2 (9-2=7). Sin cambios
 *  con el refactor -- litrosUsados sigue siendo la misma columna, solo cambió su validación de negocio. */
const MAX_DIGITOS_ENTEROS_LITROS_USADOS = 7;

export interface RegistrarLoteDialogResultado {
  lote: LoteProduccion;
  verDetalle: boolean;
}

interface FilaInsumo {
  insumoId: string;
  cantidad: number | null;
}

interface FilaDetalleForm {
  presentacionId: string;
  cantidadObtenida: number | null;
}

function fechaNoFuturaValidator(control: AbstractControl): ValidationErrors | null {
  const valor = control.value;
  if (!valor) return null;
  return valor > fechaHoyLima() ? { fechaFutura: true } : null;
}

function maxDigitosEnterosValidator(max: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (valor === null || valor === undefined || valor === '') return null;
    const parteEntera = Math.trunc(Math.abs(Number(valor))).toString();
    return parteEntera.length > max ? { maxDigitosEnteros: true } : null;
  };
}

function mayorQueCeroValidator(control: AbstractControl): ValidationErrors | null {
  const valor = control.value;
  if (valor === null || valor === undefined || valor === '') return null; // required ya cubre el vacío
  return Number(valor) > 0 ? null : { mayorQueCero: true };
}

function enteroPositivoValidator(control: AbstractControl): ValidationErrors | null {
  const valor = control.value;
  if (valor === null || valor === undefined || valor === '') return null;
  return Number.isInteger(valor) && valor >= 1 ? null : { enteroPositivo: true };
}

/**
 * Registrar un lote de producción (PRODUCCION/ADMIN). Refactor de Producción, fase 4 (consumo de leche por
 * FIFO automático, sin selección manual de registros de acopio) + Fase 3 (Producción con varias
 * presentaciones de salida): un lote corresponde a UN producto elaborado pero puede generar VARIAS
 * presentaciones de salida (ej. 20 botellas de 2 L + 40 de 1 L del mismo lote) -- el consumo de leche sigue
 * siendo uno solo por lote, nunca uno por presentación.
 *
 * "Leche disponible" es informativa (GET /api/inventario/leche/saldo, sin bloqueo): el backend es la
 * autoridad real al confirmar. "Unidades esperadas" es una vista previa puramente informativa, calculada
 * con el MISMO criterio que el backend (ver LoteProduccionService.aplicarRendimiento): solo cuando hay
 * exactamente UNA presentación obtenida, esa presentación no declara contenido (shape "Unidad"/"Pieza") y
 * el producto tiene rendimiento esperado configurado -- nunca solo por tener una única fila.
 *
 * El caso real de una producción que no obtuvo ninguna presentación aprovechable (lote perdido, ya existía
 * antes de esta fase) es una elección EXPLÍCITA del usuario (checkbox "sin rendimiento"), nunca el resultado
 * accidental de no llenar la sección de presentaciones.
 */
@Component({
  selector: 'app-registrar-lote-dialog',
  imports: [ReactiveFormsModule, DecimalPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './registrar-lote-dialog.html',
  styleUrl: './registrar-lote-dialog.css'
})
export class RegistrarLoteDialog {
  protected readonly dialogRef = inject(DialogRef<RegistrarLoteDialogResultado | undefined>);
  private readonly fb = inject(FormBuilder);
  private readonly lotesApi = inject(LotesProduccionApi);
  private readonly productosApi = inject(ProductosApi);
  private readonly insumosApi = inject(InsumosApi);
  private readonly inventarioApi = inject(InventarioApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(Dialog);
  private readonly destroy = inject(DestroyRef);

  protected readonly maxDigitos = MAX_DIGITOS_ENTEROS_LITROS_USADOS;
  protected readonly esAdmin = computed(() => this.auth.usuario()?.rolNombre === 'ADMIN');

  /** Una sola vez por operación; se conserva ante cualquier reintento (idempotencia del backend). */
  protected readonly uuidCliente = crypto.randomUUID();

  protected readonly paso = signal<Paso>('leche');
  protected readonly pasosAsistente: { id: Paso; etiqueta: string }[] = [
    { id: 'leche', etiqueta: 'Leche' },
    { id: 'insumos', etiqueta: 'Insumos' },
    { id: 'obtenido', etiqueta: 'Producto obtenido' },
    { id: 'resumen', etiqueta: 'Confirmar' }
  ];
  protected readonly indicePaso = computed(() =>
    this.pasosAsistente.findIndex((p) => p.id === this.paso())
  );

  // Insumos: opcionales. Se cargan recién al llegar al paso 2 (no hacen falta antes). Si el catálogo está
  // vacío, o el insumo usado no existe en él, el lote se registra igual sin insumos.
  protected readonly insumosDisponibles = signal<InsumoResponse[]>([]);
  protected readonly cargandoInsumos = signal(false);
  protected readonly errorInsumos = signal<string | null>(null);
  private insumosCargados = false;
  protected readonly filasInsumos = signal<FilaInsumo[]>([]);
  protected readonly insumoParaAgregar = signal('');
  protected readonly errorPasoInsumos = signal<string | null>(null);
  protected readonly insumosRestantes = computed(() => {
    const usados = new Set(this.filasInsumos().map((f) => f.insumoId));
    return this.insumosDisponibles().filter((i) => !usados.has(i.id));
  });

  protected readonly cargandoSaldo = signal(true);
  protected readonly errorSaldo = signal<string | null>(null);
  protected readonly saldoDisponible = signal<number | null>(null);

  protected readonly productos = signal<ProductoResponse[]>([]);
  protected readonly cargandoProductos = signal(true);
  protected readonly errorProductos = signal<string | null>(null);

  protected readonly errorSinFilas = signal(false);

  protected readonly form = this.fb.group({
    fecha: this.fb.nonNullable.control(fechaHoyLima(), [
      Validators.required,
      fechaNoFuturaValidator
    ]),
    productoId: this.fb.nonNullable.control('', Validators.required),
    litrosUsados: this.fb.control<number | null>(null, [
      Validators.required,
      mayorQueCeroValidator,
      litrosProduccionValidator,
      maxDigitosEnterosValidator(MAX_DIGITOS_ENTEROS_LITROS_USADOS)
    ]),
    sinRendimiento: this.fb.nonNullable.control(false)
  });

  protected readonly detalles = this.fb.array<
    FormGroup<{ presentacionId: FormControl<string>; cantidadObtenida: FormControl<number | null> }>
  >([]);

  protected readonly motivoRendimiento = this.fb.nonNullable.control('', Validators.maxLength(500));
  protected readonly errorRevision = signal<string | null>(null);
  private readonly sinRendimientoValor = toSignal(this.form.controls.sinRendimiento.valueChanges, {
    initialValue: false
  });

  private readonly productoIdValor = toSignal(this.form.controls.productoId.valueChanges, {
    initialValue: this.form.controls.productoId.value
  });
  private readonly litrosUsadosValor = toSignal(this.form.controls.litrosUsados.valueChanges, {
    initialValue: this.form.controls.litrosUsados.value
  });
  private readonly detallesValor = toSignal(this.detalles.valueChanges, {
    initialValue: [] as FilaDetalleForm[]
  });

  protected readonly revision = computed(() =>
    revisarProduccion(
      this.litrosUsadosValor() ?? 0,
      this.sinRendimientoValor()
        ? []
        : this.detallesValor().map((fila) => ({
            presentacionId: fila.presentacionId ?? '',
            cantidadObtenida: fila.cantidadObtenida ?? 0
          })),
      this.presentacionesDisponibles(),
      this.productoSeleccionado()?.rangoRendimiento
    )
  );

  protected readonly errorLeche = computed(() => {
    if (this.cargandoSaldo()) return 'Espera a que se consulte la leche disponible.';
    if (this.errorSaldo() || this.saldoDisponible() === null)
      return 'Consulta nuevamente el saldo de leche antes de continuar.';
    return (this.litrosUsadosValor() ?? 0) > this.saldoDisponible()!
      ? 'La leche a utilizar supera el saldo disponible. Revisa los litros ingresados o actualiza el saldo.'
      : null;
  });

  protected readonly productoSeleccionado = computed(
    () => this.productos().find((p) => p.id === this.productoIdValor()) ?? null
  );

  protected readonly presentacionesDisponibles = computed<PresentacionResponse[]>(
    () => this.productoSeleccionado()?.presentaciones.filter((p) => p.activo) ?? []
  );

  /** Por fila: sus opciones excluyen las presentaciones ya elegidas en OTRAS filas (evita duplicados en la UI). */
  protected readonly presentacionesSeleccionablesPorFila = computed<PresentacionResponse[][]>(
    () => {
      const todas = this.presentacionesDisponibles();
      const valores = this.detallesValor();
      return valores.map((_, i) => {
        const usadasEnOtras = new Set(
          valores
            .filter((_v, j) => j !== i)
            .map((v) => v.presentacionId)
            .filter(Boolean)
        );
        return todas.filter((p) => !usadasEnOtras.has(p.id));
      });
    }
  );

  protected readonly puedeAgregarFila = computed(() => {
    const usadas = new Set(
      this.detallesValor()
        .map((v) => v.presentacionId)
        .filter(Boolean)
    );
    return this.presentacionesDisponibles().some((p) => !usadas.has(p.id));
  });

  /**
   * Vista previa client-side, puramente informativa -- el servidor calcula y congela el valor real. Mismo
   * criterio exacto que LoteProduccionService.aplicarRendimiento: solo con una única fila cuya presentación
   * no declara contenido (shape "Unidad"/"Pieza") y el producto con rendimiento esperado configurado.
   */
  protected readonly unidadesEsperadas = computed(() => {
    const producto = this.productoSeleccionado();
    const litros = this.litrosUsadosValor();
    const filas = this.detallesValor().filter((f) => f.presentacionId);
    if (!producto || producto.rendimientoEsperadoPct === null || !litros || litros <= 0)
      return null;
    if (filas.length !== 1) return null;
    const presentacion = this.presentacionesDisponibles().find(
      (p) => p.id === filas[0].presentacionId
    );
    if (!presentacion || presentacion.contenidoCantidad !== null) return null;
    return Math.round((litros * producto.rendimientoEsperadoPct) / 100);
  });

  protected readonly filasResumen = computed(() =>
    this.detallesValor()
      .filter((f) => f.presentacionId)
      .map((f) => ({
        presentacionId: f.presentacionId,
        nombre:
          this.presentacionesDisponibles().find((p) => p.id === f.presentacionId)?.nombre ?? '—',
        contenido: this.presentacionesDisponibles().find((p) => p.id === f.presentacionId)
          ?.contenidoCantidad,
        unidad: this.presentacionesDisponibles().find((p) => p.id === f.presentacionId)
          ?.contenidoUnidad,
        cantidad: f.cantidadObtenida ?? 0
      }))
  );

  protected readonly enviando = signal(false);
  /** true cuando el último intento falló por red (respuesta incierta): el reintento debe reenviar el mismo payload. */
  protected readonly incierto = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);
  protected readonly resultado = signal<LoteProduccion | null>(null);

  /** Payload congelado en el primer intento; solo se reconstruye si el error anterior no fue de red. */
  private solicitudEnviada: CrearLoteRequest | null = null;
  private productoIdAnterior = '';

  constructor() {
    this.cargarSaldo();
    this.cargarProductos();

    // Si cambia el producto con salidas ya ingresadas que no pertenecen al nuevo producto, avisa antes de
    // descartarlas -- nunca las conserva en silencio ni las descarta sin confirmar.
    this.form.controls.productoId.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((nuevoProductoId) => {
        const anterior = this.productoIdAnterior;
        const presentacionesNuevas = new Set(
          (this.productos().find((p) => p.id === nuevoProductoId)?.presentaciones ?? [])
            .filter((p) => p.activo)
            .map((p) => p.id)
        );
        const filasIncompatibles = this.detalles.controls.some(
          (fila) =>
            fila.controls.presentacionId.value &&
            !presentacionesNuevas.has(fila.controls.presentacionId.value)
        );

        if (!filasIncompatibles) {
          this.productoIdAnterior = nuevoProductoId;
          return;
        }

        const ref = this.dialog.open<boolean>(ConfirmDialog, {
          ariaLabel: 'Confirmar cambio de producto',
          data: {
            titulo: 'Cambiar de producto',
            mensaje:
              'Las presentaciones ya ingresadas pertenecen al producto anterior y se perderán al cambiar. ¿Continuar?',
            etiquetaConfirmar: 'Cambiar de todas formas',
            peligroso: true
          }
        });
        ref.closed.subscribe((confirmado) => {
          if (confirmado) {
            this.detalles.clear();
            this.productoIdAnterior = nuevoProductoId;
          } else {
            this.form.controls.productoId.setValue(anterior);
          }
        });
      });
  }

  protected cargarSaldo(): void {
    this.cargandoSaldo.set(true);
    this.errorSaldo.set(null);
    this.inventarioApi
      .obtenerSaldoLeche()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (saldo) => {
          this.saldoDisponible.set(saldo.litrosDisponibles);
          this.cargandoSaldo.set(false);
        },
        error: (error) => {
          this.errorSaldo.set(mapHttpError(error).mensaje);
          this.cargandoSaldo.set(false);
        }
      });
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

  protected cargarInsumos(): void {
    this.cargandoInsumos.set(true);
    this.errorInsumos.set(null);
    const catalogo$ = this.esAdmin() ? this.insumosApi.listar() : this.insumosApi.listarOperativo();
    catalogo$.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (insumos) => {
        this.insumosDisponibles.set(insumos.filter((i) => i.activo));
        this.insumosCargados = true;
        this.cargandoInsumos.set(false);
      },
      error: (error) => {
        this.errorInsumos.set(mapHttpError(error).mensaje);
        this.cargandoInsumos.set(false);
      }
    });
  }

  protected agregarInsumo(): void {
    const id = this.insumoParaAgregar();
    if (!id) return;
    this.filasInsumos.update((filas) => [...filas, { insumoId: id, cantidad: null }]);
    this.insumoParaAgregar.set('');
  }

  protected quitarInsumo(insumoId: string): void {
    this.filasInsumos.update((filas) => filas.filter((f) => f.insumoId !== insumoId));
  }

  protected actualizarCantidadInsumo(insumoId: string, valor: string): void {
    const cantidad = valor === '' ? null : Number(valor);
    this.filasInsumos.update((filas) =>
      filas.map((f) => (f.insumoId === insumoId ? { ...f, cantidad } : f))
    );
  }

  protected datosInsumo(insumoId: string): InsumoResponse | undefined {
    return this.insumosDisponibles().find((i) => i.id === insumoId);
  }

  private insumosIncompletos(): boolean {
    return this.filasInsumos().some(
      (f) => f.cantidad === null || !Number.isFinite(f.cantidad) || f.cantidad <= 0
    );
  }

  /** Enter o "Siguiente" dentro del formulario: avanza según el paso actual. */
  protected siguiente(): void {
    if (this.paso() === 'leche') this.siguienteDesdeLeche();
    else if (this.paso() === 'insumos') this.siguienteDesdeInsumos();
    else if (this.paso() === 'obtenido') this.continuarARevision();
  }

  protected atras(): void {
    const anterior: Partial<Record<Paso, Paso>> = {
      insumos: 'leche',
      obtenido: 'insumos',
      resumen: 'obtenido'
    };
    const destino = anterior[this.paso()];
    if (destino) this.paso.set(destino);
  }

  private lecheValida(): boolean {
    const { fecha, productoId, litrosUsados } = this.form.controls;
    return fecha.valid && productoId.valid && litrosUsados.valid;
  }

  protected siguienteDesdeLeche(): void {
    this.errorRevision.set(null);
    if (!this.lecheValida()) {
      this.form.controls.fecha.markAsTouched();
      this.form.controls.productoId.markAsTouched();
      this.form.controls.litrosUsados.markAsTouched();
      return;
    }
    const error = this.errorLeche();
    if (error || !this.productoSeleccionado()?.activo) {
      this.errorRevision.set(error ?? 'Selecciona un producto activo.');
      return;
    }
    if (!this.insumosCargados && !this.cargandoInsumos()) this.cargarInsumos();
    this.paso.set('insumos');
  }

  protected siguienteDesdeInsumos(): void {
    this.errorPasoInsumos.set(null);
    if (this.insumosIncompletos()) {
      this.errorPasoInsumos.set(
        'Completa la cantidad de cada insumo agregado (mayor que 0), o quítalo.'
      );
      return;
    }
    this.paso.set('obtenido');
  }

  protected agregarFila(): void {
    this.detalles.push(
      this.fb.group({
        presentacionId: this.fb.nonNullable.control('', Validators.required),
        cantidadObtenida: this.fb.control<number | null>(null, [
          Validators.required,
          enteroPositivoValidator,
          Validators.max(2147483647)
        ])
      })
    );
  }

  protected quitarFila(indice: number): void {
    this.detalles.removeAt(indice);
  }

  protected invalido(campo: CampoLote): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

  protected continuarARevision(): void {
    this.errorSinFilas.set(false);
    this.errorRevision.set(null);
    const sinRendimiento = this.form.controls.sinRendimiento.value;

    // Si el problema está en un paso anterior, vuelve a ese paso para que se vea el error.
    if (!this.lecheValida() || this.errorLeche() || !this.productoSeleccionado()?.activo) {
      this.form.markAllAsTouched();
      this.paso.set('leche');
      if (this.lecheValida()) {
        this.errorRevision.set(this.errorLeche() ?? 'Selecciona un producto activo.');
      }
      return;
    }
    if (this.insumosIncompletos()) {
      this.paso.set('insumos');
      this.errorPasoInsumos.set(
        'Completa la cantidad de cada insumo agregado (mayor que 0), o quítalo.'
      );
      return;
    }
    this.paso.set('obtenido');
    if (!sinRendimiento && this.detalles.length === 0) {
      this.errorSinFilas.set(true);
      return;
    }
    if (!sinRendimiento && this.detalles.invalid) {
      this.detalles.markAllAsTouched();
      return;
    }
    const error = this.revision().error;
    if (error) {
      this.errorRevision.set(error);
      return;
    }
    this.motivoRendimiento.reset();
    this.paso.set('resumen');
  }

  protected confirmar(): void {
    if (this.enviando()) return;

    if (!this.incierto()) {
      if (this.paso() !== 'resumen') return;
      const error = this.errorLeche() ?? this.revision().error;
      if (
        error ||
        this.form.invalid ||
        (!this.form.controls.sinRendimiento.value && this.detalles.invalid) ||
        this.insumosIncompletos()
      ) {
        this.errorEnvio.set(error ?? 'Revisa los datos del lote antes de confirmar.');
        return;
      }
      const motivo = this.motivoRendimiento.value.trim();
      if (this.motivoRendimiento.invalid || (this.revision().fueraDeRango && !motivo)) {
        this.errorEnvio.set(
          'Indica un motivo de hasta 500 caracteres para confirmar el rendimiento fuera de rango.'
        );
        return;
      }
      const { fecha, productoId, litrosUsados, sinRendimiento } = this.form.getRawValue();
      if (litrosUsados === null) return;
      const detalles: DetalleSalidaRequest[] = sinRendimiento
        ? []
        : this.detalles.controls.map((f) => ({
            presentacionId: f.controls.presentacionId.value,
            cantidadObtenida: f.controls.cantidadObtenida.value!
          }));
      const insumos: InsumoLoteRequest[] = this.filasInsumos().map((f) => ({
        insumoId: f.insumoId,
        cantidad: f.cantidad!
      }));
      this.solicitudEnviada = {
        uuidCliente: this.uuidCliente,
        fecha,
        productoId,
        litrosUsados,
        detalles,
        motivoRendimiento: motivo || null,
        insumos
      };
    }
    // Si incierto() es true, se reenvía this.solicitudEnviada tal cual quedó armado la primera vez.

    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.lotesApi.crear(this.solicitudEnviada!).subscribe({
      next: (lote) => {
        this.enviando.set(false);
        this.incierto.set(false);
        this.resultado.set(lote);
        this.paso.set('resultado');
      },
      error: (error) => {
        this.enviando.set(false);
        const appError = mapHttpError(error);
        if (appError.tipo === 'red') {
          this.incierto.set(true);
          this.errorEnvio.set(
            'No se pudo confirmar si el lote quedó registrado por un problema de conexión. ' +
              'Presiona "Reintentar" sin cambiar los datos: el identificador de este lote se conserva y el servidor no lo duplicará.'
          );
        } else {
          this.incierto.set(false);
          this.solicitudEnviada = null;
          this.errorEnvio.set(appError.mensaje);
        }
      }
    });
  }

  protected verDetalle(): void {
    const lote = this.resultado();
    if (lote) this.dialogRef.close({ lote, verDetalle: true });
  }

  protected cerrar(): void {
    const lote = this.resultado();
    this.dialogRef.close(lote ? { lote, verDetalle: false } : undefined);
  }
}
