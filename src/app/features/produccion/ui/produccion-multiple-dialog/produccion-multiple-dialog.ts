import { ChangeDetectionStrategy, Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { DialogRef } from '@angular/cdk/dialog';
import { firstValueFrom, forkJoin, Subscription } from 'rxjs';
import { RecetasApi } from '../../../catalogos/data-access/recetas.api';
import { DisponibilidadProduccion, LineaDisponibilidad, RecetaResponse } from '../../../catalogos/data-access/receta.models';
import { LotesProduccionApi } from '../../data-access/lotes-produccion.api';
import { LoteProduccion, PlanificarLoteRequest } from '../../data-access/lote-produccion.models';
import { fechaHoyLima } from '../../../../shared/util/fecha';
import { mapHttpError } from '../../../../core/http/app-error';
import { TablaDisponibilidadComponent } from '../tabla-disponibilidad/tabla-disponibilidad';

interface FilaReceta {
  uuid: string;
  recetaId: string;
  litros: number | null;
  calculo?: DisponibilidadProduccion;
  solicitud?: PlanificarLoteRequest;
  lote?: LoteProduccion;
  completada?: boolean;
  estado: string;
}
export interface ProduccionMultipleResultado { lotes: LoteProduccion[]; }

/** Suma necesidades calculadas por el servidor en centésimas; nunca suma el stock compartido. */
export function sumarDisponibilidad(calculos: DisponibilidadProduccion[]): DisponibilidadProduccion {
  const lineas = new Map<string, LineaDisponibilidad>();
  for (const c of calculos) for (const linea of [c.leche, ...c.insumos]) {
    const clave = linea.insumoId ?? 'leche';
    const previa = lineas.get(clave);
    const requerido = (Math.round((previa?.requerido ?? 0) * 100) + Math.round(linea.requerido * 100)) / 100;
    const disponible = Math.min(previa?.disponible ?? linea.disponible, linea.disponible);
    lineas.set(clave, { ...linea, requerido, disponible,
      suficiente: requerido <= disponible,
      faltante: Math.max(0, Math.round((requerido - disponible) * 100) / 100) });
  }
  const leche = lineas.get('leche')!;
  return { leche, insumos: [...lineas.values()].filter(l => l.insumoId !== null),
    litrosSolicitados: leche.requerido, factor: null, cantidadEsperada: null, presentacionNombre: null,
    unidadConteo: null, litrosMaximos: null, cantidadEsperadaMaxima: null,
    todoDisponible: [...lineas.values()].every(l => l.suficiente) && calculos.every(c => c.todoDisponible) };
}

@Component({
  selector: 'app-produccion-multiple-dialog',
  imports: [FormsModule, DecimalPipe, TablaDisponibilidadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './produccion-multiple-dialog.html',
  styleUrl: './produccion-multiple-dialog.css',
})
export class ProduccionMultipleDialog {
  private readonly ref = inject(DialogRef<ProduccionMultipleResultado>);
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
  protected readonly bloqueado = signal(false);
  protected readonly modo = signal<'planificar' | 'iniciar' | null>(null);
  private consulta?: Subscription;
  private temporizador?: ReturnType<typeof setTimeout>;
  protected readonly resumen = computed(() => this.filas().every(f => f.calculo) ? sumarDisponibilidad(this.filas().map(f => f.calculo!)) : null);
  protected readonly terminado = computed(() => this.filas().every(f => f.completada));

  constructor() {
    this.ref.disableClose = true;
    this.cargarRecetas();
    this.destroy.onDestroy(() => { this.consulta?.unsubscribe(); clearTimeout(this.temporizador); });
  }
  private nuevaFila(): FilaReceta { return { uuid: crypto.randomUUID(), recetaId: '', litros: null, estado: '' }; }
  protected cargarRecetas(): void {
    this.cargando.set(true); this.errorRecetas.set(null);
    const sub = this.recetasApi.listar().subscribe({
      next: recetas => { this.recetas.set(recetas.filter(r => r.activo)); this.cargando.set(false); },
      error: e => { this.errorRecetas.set(mapHttpError(e).mensaje); this.cargando.set(false); },
    });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }
  protected agregar(): void {
    if (this.bloqueado()) return;
    this.filas.update(f => [...f, this.nuevaFila()]); this.recalcular();
  }
  protected quitar(uuid: string): void {
    if (this.bloqueado() || this.filas().length === 1) return;
    this.filas.update(f => f.filter(x => x.uuid !== uuid)); this.recalcular();
  }
  protected cambiar(uuid: string, campo: 'recetaId' | 'litros', valor: string | number | null): void {
    if (this.bloqueado()) return;
    this.filas.update(f => f.map(x => x.uuid === uuid ? { ...x, [campo]: valor } as FilaReceta : x));
    this.recalcular();
  }
  protected recalcular(): void {
    if (this.bloqueado()) return;
    clearTimeout(this.temporizador); this.consulta?.unsubscribe();
    this.filas.update(f => f.map(x => ({ ...x, calculo: undefined })));
    this.errorCalculo.set(null); this.calculando.set(false);
    if (!this.filas().every(f => f.recetaId && f.litros !== null && Number.isFinite(f.litros) && f.litros > 0 && f.litros <= 9999999.99 && Math.abs(f.litros * 100 - Math.round(f.litros * 100)) < 1e-6)) return;
    this.calculando.set(true);
    this.temporizador = setTimeout(() => {
      const filas = this.filas();
      this.consulta = forkJoin(filas.map(f => this.recetasApi.calcular(f.recetaId, f.litros!))).subscribe({
        next: calculos => { this.filas.set(filas.map((f, i) => ({ ...f, calculo: calculos[i] }))); this.calculando.set(false); },
        error: e => { this.errorCalculo.set(mapHttpError(e).mensaje); this.calculando.set(false); },
      });
    }, 300);
  }
  protected async enviar(iniciar: boolean): Promise<void> {
    if (this.enviando() || this.terminado()) return;
    if (!this.bloqueado()) {
      if (!this.fecha || !this.resumen() || (iniciar && !this.resumen()!.todoDisponible)) return;
      this.bloqueado.set(true); this.modo.set(iniciar ? 'iniciar' : 'planificar');
      this.filas.update(f => f.map(x => ({ ...x, solicitud: { uuidCliente: x.uuid, recetaId: x.recetaId, litros: x.litros!, fecha: this.fecha } })));
    }
    // El modo y las solicitudes quedan fijos incluso tras una respuesta perdida.
    iniciar = this.modo() === 'iniciar';
    this.enviando.set(true); this.errorEnvio.set(null);
    for (const fila of this.filas()) {
      if (fila.completada) continue;
      try {
        this.actualizar(fila.uuid, { estado: fila.lote ? 'Confirmando inicio…' : 'Guardando plan…' });
        const lote = fila.lote ?? await firstValueFrom(this.lotesApi.planificar(fila.solicitud!));
        this.actualizar(fila.uuid, { lote, estado: iniciar ? 'Iniciando…' : 'Planificada · sin consumo de stock' });
        const resultado = iniciar ? await firstValueFrom(this.lotesApi.iniciar(lote.id)) : lote;
        this.actualizar(fila.uuid, { lote: resultado, completada: true, estado: iniciar ? 'Iniciada · leche e insumos descontados' : 'Planificada · sin consumo de stock' });
      } catch (e) {
        const guardada = this.filas().find(f => f.uuid === fila.uuid)?.lote;
        this.actualizar(fila.uuid, { estado: guardada ? 'Plan guardado · inicio no confirmado' : 'Registro no confirmado' });
        this.errorEnvio.set(mapHttpError(e).mensaje + ' Se detuvo el proceso. Reintenta para continuar; las recetas completadas no se repetirán.');
        break;
      }
    }
    this.enviando.set(false);
  }
  private actualizar(uuid: string, datos: Partial<FilaReceta>): void { this.filas.update(f => f.map(x => x.uuid === uuid ? { ...x, ...datos } : x)); }
  protected cerrar(): void {
    if (this.enviando()) return;
    if (!this.terminado() && (this.bloqueado() || this.filas().some(f => f.recetaId || f.litros)) &&
      !window.confirm(this.bloqueado() ? 'Hay operaciones pendientes de confirmar. Los lotes guardados se conservan. Consulta el historial antes de registrar otra vez estas recetas. ¿Cerrar?' : '¿Cerrar y descartar esta selección de recetas?')) return;
    this.ref.close({ lotes: this.filas().flatMap(f => f.lote ? [f.lote] : []) });
  }
}
