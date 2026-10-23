import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { mapHttpError } from '../../../../core/http/app-error';
import { fechaHoraActualLima } from '../../../../shared/util/fecha';
import { JornadaDetalle } from '../../../acopios/acopios.api';
import { RecepcionApi } from '../../../recepcion/data-access/recepcion.api';
import { RecepcionJornadaRequest, ResultadoRecepcionJornada } from '../../data-access/jornada.models';
import { JornadasApi } from '../../data-access/jornadas.api';

/** Turnos que acepta el backend (los mismos de la app móvil). `UNICO` es el valor por defecto del servidor. */
export const TURNOS_RECEPCION = [
  { valor: 'MAÑANA', texto: 'Mañana' },
  { valor: 'TARDE', texto: 'Tarde' },
  { valor: 'UNICO', texto: 'Único' },
] as const;

/** Tamaño máximo de página que acepta GET /recepcion-planta. */
const TAMANO_CONSULTA_TURNOS = 100;
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_FECHA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * Códigos HTTP en los que el servidor no pudo haber registrado la recepción. Los demás errores (sin respuesta, 5xx,
 * 408, 409, 429) son inciertos: la recepción pudo haberse guardado aunque la respuesta se perdiera.
 */
function esRechazoDefinitivo(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) return false;
  return error.status >= 400 && error.status < 500 && ![408, 409, 429].includes(error.status);
}

/**
 * Formulario de recepción de una jornada en planta (POST /api/sync/recepciones-jornada, roles RECEPCION y ADMIN).
 *
 * Idempotencia: la primera vez que se envía, la solicitud (con su `uuidCliente`) queda congelada. Si la respuesta se
 * pierde o es incierta, el formulario se bloquea y «Reintentar» reenvía EXACTAMENTE la misma solicitud, de modo que el
 * servidor devuelve la recepción ya creada en vez de duplicarla. Solo cuando el servidor rechazó de forma definitiva la
 * solicitud (rechazo individual en un HTTP 200 o un error 4xx) se libera el formulario para corregirla y se genera un
 * `uuidCliente` nuevo, porque esa solicitud corregida es otra distinta.
 */
@Component({
  selector: 'app-recepcion-jornada-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recepcion-jornada-form.html',
  styleUrl: './recepcion-jornada-form.css',
})
export class RecepcionJornadaForm implements OnInit {
  readonly jornada = input.required<JornadaDetalle>();
  /** El servidor confirmó la recepción de esta solicitud. */
  readonly recibida = output<void>();

  private readonly jornadasApi = inject(JornadasApi);
  private readonly recepcionApi = inject(RecepcionApi);
  private readonly destroy = inject(DestroyRef);

  protected readonly turnos = TURNOS_RECEPCION;
  protected readonly form = new FormGroup({
    litrosReales: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    horaLlegada: new FormControl(fechaHoraActualLima(), { nonNullable: true, validators: [Validators.required] }),
    turno: new FormControl<string>('UNICO', {
      nonNullable: true,
      validators: [Validators.pattern(/^(MAÑANA|TARDE|UNICO)$/)],
    }),
    observacion: new FormControl('', { nonNullable: true }),
  });

  readonly enviando = signal(false);
  protected readonly errorRecepcion = signal<string | null>(null);
  /** Solicitud ya enviada (o en vuelo) cuyo resultado no está confirmado: se reintenta idéntica. */
  protected readonly intento = signal<RecepcionJornadaRequest | null>(null);
  private uuidCliente = crypto.randomUUID();

  protected readonly turnosRegistrados = signal<string[]>([]);
  protected readonly consultandoTurnos = signal(false);
  protected readonly errorTurnos = signal<string | null>(null);
  private consultaTurnos?: Subscription;

  constructor() {
    this.destroy.onDestroy(() => this.consultaTurnos?.unsubscribe());
    this.form.controls.horaLlegada.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => this.consultarTurnos());
  }

  ngOnInit(): void {
    this.consultarTurnos();
  }

  /** ¿Cerrar el diálogo perdería datos escritos o dejaría una confirmación sin comprobar? */
  haySinGuardar(): boolean {
    return this.form.dirty || this.intento() !== null;
  }

  /**
   * Marca los turnos que ya tienen una recepción de este vehículo en la fecha de llegada elegida. Es solo informativo:
   * el servidor valida la recepción.
   */
  protected consultarTurnos(): void {
    this.consultaTurnos?.unsubscribe();
    this.turnosRegistrados.set([]);
    this.errorTurnos.set(null);
    this.consultandoTurnos.set(false);

    const unidadId = this.jornada().unidadId;
    const fecha = this.form.controls.horaLlegada.value.slice(0, 10);
    if (!unidadId) return;
    if (!FORMATO_FECHA.test(fecha)) {
      this.errorTurnos.set('Selecciona una fecha de llegada válida.');
      return;
    }

    this.consultandoTurnos.set(true);
    const consulta = new Subscription();
    this.consultaTurnos = consulta;
    const registrados = new Set<string>();
    const pedirPagina = (page: number): void => {
      consulta.add(
        this.recepcionApi.listar({ unidadId, fecha, page, size: TAMANO_CONSULTA_TURNOS }).subscribe({
          next: (pagina) => {
            pagina.contenido.forEach((recepcion) => registrados.add(recepcion.turno));
            if (page + 1 < pagina.totalPaginas) {
              pedirPagina(page + 1);
              return;
            }
            this.turnosRegistrados.set([...registrados]);
            this.consultandoTurnos.set(false);
          },
          error: (e) => {
            this.errorTurnos.set(mapHttpError(e).mensaje);
            this.consultandoTurnos.set(false);
          },
        }),
      );
    };
    pedirPagina(0);
  }

  protected recibir(): void {
    if (this.enviando() || this.jornada().estado !== 'REGRESANDO_A_PLANTA') return;

    const solicitud = this.intento() ?? this.armarSolicitud();
    if (!solicitud) return;

    this.intento.set(solicitud);
    this.enviando.set(true);
    this.errorRecepcion.set(null);
    this.jornadasApi
      .recepcionar(solicitud)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (resultado) => this.alResponder(solicitud, resultado),
        error: (e) => this.alFallar(e),
      });
  }

  /** Congela los datos del formulario en una solicitud con su `uuidCliente`; null si el formulario no es válido. */
  private armarSolicitud(): RecepcionJornadaRequest | null {
    this.form.markAllAsTouched();
    const valores = this.form.getRawValue();
    const litros = valores.litrosReales;
    if (this.form.invalid || litros === null || !Number.isFinite(litros)) return null;
    if (!FORMATO_FECHA_HORA.test(valores.horaLlegada)) return null;

    return {
      uuidCliente: this.uuidCliente,
      jornadaId: this.jornada().id,
      litrosReales: litros,
      // El valor de datetime-local ya está en hora de Lima y el backend espera un LocalDateTime sin zona.
      horaLlegada: `${valores.horaLlegada}:00`,
      observacion: valores.observacion.trim() || null,
      turno: valores.turno,
    };
  }

  /** El HTTP 200 puede traer rechazos individuales: solo `confirmados` con el uuid propio cuenta como éxito. */
  private alResponder(solicitud: RecepcionJornadaRequest, resultado: ResultadoRecepcionJornada): void {
    this.enviando.set(false);
    const rechazo = resultado.errores?.find((e) => e.uuidCliente === solicitud.uuidCliente);
    if (rechazo) {
      this.liberarParaCorregir(rechazo.motivo);
    } else if (resultado.confirmados?.includes(solicitud.uuidCliente)) {
      this.recibida.emit();
    } else {
      this.errorRecepcion.set('El servidor no confirmó esta recepción. No se ha anunciado como recibida.');
    }
  }

  private alFallar(error: unknown): void {
    this.enviando.set(false);
    const mensaje = mapHttpError(error).mensaje;
    if (esRechazoDefinitivo(error)) this.liberarParaCorregir(mensaje);
    else this.errorRecepcion.set(mensaje);
  }

  /** El servidor rechazó la solicitud: se puede corregir, y la corregida es otra solicitud con identificador nuevo. */
  private liberarParaCorregir(motivo: string): void {
    this.intento.set(null);
    this.uuidCliente = crypto.randomUUID();
    this.errorRecepcion.set(motivo);
  }
}
