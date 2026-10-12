import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DialogRef } from '@angular/cdk/dialog';
import { combineLatest, debounceTime, distinctUntilChanged, of, switchMap, catchError, map, tap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { mapHttpError } from '../../../../core/http/app-error';
import { fechaHoyLima } from '../../../../shared/util/fecha';
import { DisponibilidadProduccion, RecetaResponse } from '../../../catalogos/data-access/receta.models';
import { RecetasApi } from '../../../catalogos/data-access/recetas.api';
import { LoteProduccion, PlanificarLoteRequest } from '../../data-access/lote-produccion.models';
import { LotesProduccionApi } from '../../data-access/lotes-produccion.api';
import { litrosProduccionValidator } from '../../domain/validadores-produccion';
import { TablaDisponibilidadComponent } from '../tabla-disponibilidad/tabla-disponibilidad';

export interface NuevaProduccionResultado {
  lote: LoteProduccion;
  /** true si además de planificar se inició (se consumió el stock). */
  iniciada: boolean;
}

type EstadoCalculo =
  | { tipo: 'vacio' }
  | { tipo: 'cargando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'ok'; clave: string; calculo: DisponibilidadProduccion };

/**
 * Nueva producción desde una receta (V18). El usuario elige receta y litros de leche; TODO el cálculo
 * (factor, insumos escalados, salida esperada, validación contra stock y máximo producible) lo hace el
 * backend (GET /api/recetas/{id}/calculo) -- este diálogo solo lo muestra. "Iniciar" queda deshabilitado si
 * falta cualquier stock; el backend lo vuelve a validar y bloquea al iniciar. Nunca se ajusta la cantidad
 * solicitada en silencio: "Usar el máximo" es una acción explícita.
 *
 * Planificar e iniciar son dos llamadas: si iniciar falla (p. ej. el stock cambió entretanto), el plan queda
 * guardado como PLANIFICADA y se informa; nunca se pierde ni se duplica (uuidCliente estable).
 */
@Component({
  selector: 'app-nueva-produccion-dialog',
  imports: [ReactiveFormsModule, DecimalPipe, RouterLink, TablaDisponibilidadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nueva-produccion-dialog.html',
  styleUrl: './nueva-produccion-dialog.css'
})
export class NuevaProduccionDialog {
  protected readonly dialogRef = inject(DialogRef<NuevaProduccionResultado | undefined>);
  private readonly fb = inject(FormBuilder);
  private readonly recetasApi = inject(RecetasApi);
  private readonly lotesApi = inject(LotesProduccionApi);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);

  protected readonly esAdmin = computed(() => this.auth.usuario()?.rolNombre === 'ADMIN');
  /** Una sola vez por operación: un reintento de "planificar" nunca duplica el lote. */
  private readonly uuidCliente = crypto.randomUUID();

  protected readonly recetas = signal<RecetaResponse[]>([]);
  protected readonly cargandoRecetas = signal(true);
  protected readonly errorRecetas = signal<string | null>(null);

  protected readonly form = this.fb.group({
    recetaId: this.fb.nonNullable.control('', Validators.required),
    fecha: this.fb.nonNullable.control(fechaHoyLima(), Validators.required),
    litros: this.fb.control<number | null>(null, [Validators.required, litrosProduccionValidator])
  });

  private readonly estadoFormulario = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  private readonly recetaIdValor = toSignal(this.form.controls.recetaId.valueChanges, { initialValue: '' });
  private readonly litrosValor = toSignal(this.form.controls.litros.valueChanges, { initialValue: null as number | null });

  protected readonly receta = computed(() => this.recetas().find((r) => r.id === this.recetaIdValor()) ?? null);

  protected readonly calculo = signal<EstadoCalculo>({ tipo: 'vacio' });
  /** El cálculo mostrado corresponde EXACTAMENTE a la receta y litros actuales (nunca uno viejo). */
  protected readonly calculoVigente = computed(() => {
    const c = this.calculo();
    return c.tipo === 'ok' && c.clave === this.claveActual() ? c.calculo : null;
  });
  private readonly claveActual = computed(() => `${this.recetaIdValor()}|${this.litrosValor()}`);
  protected readonly errorCalculo = computed(() => {
    const c = this.calculo();
    return c.tipo === 'error' ? c.mensaje : null;
  });

  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);
  /** Lote ya planificado en este diálogo (p. ej. si iniciar falló después): los datos quedan fijos. */
  protected readonly lotePlanificado = signal<LoteProduccion | null>(null);
  /** true tras un error de red al planificar: los datos quedan fijos y solo se puede reintentar igual. */
  protected readonly incierto = signal(false);
  private solicitudIncierta: PlanificarLoteRequest | null = null;

  protected readonly puedePlanificar = computed(
    () =>
      !this.enviando() &&
      (this.incierto() || (this.calculoVigente() !== null && this.estadoFormulario() === 'VALID'))
  );
  protected readonly puedeIniciar = computed(
    () => this.puedePlanificar() && (this.calculoVigente()?.todoDisponible ?? false)
  );

  constructor() {
    this.cargarRecetas();

    // Recalcula en el backend cuando cambian receta o litros (con debounce y cancelando la consulta
    // anterior, para que una respuesta vieja nunca pise a una nueva).
    combineLatest([toObservable(this.recetaIdValor), toObservable(this.litrosValor)])
      .pipe(
        debounceTime(300),
        distinctUntilChanged(([r1, l1], [r2, l2]) => r1 === r2 && l1 === l2),
        switchMap(([recetaId, litros]) => {
          if (!recetaId || this.form.controls.litros.invalid || litros === null) {
            return of<EstadoCalculo>({ tipo: 'vacio' });
          }
          const clave = `${recetaId}|${litros}`;
          this.calculo.set({ tipo: 'cargando' });
          return this.recetasApi.calcular(recetaId, litros).pipe(
            map((calculo): EstadoCalculo => ({ tipo: 'ok', clave, calculo })),
            catchError((e) => of<EstadoCalculo>({ tipo: 'error', mensaje: mapHttpError(e).mensaje }))
          );
        }),
        tap((estado) => this.calculo.set(estado)),
        takeUntilDestroyed(this.destroy)
      )
      .subscribe();
  }

  protected cargarRecetas(): void {
    this.cargandoRecetas.set(true);
    this.errorRecetas.set(null);
    this.recetasApi
      .listar()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (recetas) => {
          this.recetas.set(recetas.filter((r) => r.activo));
          this.cargandoRecetas.set(false);
        },
        error: (e) => {
          this.errorRecetas.set(mapHttpError(e).mensaje);
          this.cargandoRecetas.set(false);
        }
      });
  }

  /** Decisión explícita del usuario: producir con el máximo que permite el stock actual. */
  protected usarMaximo(): void {
    const maximo = this.calculoVigente()?.litrosMaximos;
    if (maximo && maximo > 0) {
      this.form.controls.litros.setValue(maximo);
      this.form.controls.litros.markAsTouched();
    }
  }

  protected invalido(campo: 'recetaId' | 'fecha' | 'litros'): boolean {
    const c = this.form.controls[campo];
    return c.invalid && c.touched;
  }

  protected guardarPlanificada(): void {
    this.enviar(false);
  }

  protected iniciar(): void {
    this.enviar(true);
  }

  private enviar(iniciar: boolean): void {
    if (this.enviando()) return;
    const yaPlanificado = this.lotePlanificado();
    const reintento = this.solicitudIncierta;
    if (!yaPlanificado && !reintento && (iniciar ? !this.puedeIniciar() : !this.puedePlanificar())) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.errorEnvio.set(null);

    // Tras un error de red se reenvía EXACTAMENTE la misma solicitud (mismo uuidCliente y datos): si el
    // servidor ya la había registrado, devuelve ese lote en vez de duplicarlo.
    const solicitud = reintento ?? {
      uuidCliente: this.uuidCliente,
      fecha: this.form.controls.fecha.value,
      recetaId: this.form.controls.recetaId.value,
      litros: this.form.controls.litros.value!
    };
    const plan$ = yaPlanificado ? of(yaPlanificado) : this.lotesApi.planificar(solicitud);

    plan$
      .pipe(
        tap((lote) => {
          this.lotePlanificado.set(lote);
          this.solicitudIncierta = null;
          this.form.disable({ emitEvent: false }); // el plan ya existe: sus datos quedan fijos
        }),
        switchMap((lote) => (iniciar ? this.lotesApi.iniciar(lote.id) : of(lote)))
      )
      .subscribe({
        next: (lote) => {
          this.enviando.set(false);
          this.dialogRef.close({ lote, iniciada: iniciar });
        },
        error: (e) => {
          this.enviando.set(false);
          const error = mapHttpError(e);
          const plan = this.lotePlanificado();
          if (plan && iniciar) {
            this.errorEnvio.set(
              `La producción quedó guardada como planificada, pero no se pudo iniciar: ${error.mensaje}`
            );
          } else if (error.tipo === 'red') {
            this.solicitudIncierta = solicitud;
            this.incierto.set(true);
            this.form.disable({ emitEvent: false });
            this.errorEnvio.set(
              'No se pudo confirmar el registro por un problema de conexión. Vuelve a intentarlo sin cambiar los datos: el identificador se conserva y no se duplicará.'
            );
          } else {
            this.errorEnvio.set(error.mensaje);
          }
        }
      });
  }

  protected cerrar(): void {
    const plan = this.lotePlanificado();
    this.dialogRef.close(plan ? { lote: plan, iniciada: false } : undefined);
  }
}
