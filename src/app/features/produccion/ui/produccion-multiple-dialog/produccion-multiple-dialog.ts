import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Subscription, firstValueFrom, forkJoin } from 'rxjs';
import { mapHttpError } from '../../../../core/http/app-error';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { fechaHoyLima } from '../../../../shared/util/fecha';
import { DisponibilidadProduccion, RecetaResponse } from '../../../catalogos/data-access/receta.models';
import { RecetasApi } from '../../../catalogos/data-access/recetas.api';
import { LoteProduccion, PlanificarLoteRequest } from '../../data-access/lote-produccion.models';
import { LotesProduccionApi } from '../../data-access/lotes-produccion.api';
import { sumarDisponibilidad } from '../../domain/disponibilidad-multiple';
import { errorLitrosProduccion } from '../../domain/validadores-produccion';
import { TablaDisponibilidadComponent } from '../tabla-disponibilidad/tabla-disponibilidad';

/** Espera tras el último cambio de una fila antes de pedir el cálculo al servidor. */
const RETRASO_CALCULO_MS = 300;

const ESTADO_PLANIFICADA = 'Planificada · sin consumo de stock';
const ESTADO_INICIADA = 'Iniciada · leche e insumos descontados';
const ESTADO_PENDIENTE = 'Pendiente · se enviará al reintentar';

type Modo = 'planificar' | 'iniciar';

interface FilaReceta {
  /** Identificador estable de la fila: también es el `uuidCliente` del lote (idempotencia de los reintentos). */
  uuid: string;
  recetaId: string;
  litros: number | null;
  calculo?: DisponibilidadProduccion;
  /** Solicitud congelada al primer envío: un reintento siempre reenvía exactamente lo mismo. */
  solicitud?: PlanificarLoteRequest;
  lote?: LoteProduccion;
  completada: boolean;
  estado: string;
}

export interface ProduccionMultipleResultado {
  /** Lotes que sí quedaron guardados en el servidor (incluidos los planificados cuyo inicio no se confirmó). */
  lotes: LoteProduccion[];
  /** true si el usuario eligió «Iniciar producción» (los lotes se planifican y se inician). */
  iniciar: boolean;
  /** true si todas las filas terminaron; false si el proceso se cerró con filas pendientes. */
  completo: boolean;
}

/**
 * Nueva producción con una o varias recetas. Cada fila (receta + litros) es un lote independiente: se envía
 * secuencialmente con `planificar` y, si se eligió iniciar, `iniciar`. NO es transaccional: si una fila falla, las
 * anteriores ya quedaron guardadas en el servidor y el proceso se detiene; al reintentar solo se repiten las filas
 * pendientes, con la misma solicitud y el mismo `uuidCliente`.
 *
 * El cálculo de cada receta lo hace el servidor (`GET /recetas/{id}/calculo`); aquí solo se suman las necesidades
 * (ver `sumarDisponibilidad`) para avisar si, juntas, las recetas piden más de lo que hay en inventario.
 */
@Component({
  selector: 'app-produccion-multiple-dialog',
  imports: [FormsModule, DecimalPipe, TablaDisponibilidadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './produccion-multiple-dialog.html',
  styleUrl: './produccion-multiple-dialog.css'
})
export class ProduccionMultipleDialog {
  private readonly ref = inject(DialogRef<ProduccionMultipleResultado | undefined>);
  private readonly dialog = inject(Dialog);
  private readonly recetasApi = inject(RecetasApi);
  private readonly lotesApi = inject(LotesProduccionApi);
  private readonly destroy = inject(DestroyRef);

  protected readonly recetas = signal<RecetaResponse[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorRecetas = signal<string | null>(null);

  protected readonly filas = signal<FilaReceta[]>([this.nuevaFila()]);
  protected fecha = fechaHoyLima();

  protected readonly calculando = signal(false);
  protected readonly errorCalculo = signal<string | null>(null);
  protected readonly errorEnvio = signal<string | null>(null);
  protected readonly enviando = signal(false);
  /** Tras el primer envío el formulario queda fijo: las solicitudes ya no cambian aunque se reintente. */
  protected readonly bloqueado = signal(false);
  protected readonly modo = signal<Modo | null>(null);

  protected readonly resumen = computed(() => {
    const filas = this.filas();
    return filas.every((fila) => fila.calculo) ? sumarDisponibilidad(filas.map((fila) => fila.calculo!)) : null;
  });
  protected readonly terminado = computed(() => this.filas().every((fila) => fila.completada));

  private consulta?: Subscription;
  private temporizador?: ReturnType<typeof setTimeout>;

  constructor() {
    this.ref.disableClose = true;
    this.destroy.onDestroy(() => {
      this.consulta?.unsubscribe();
      clearTimeout(this.temporizador);
    });
    this.cargarRecetas();
  }

  protected cargarRecetas(): void {
    this.cargando.set(true);
    this.errorRecetas.set(null);
    const suscripcion = this.recetasApi.listar().subscribe({
      next: (recetas) => {
        this.recetas.set(recetas.filter((receta) => receta.activo));
        this.cargando.set(false);
      },
      error: (e) => {
        this.errorRecetas.set(mapHttpError(e).mensaje);
        this.cargando.set(false);
      }
    });
    this.destroy.onDestroy(() => suscripcion.unsubscribe());
  }

  protected agregar(): void {
    if (this.bloqueado()) return;
    this.filas.update((filas) => [...filas, this.nuevaFila()]);
    this.recalcular();
  }

  protected quitar(uuid: string): void {
    if (this.bloqueado() || this.filas().length === 1) return;
    this.filas.update((filas) => filas.filter((fila) => fila.uuid !== uuid));
    this.recalcular();
  }

  protected cambiar(uuid: string, campo: 'recetaId' | 'litros', valor: string | number | null): void {
    if (this.bloqueado()) return;
    this.filas.update((filas) => filas.map((fila) => (fila.uuid === uuid ? { ...fila, [campo]: valor } : fila)));
    this.recalcular();
  }

  /** Invalida el resumen al instante y, cuando todas las filas son válidas, pide el cálculo de cada receta. */
  protected recalcular(): void {
    if (this.bloqueado()) return;
    clearTimeout(this.temporizador);
    this.consulta?.unsubscribe();
    this.filas.update((filas) => filas.map((fila) => ({ ...fila, calculo: undefined })));
    this.errorCalculo.set(null);
    this.calculando.set(false);
    if (!this.filas().every((fila) => this.filaValida(fila))) return;

    this.calculando.set(true);
    this.temporizador = setTimeout(() => this.calcular(), RETRASO_CALCULO_MS);
  }

  protected async enviar(iniciar: boolean): Promise<void> {
    if (this.enviando() || this.terminado()) return;
    if (!this.bloqueado() && !this.congelarSolicitudes(iniciar)) return;

    // El modo y las solicitudes quedan fijos incluso si una respuesta se perdió.
    const iniciarLotes = this.modo() === 'iniciar';
    this.enviando.set(true);
    this.errorEnvio.set(null);
    for (const fila of this.filas()) {
      if (fila.completada) continue;
      if (!(await this.procesar(fila, iniciarLotes))) {
        this.marcarPendientes(fila.uuid);
        break;
      }
    }
    this.enviando.set(false);
  }

  protected cerrar(): void {
    if (this.enviando()) return;
    const mensaje = this.mensajeAntesDeCerrar();
    if (!mensaje) {
      this.cerrarConResultado();
      return;
    }
    const confirmacion = this.dialog.open<boolean>(ConfirmDialog, {
      ariaLabel: 'Cerrar nueva producción',
      data: { titulo: 'Cerrar nueva producción', mensaje, etiquetaConfirmar: 'Cerrar', peligroso: true }
    });
    confirmacion.closed.subscribe((confirmado) => {
      if (confirmado) this.cerrarConResultado();
    });
  }

  private nuevaFila(): FilaReceta {
    return { uuid: crypto.randomUUID(), recetaId: '', litros: null, completada: false, estado: '' };
  }

  private filaValida(fila: FilaReceta): boolean {
    return fila.recetaId !== '' && fila.litros !== null && errorLitrosProduccion(fila.litros) === null;
  }

  private calcular(): void {
    const filas = this.filas();
    this.consulta = forkJoin(filas.map((fila) => this.recetasApi.calcular(fila.recetaId, fila.litros!))).subscribe({
      next: (calculos) => {
        this.filas.set(filas.map((fila, i) => ({ ...fila, calculo: calculos[i] })));
        this.calculando.set(false);
      },
      error: (e) => {
        this.errorCalculo.set(mapHttpError(e).mensaje);
        this.calculando.set(false);
      }
    });
  }

  /** Fija las solicitudes. Devuelve false (sin enviar nada) si el formulario está incompleto o, al iniciar, si falta stock para el conjunto. */
  private congelarSolicitudes(iniciar: boolean): boolean {
    const resumen = this.resumen();
    if (!this.fecha || !resumen || (iniciar && !resumen.todoDisponible)) return false;

    this.bloqueado.set(true);
    this.modo.set(iniciar ? 'iniciar' : 'planificar');
    this.filas.update((filas) =>
      filas.map((fila) => ({
        ...fila,
        solicitud: { uuidCliente: fila.uuid, recetaId: fila.recetaId, litros: fila.litros!, fecha: this.fecha }
      }))
    );
    return true;
  }

  /** Planifica (si hace falta) e inicia (si se eligió) una fila. Devuelve false si falló y hay que detener el proceso. */
  private async procesar(fila: FilaReceta, iniciar: boolean): Promise<boolean> {
    try {
      this.actualizar(fila.uuid, { estado: fila.lote ? 'Confirmando inicio…' : 'Guardando plan…' });
      const lote = fila.lote ?? (await firstValueFrom(this.lotesApi.planificar(fila.solicitud!)));
      this.actualizar(fila.uuid, { lote, estado: iniciar ? 'Iniciando…' : ESTADO_PLANIFICADA });

      const resultado = iniciar ? await firstValueFrom(this.lotesApi.iniciar(lote.id)) : lote;
      this.actualizar(fila.uuid, {
        lote: resultado,
        completada: true,
        estado: iniciar ? ESTADO_INICIADA : ESTADO_PLANIFICADA
      });
      return true;
    } catch (e) {
      const planGuardado = this.filas().find((f) => f.uuid === fila.uuid)?.lote !== undefined;
      this.actualizar(fila.uuid, {
        estado: planGuardado ? 'Plan guardado · inicio no confirmado' : 'Registro no confirmado'
      });
      this.errorEnvio.set(
        `${mapHttpError(e).mensaje} Se detuvo el proceso. Reintenta para continuar; ` +
          'las recetas completadas no se repetirán.'
      );
      return false;
    }
  }

  /** Las filas que no llegaron a enviarse se rotulan para que el estado final sea coherente. */
  private marcarPendientes(uuidFallida: string): void {
    this.filas.update((filas) =>
      filas.map((fila) =>
        fila.completada || fila.uuid === uuidFallida ? fila : { ...fila, estado: ESTADO_PENDIENTE }
      )
    );
  }

  private actualizar(uuid: string, datos: Partial<FilaReceta>): void {
    this.filas.update((filas) => filas.map((fila) => (fila.uuid === uuid ? { ...fila, ...datos } : fila)));
  }

  /** Texto de la confirmación al cerrar, o null si se puede cerrar sin preguntar. */
  private mensajeAntesDeCerrar(): string | null {
    if (this.terminado()) return null;
    if (this.bloqueado()) {
      return (
        'Hay operaciones pendientes de confirmar. Los lotes guardados se conservan. ' +
        'Consulta el historial antes de registrar otra vez estas recetas.'
      );
    }
    const conSeleccion = this.filas().some((fila) => fila.recetaId !== '' || fila.litros !== null);
    return conSeleccion ? 'Se descartará esta selección de recetas.' : null;
  }

  private cerrarConResultado(): void {
    const lotes = this.filas().flatMap((fila) => (fila.lote ? [fila.lote] : []));
    if (lotes.length === 0) {
      this.ref.close(undefined);
      return;
    }
    this.ref.close({ lotes, iniciar: this.modo() === 'iniciar', completo: this.terminado() });
  }
}
