import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ZonaResponse } from '../../../catalogos/data-access/zona.models';
import { ZonasApi } from '../../../catalogos/data-access/zonas.api';
import { RutasApi } from '../../../rutas/data-access/rutas.api';
import { UsuarioResponse } from '../../../usuarios/data-access/usuario.models';
import { UnidadRequest, UnidadResponse } from '../../data-access/unidad.models';
import { UnidadesApi } from '../../data-access/unidades.api';
import { pendientesDe, resumenPendientes } from '../../../../shared/util/validacion';
import { etiquetaRol } from '../../../../shared/models/rol';

const ETIQUETAS: Record<string, string> = {"placa":"Placa","capacidadTon":"Capacidad","responsableId":"Responsable"};

export interface UnidadFormDialogData {
  /** Usuarios elegibles como responsable: rol ACOPIADOR y activos. */
  responsables: UsuarioResponse[];
  /**
   * Solo si se está editando y el responsable actual de la unidad NO está en
   * `responsables` (rol distinto o inactivo). Se muestra explícitamente en
   * vez de sustituirlo en silencio (docs de la corrección: "no sustituirlo
   * silenciosamente"). Si no se pudo encontrar su registro completo, queda
   * undefined y se usa igual `unidad.responsableNombre` para no perder el dato.
   */
  responsableActual?: UsuarioResponse;
  unidad?: UnidadResponse;
  /** Preselecciona el responsable (llega desde el enlace "Asignar unidad" de Acopiadores). */
  responsableIdInicial?: string;
}

type EstadoRuta = 'cargando' | 'con-ruta' | 'sin-ruta' | 'error';

interface ZonaConRuta {
  zona: ZonaResponse;
  estadoRuta: EstadoRuta;
}

/**
 * El campo de zona es informativo, no una relación nueva del contrato: la
 * unidad solo guarda `zonaId` (docs/CONTRATOS.md, UnidadRequest). Esta
 * pantalla, además, consulta GET /api/zonas/{zonaId}/ruta de cada zona para
 * indicar si ya tiene un recorrido configurado, y por eso resuelve su propio
 * catálogo (con carga/error/reintento propios) en vez de recibirlo ya
 * armado del componente que la abre.
 */
@Component({
  selector: 'app-unidad-form-dialog',
  imports: [ReactiveFormsModule, LoadingStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="unidad-form-titulo">{{ esEdicion ? 'Editar unidad' : 'Nueva unidad' }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="unidad-form-titulo">
      <div class="field" [class.has-error]="invalido('placa')">
        <label for="placa">Placa</label>
        <input id="placa" type="text" formControlName="placa" required>
        @if (invalido('placa')) { <span class="error">La placa es obligatoria.</span> }
      </div>
      <div class="field">
        <label for="capacidadTon">Capacidad (toneladas, opcional)</label>
        <input id="capacidadTon" type="number" min="0" step="0.1" formControlName="capacidadTon">
      </div>

      <div class="field">
        <label for="zonaId">Zona (opcional)</label>
        <p class="hint">
          Se usa para consultar si esa zona ya tiene una ruta de visita configurada. No asigna
          ni restringe al acopiador a esa zona: las zonas siguen libres.
        </p>

        @if (cargandoZonas()) {
          <ui-loading-state mensaje="Cargando zonas…" />
        } @else if (errorZonas()) {
          <ui-error-state [error]="errorZonas()" (reintentar)="cargarZonas()" />
        } @else {
          <input
            type="search"
            [value]="busquedaZona()"
            (input)="busquedaZona.set($any($event.target).value)"
            placeholder="Buscar zona por nombre"
            aria-label="Buscar zona por nombre"
          >
          <select id="zonaId" formControlName="zonaId">
            <option value="">Sin zona</option>
            @for (zc of zonasVisibles(); track zc.zona.id) {
              <option [value]="zc.zona.id">{{ zc.zona.nombre }} — {{ etiquetaRuta(zc.estadoRuta) }}</option>
            }
          </select>
          @if (zonasConRuta().length === 0) {
            <span class="hint">No hay zonas registradas todavía.</span>
          } @else if (busquedaZona() && zonasVisibles().length === 0) {
            <span class="hint">Ninguna zona coincide con "{{ busquedaZona() }}".</span>
          }
        }
      </div>

      <div class="field" [class.has-error]="invalido('responsableId')">
        <label for="responsableId">Responsable (acopiador)</label>
        @if (data.responsableActual) {
          <p class="warning-inline">
            El responsable actual, <strong>{{ data.responsableActual.nombre }}</strong>,
            tiene rol {{ etiquetaRol(data.responsableActual.rolNombre) }}{{ data.responsableActual.activo ? '' : ' e inactivo' }}
            y no aparece en la lista de acopiadores activos. Puedes conservarlo o elegir otro.
          </p>
        } @else if (data.unidad && sinCoincidenciaDeResponsable()) {
          <p class="warning-inline">
            El responsable actual de esta unidad es <strong>{{ data.unidad.responsableNombre }}</strong>,
            pero no se pudo verificar su rol ni si sigue activo. Puedes conservarlo o elegir otro.
          </p>
        }
        <select id="responsableId" formControlName="responsableId" required>
          <option value="" disabled>Selecciona un responsable</option>
          @if (data.responsableActual) {
            <optgroup label="Responsable actual (revisar)">
              <option [value]="data.responsableActual.id">
                {{ data.responsableActual.nombre }} — {{ etiquetaRol(data.responsableActual.rolNombre) }}{{ data.responsableActual.activo ? '' : ', inactivo' }}
              </option>
            </optgroup>
          } @else if (data.unidad && sinCoincidenciaDeResponsable()) {
            <optgroup label="Responsable actual (revisar)">
              <option [value]="data.unidad.responsableId">{{ data.unidad.responsableNombre }}</option>
            </optgroup>
          }
          <optgroup label="Acopiadores activos">
            @for (responsable of data.responsables; track responsable.id) {
              <option [value]="responsable.id">{{ responsable.nombre }}</option>
            }
          </optgroup>
        </select>
        @if (invalido('responsableId')) { <span class="error">El responsable es obligatorio.</span> }
        @if (data.responsables.length === 0) {
          <span class="hint">No hay usuarios con rol ACOPIADOR activos. Crea uno primero en Acopiadores.</span>
        }
      </div>
      @if (resumen(); as r) { <p class="server-error" role="alert" data-testid="resumen-errores">{{ r }}</p> }

      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }

      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando()">
          {{ enviando() ? 'Guardando…' : (esEdicion ? 'Guardar cambios' : 'Crear unidad') }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block; width: min(28rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 85vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    .field input[type='search'] { margin-bottom: var(--space-2); }
    .warning-inline {
      background: var(--color-warning-bg); color: var(--color-warning);
      border-radius: var(--radius-control); padding: var(--space-2) var(--space-3);
      font-size: 0.75rem; margin: 0 0 var(--space-2);
    }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class UnidadFormDialog {
  protected readonly etiquetaRol = etiquetaRol;
  protected readonly dialogRef = inject(DialogRef<UnidadResponse | undefined>);
  protected readonly data = inject<UnidadFormDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly unidadesApi = inject(UnidadesApi);
  private readonly zonasApi = inject(ZonasApi);
  private readonly rutasApi = inject(RutasApi);

  protected readonly esEdicion = !!this.data.unidad;
  protected readonly enviando = signal(false);
  /** Frase general tras un intento de guardar con datos pendientes; el detalle va junto a cada campo. */
  protected readonly resumen = signal<string | null>(null);
  protected readonly errorServidor = signal<string | null>(null);

  protected readonly cargandoZonas = signal(true);
  protected readonly errorZonas = signal<AppError | null>(null);
  protected readonly zonasConRuta = signal<ZonaConRuta[]>([]);
  protected readonly busquedaZona = signal('');

  protected readonly form = this.fb.group({
    placa: this.fb.nonNullable.control(this.data.unidad?.placa ?? '', Validators.required),
    capacidadTon: this.fb.control<number | null>(this.data.unidad?.capacidadTon ?? null),
    zonaId: this.fb.nonNullable.control(this.data.unidad?.zonaId ?? ''),
    responsableId: this.fb.nonNullable.control(
      this.data.unidad?.responsableId ?? this.data.responsableIdInicial ?? '',
      Validators.required
    )
  });

  constructor() {
    this.cargarZonas();
  }

  protected invalido(campo: 'placa' | 'responsableId'): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

  /** true si la unidad tiene responsable pero no vino su ficha completa (ni en elegibles ni en responsableActual). */
  protected sinCoincidenciaDeResponsable(): boolean {
    const id = this.data.unidad?.responsableId;
    if (!id) return false;
    if (this.data.responsableActual) return false;
    return !this.data.responsables.some((r) => r.id === id);
  }

  protected zonasVisibles(): ZonaConRuta[] {
    const termino = this.busquedaZona().trim().toLowerCase();
    const seleccionActual = this.form.get('zonaId')?.value;
    if (!termino) return this.zonasConRuta();
    return this.zonasConRuta().filter(
      (zc) => zc.zona.nombre.toLowerCase().includes(termino) || zc.zona.id === seleccionActual
    );
  }

  protected etiquetaRuta(estado: EstadoRuta): string {
    switch (estado) {
      case 'cargando': return 'consultando ruta…';
      case 'con-ruta': return 'con ruta configurada';
      case 'sin-ruta': return 'sin ruta configurada';
      case 'error': return 'ruta: no se pudo consultar';
    }
  }

  protected cargarZonas(): void {
    this.cargandoZonas.set(true);
    this.errorZonas.set(null);
    this.zonasApi.listarAdmin().subscribe({
      next: (zonas) => {
        this.zonasConRuta.set(zonas.map((zona) => ({ zona, estadoRuta: 'cargando' as const })));
        this.cargandoZonas.set(false);
        // Catálogo de zonas típicamente pequeño (ver docs/ALCANCE.md); se
        // consulta la ruta de cada una en paralelo, cada una con su propio
        // resultado, para no confundir un error puntual con "sin ruta".
        zonas.forEach((zona) => this.consultarRuta(zona.id));
      },
      error: (error) => {
        this.errorZonas.set(mapHttpError(error));
        this.cargandoZonas.set(false);
      }
    });
  }

  private consultarRuta(zonaId: string): void {
    this.rutasApi.listar(zonaId).subscribe({
      next: (items) => this.actualizarEstadoRuta(zonaId, items.length > 0 ? 'con-ruta' : 'sin-ruta'),
      error: () => this.actualizarEstadoRuta(zonaId, 'error')
    });
  }

  private actualizarEstadoRuta(zonaId: string, estado: EstadoRuta): void {
    this.zonasConRuta.update((actual) =>
      actual.map((zc) => (zc.zona.id === zonaId ? { ...zc, estadoRuta: estado } : zc))
    );
  }

  enviar(): void {
    if (this.enviando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.resumen.set(resumenPendientes(pendientesDe(this.form, ETIQUETAS)));
      return;
    }
    this.resumen.set(null);
    this.enviando.set(true);
    this.errorServidor.set(null);
    const { placa, capacidadTon, zonaId, responsableId } = this.form.getRawValue();
    const datos: UnidadRequest = { placa, capacidadTon: capacidadTon ?? null, zonaId: zonaId || null, responsableId };

    const peticion = this.esEdicion
      ? this.unidadesApi.actualizar(this.data.unidad!.id, datos)
      : this.unidadesApi.crear(datos);

    peticion.subscribe({
      next: (unidad) => this.dialogRef.close(unidad),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
