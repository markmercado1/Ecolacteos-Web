import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { urlFoto } from '../../core/api/api-url';
import { ErrorAmigable, errorAmigable } from '../../core/api/http-error';
import { PresentacionCatalogo, ProductoCatalogo } from '../../core/api/catalogo.models';
import { CrearReservaRequest, ReglasReserva, ReservaPublica } from '../../core/api/reservas.models';
import { ReservasPublicasApi } from '../../core/api/reservas.api';
import { CarritoStore } from '../../core/state/carrito.store';
import { CatalogoStore } from '../../core/state/catalogo.store';
import { EstadoCargaComponent } from '../../shared/estado-carga';
import { ETIQUETA_ESTADO, contenidoAparte, etiquetaDePresentacion, fechaTitulo, formatearFecha, formatearFechaHora, formatearPrecio } from '../../shared/formato';

/** Teléfono peruano de celular: 9 dígitos que empiezan con 9, con o sin 51 / +51, con espacios o guiones (el servidor lo normaliza). */
export function telefonoValido(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '').trim();
  if (!valor) return null; // «obligatorio» lo valida Validators.required
  const digitos = valor.replace(/[\s-]/g, '').replace(/^\+/, '');
  return /^(51)?9\d{8}$/.test(digitos) && /^[+\d\s-]+$/.test(valor) ? null : { telefono: true };
}

interface LineaVista {
  presentacionId: string;
  cantidad: number;
  producto?: ProductoCatalogo;
  presentacion?: PresentacionCatalogo;
  /** Ya no está en el catálogo o se agotó: no se puede reservar. */
  noReservable: boolean;
  /** Pocas unidades: cuántas se pueden reservar (null = el catálogo no publica la cantidad). */
  maximo: number | null;
  /** Pidió más unidades de las que quedan (el stock bajó desde que las agregó). */
  excede: boolean;
}

/**
 * Reserva de productos (sin pagos). Todo lo que decide una regla de negocio lo decide el servidor: las fechas que se ofrecen
 * vienen de GET /catalogo/reservas/reglas, la disponibilidad de /catalogo/productos, y la reserva se valida al enviarla. La web
 * nunca marca una reserva como confirmada: muestra el estado que devuelve el servidor.
 */
@Component({
  selector: 'pub-reservar',
  imports: [ReactiveFormsModule, RouterLink, EstadoCargaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reservar.html',
  styleUrl: './reservar.css'
})
export class ReservarPage {
  protected readonly catalogo = inject(CatalogoStore);
  protected readonly carrito = inject(CarritoStore);
  private readonly api = inject(ReservasPublicasApi);
  private readonly fb = inject(FormBuilder);

  protected readonly reglas = signal<ReglasReserva | null>(null);
  protected readonly reglasEstado = signal<'cargando' | 'listo' | 'error'>('cargando');
  protected readonly reglasError = signal<string | null>(null);

  protected readonly enviando = signal(false);
  protected readonly intentado = signal(false);
  protected readonly errorEnvio = signal<ErrorAmigable | null>(null);
  protected readonly resultado = signal<ReservaPublica | null>(null);
  protected readonly copiado = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    fecha: ['', Validators.required],
    nombre: ['', [Validators.required, Validators.maxLength(80), (c: AbstractControl) => (String(c.value ?? '').trim() ? null : { required: true })]],
    telefono: ['', [Validators.required, Validators.maxLength(30), telefonoValido]],
    correo: ['', [Validators.email, Validators.maxLength(120)]],
    nota: ['', Validators.maxLength(300)]
  });

  protected readonly lineas = computed<LineaVista[]>(() => {
    const mapa = this.catalogo.presentaciones();
    return this.carrito.lineas().map((l) => {
      const hallada = mapa.get(l.presentacionId);
      return {
        presentacionId: l.presentacionId,
        cantidad: l.cantidad,
        producto: hallada?.producto,
        presentacion: hallada?.presentacion,
        noReservable: !hallada || hallada.presentacion.disponibilidad === 'AGOTADO',
        maximo: hallada?.presentacion.unidadesDisponibles ?? null,
        excede: (hallada?.presentacion.unidadesDisponibles ?? Infinity) < l.cantidad
      };
    });
  });

  protected readonly hayNoReservables = computed(() => this.catalogo.estado() === 'listo' && this.lineas().some((l) => l.noReservable));
  protected readonly hayExcesos = computed(() => this.catalogo.estado() === 'listo' && this.lineas().some((l) => !l.noReservable && l.excede));

  /** Suma de precios publicados por cantidad, o null si alguna línea tiene «Precio a confirmar». Orientativo: el total real lo devuelve el servidor. */
  protected readonly totalEstimado = computed<number | null>(() => {
    let total = 0;
    for (const l of this.lineas()) {
      const precio = l.presentacion?.precio;
      if (precio === null || precio === undefined) return null;
      total += precio * l.cantidad;
    }
    return total;
  });

  protected readonly hayPrecioPorConfirmar = computed(() => this.lineas().some((l) => l.presentacion?.precio === null));

  // Idempotencia: una clave por intento lógico; se renueva solo si cambian los datos tras un rechazo DEFINITIVO del servidor.
  private uuid: string | null = null;
  private ultimaFirma = '';
  private resultadoIncierto = false;

  constructor() {
    this.catalogo.cargar();
    this.cargarReglas();
  }

  protected cargarReglas(): void {
    this.reglasEstado.set('cargando');
    this.api.reglas().subscribe({
      next: (r) => {
        this.reglas.set(r);
        this.reglasEstado.set('listo');
        if (!r.fechasDisponibles.includes(this.form.controls.fecha.value)) this.form.controls.fecha.setValue('');
      },
      error: (e) => {
        this.reglasError.set(errorAmigable(e).mensaje);
        this.reglasEstado.set('error');
      }
    });
  }

  protected etiquetaFecha = fechaTitulo;
  protected fechaLarga = (iso: string) => formatearFecha(iso, true);
  protected fechaHora = formatearFechaHora;
  protected precio = formatearPrecio;
  protected contenidoAparte = contenidoAparte;
  protected etiquetaEstado = (e: ReservaPublica['estado']) => ETIQUETA_ESTADO[e];
  protected etiquetaDisponibilidad = etiquetaDePresentacion;
  protected foto = (l: LineaVista) => urlFoto(l.presentacion?.fotoUrl ?? l.producto?.fotoUrl);

  protected cambiarCantidad(presentacionId: string, valor: string): void {
    const n = Math.floor(Number(valor));
    this.carrito.cambiarCantidad(presentacionId, Number.isFinite(n) ? n : 1);
  }

  protected incrementar(l: LineaVista, delta: number): void {
    const siguiente = l.cantidad + delta;
    this.carrito.cambiarCantidad(l.presentacionId, Math.max(1, l.maximo !== null ? Math.min(l.maximo, siguiente) : siguiente));
  }

  protected invalido(nombre: 'fecha' | 'nombre' | 'telefono' | 'correo' | 'nota'): boolean {
    const c = this.form.controls[nombre];
    return c.invalid && (c.touched || this.intentado());
  }

  protected enviar(): void {
    if (this.enviando()) return; // clics repetidos: ya hay una solicitud en curso
    this.intentado.set(true);
    this.errorEnvio.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.lineas().length === 0 || this.hayNoReservables() || this.hayExcesos() || this.reglasEstado() !== 'listo') return;

    const v = this.form.getRawValue();
    const solicitud: Omit<CrearReservaRequest, 'uuidCliente'> = {
      nombreCliente: v.nombre.trim(),
      telefono: v.telefono.trim(),
      correo: v.correo.trim() || undefined,
      fechaRetiro: v.fecha,
      nota: v.nota.trim() || undefined,
      lineas: this.carrito.lineas().map((l) => ({ presentacionId: l.presentacionId, cantidad: l.cantidad }))
    };
    const firma = JSON.stringify(solicitud);
    if (!this.uuid || (firma !== this.ultimaFirma && !this.resultadoIncierto)) this.uuid = crypto.randomUUID();
    this.ultimaFirma = firma;

    this.enviando.set(true);
    this.api.crear({ uuidCliente: this.uuid, ...solicitud }).subscribe({
      next: (reserva) => {
        this.resultado.set(reserva);
        this.carrito.vaciar();
        this.uuid = null;
        this.resultadoIncierto = false;
        this.enviando.set(false);
      },
      error: (e) => {
        const err = errorAmigable(e);
        this.resultadoIncierto = err.resultadoIncierto;
        this.errorEnvio.set(
          err.resultadoIncierto ? { ...err, mensaje: `${err.mensaje} Si no ves la confirmación, vuelve a enviar el formulario: no se duplicará tu reserva.` } : err
        );
        this.enviando.set(false);
      }
    });
  }

  protected async copiarCodigo(codigo: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(codigo);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2500);
    } catch {
      /* sin portapapeles: el código sigue visible para copiarlo a mano */
    }
  }

  protected nuevaReserva(): void {
    this.resultado.set(null);
    this.form.reset();
    this.intentado.set(false);
    this.cargarReglas();
    this.catalogo.cargar(true);
  }
}
