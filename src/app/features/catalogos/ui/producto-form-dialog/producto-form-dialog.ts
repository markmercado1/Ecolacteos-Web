import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { mapHttpError } from '../../../../core/http/app-error';
import { FamiliaResponse } from '../../data-access/familia.models';
import { FamiliasApi } from '../../data-access/familias.api';
import { ProductoResponse, RangoRendimiento } from '../../data-access/producto.models';
import { ProductosApi } from '../../data-access/productos.api';
import { FotoCambio, FotoCampo } from '../foto-campo/foto-campo';

export interface ProductoFormDialogData {
  producto?: ProductoResponse;
}

export interface ProductoFormDialogResultado {
  producto: ProductoResponse;
  /** true solo cuando este diálogo acaba de CREAR el producto (no al editar uno existente) -- la página
   *  usa esto para decidir si abre a continuación el diálogo de presentaciones. */
  esNuevo: boolean;
  /** Mensaje si el producto se guardó pero la foto no se pudo subir/quitar (el producto NO se revierte). */
  errorFoto?: string;
}

/**
 * Fase 1 (Producto + Presentación) -- corrección de UX: este diálogo contiene SOLO los datos del producto.
 * Las presentaciones se gestionan en un diálogo separado (`PresentacionesDialog`), abierto por la página
 * después de que este se cierra (nunca apilados) -- ver CatalogosPage.nuevoProducto()/abrirPresentaciones().
 *
 * rendimientoEsperadoPct/cicloCapital son atributos de producción de queso específicamente, no comerciales
 * -- opcionales: un producto de otra familia se guarda sin ellos, sin inventar un valor.
 */
@Component({
  selector: 'app-producto-form-dialog',
  imports: [ReactiveFormsModule, FotoCampo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="producto-titulo">{{ esEdicion ? 'Editar producto' : 'Nuevo producto' }}</h2>
      <button type="button" class="close" (click)="cerrar()" aria-label="Cerrar">×</button>
    </div>

    <form
      [formGroup]="form"
      (ngSubmit)="guardar()"
      class="dialog-body"
      aria-labelledby="producto-titulo"
    >
      <div class="field" [class.has-error]="invalido('nombre')">
        <label for="nombre">Nombre</label>
        <input id="nombre" type="text" formControlName="nombre" maxlength="60" required />
        @if (invalido('nombre')) {
          <span class="error">Ingresa un nombre (máximo 60 caracteres).</span>
        }
      </div>

      <div class="field" [class.has-error]="invalido('familiaId')">
        <label for="familia">Familia</label>
        @if (cargandoFamilias()) {
          <p class="hint">Cargando familias…</p>
        } @else if (errorFamilias()) {
          <p class="error" role="alert">{{ errorFamilias() }}</p>
          <button type="button" class="btn small" (click)="cargarFamilias()">Reintentar</button>
        } @else if (familias().length === 0) {
          <p class="error" role="alert">
            No hay familias activas. Crea una familia antes de crear un producto.
          </p>
        } @else {
          <select id="familia" formControlName="familiaId" required>
            <option value="" disabled>Selecciona una familia</option>
            @for (f of familias(); track f.id) {
              <option [value]="f.id">{{ f.nombre }}</option>
            }
          </select>
        }
        @if (invalido('familiaId')) {
          <span class="error">Selecciona una familia.</span>
        }
      </div>

      <p class="hint">
        Rendimiento esperado y ciclo de capital son específicos de producción de queso. Déjalos
        vacíos si no aplican a este producto.
      </p>
      <div class="field" [class.has-error]="invalido('rendimientoEsperadoPct')">
        <label for="rendimiento">Rendimiento esperado (%) — opcional</label>
        <input
          id="rendimiento"
          type="number"
          min="0"
          max="999.99"
          step="0.01"
          formControlName="rendimientoEsperadoPct"
        />
        @if (invalido('rendimientoEsperadoPct')) {
          <span class="error">Debe estar entre 0 y 999,99.</span>
        }
      </div>
      <div class="field">
        <label for="ciclo">Ciclo de capital — opcional</label>
        <select id="ciclo" formControlName="cicloCapital">
          <option value="">No aplica</option>
          <option value="RAPIDO">Rápido</option>
          <option value="MADURACION">Maduración</option>
        </select>
      </div>

      <app-foto-campo
        etiqueta="Foto del producto — opcional"
        [fotoUrl]="data.producto?.fotoUrl"
        ayuda="Es la que verá el público. JPEG, PNG o WebP; se reduce automáticamente."
        (cambio)="fotoCambio = $event"
      />

      @if (errorServidor()) {
        <p class="server-error" role="alert">{{ errorServidor() }}</p>
      }
      <fieldset class="field">
        <legend>Prevención de errores en producción</legend>
        <label class="opcion-rango">
          <input type="checkbox" formControlName="usarRango" />
          Configurar rango de salida por cada 100 L de leche
        </label>
        <p class="hint">
          Define los límites de tu proceso. Fuera de este rango se pedirá un motivo antes de
          registrar el lote.
        </p>
        @if (form.controls.usarRango.value) {
          <label for="rango-unidad">Unidad de salida</label>
          <select id="rango-unidad" formControlName="rangoUnidad">
            <option value="KG">Kilogramos</option>
            <option value="L">Litros</option>
            <option value="UNIDAD">Unidades (una sola presentación por lote)</option>
          </select>
          <label for="rango-minimo">Mínimo por 100 L</label>
          <input
            id="rango-minimo"
            type="number"
            min="0"
            step="0.0001"
            formControlName="rangoMinimo"
          />
          <label for="rango-maximo">Máximo por 100 L</label>
          <input
            id="rango-maximo"
            type="number"
            min="0.0001"
            step="0.0001"
            formControlName="rangoMaximo"
          />
          <p class="hint">
            Para kg o L, cada presentación debe tener contenido compatible. No se convierten litros
            en kilos.
          </p>
        }
        @if (errorRango()) {
          <p class="error" role="alert">{{ errorRango() }}</p>
        }
      </fieldset>
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="cerrar()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando()">
          {{ enviando() ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear y continuar' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block;
      width: min(26rem, 100%);
      background: var(--color-surface);
      border-radius: var(--radius-dialog);
      box-shadow: var(--shadow-overlay);
      max-height: 90vh;
      overflow: auto;
    }
    .dialog-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: var(--space-6) var(--space-6) 0;
    }
    .dialog-head h2 {
      font-size: var(--font-size-lg);
      margin: 0;
    }
    .close {
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      border-radius: var(--radius-control);
      width: 2rem;
      height: 2rem;
      font-size: 1.1rem;
      line-height: 1;
    }
    .dialog-body {
      padding: var(--space-6);
    }
    .hint {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      margin: 0 0 var(--space-3);
    }
    .error {
      color: var(--color-danger);
      font-size: var(--font-size-sm);
    }
    .server-error {
      background: var(--color-danger-bg);
      color: var(--color-danger);
      border-radius: var(--radius-control);
      padding: var(--space-3);
      font-size: var(--font-size-sm);
      margin: var(--space-3) 0;
    }
    .dialog-foot {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      margin-top: var(--space-4);
    }
    .field {
      margin-bottom: var(--space-4);
    }
    label {
      display: block;
      font-size: var(--font-size-sm);
      font-weight: 600;
      margin-bottom: var(--space-1);
    }
    input,
    select {
      width: 100%;
      padding: var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-control);
    }
    fieldset {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-control);
      padding: var(--space-3);
    }
    .opcion-rango {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .opcion-rango input {
      width: auto;
    }
  `
})
export class ProductoFormDialog {
  protected readonly dialogRef = inject(DialogRef<ProductoFormDialogResultado | undefined>);
  protected readonly data = inject<ProductoFormDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly productosApi = inject(ProductosApi);
  private readonly familiasApi = inject(FamiliasApi);
  private readonly destroy = inject(DestroyRef);

  protected readonly esEdicion = !!this.data.producto;

  protected readonly familias = signal<FamiliaResponse[]>([]);
  protected readonly cargandoFamilias = signal(true);
  protected readonly errorFamilias = signal<string | null>(null);

  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly errorRango = signal<string | null>(null);

  /** Foto elegida/quitada en el formulario; se aplica DESPUÉS de guardar el producto. */
  protected fotoCambio: FotoCambio = { archivo: null, quitar: false };

  protected readonly form = this.fb.group({
    nombre: this.fb.nonNullable.control(this.data.producto?.nombre ?? '', [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(60)
    ]),
    familiaId: this.fb.nonNullable.control(
      this.data.producto?.familiaId ?? '',
      Validators.required
    ),
    rendimientoEsperadoPct: this.fb.control<number | null>(
      this.data.producto?.rendimientoEsperadoPct ?? null,
      [Validators.min(0), Validators.max(999.99)]
    ),
    cicloCapital: this.fb.nonNullable.control(this.data.producto?.cicloCapital ?? ''),
    usarRango: this.fb.nonNullable.control(!!this.data.producto?.rangoRendimiento),
    rangoMinimo: this.fb.control<number | null>(
      this.data.producto?.rangoRendimiento?.minimo ?? null
    ),
    rangoMaximo: this.fb.control<number | null>(
      this.data.producto?.rangoRendimiento?.maximo ?? null
    ),
    rangoUnidad: this.fb.nonNullable.control<RangoRendimiento['unidad']>(
      this.data.producto?.rangoRendimiento?.unidad ?? 'KG'
    )
  });

  constructor() {
    this.cargarFamilias();
  }

  protected cargarFamilias(): void {
    this.cargandoFamilias.set(true);
    this.errorFamilias.set(null);
    this.familiasApi
      .listar()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (familias) => {
          this.familias.set(familias);
          this.cargandoFamilias.set(false);
        },
        error: (error) => {
          this.errorFamilias.set(mapHttpError(error).mensaje);
          this.cargandoFamilias.set(false);
        }
      });
  }

  protected invalido(campo: 'nombre' | 'familiaId' | 'rendimientoEsperadoPct'): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

  protected guardar(): void {
    this.errorRango.set(null);
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    const { usarRango, rangoMinimo, rangoMaximo, rangoUnidad } = this.form.getRawValue();
    if (usarRango && !rangoValido(rangoMinimo, rangoMaximo)) {
      this.errorRango.set(
        'Indica mínimo y máximo válidos: mínimo ≥ 0, máximo > 0 y mínimo ≤ máximo; hasta cuatro decimales.'
      );
      return;
    }
    this.enviando.set(true);
    this.errorServidor.set(null);
    const { nombre, familiaId, rendimientoEsperadoPct, cicloCapital } = this.form.getRawValue();
    const datos = {
      nombre: nombre.trim(),
      familiaId,
      rangoRendimiento: usarRango
        ? { minimo: rangoMinimo!, maximo: rangoMaximo!, unidad: rangoUnidad }
        : null,
      rendimientoEsperadoPct: rendimientoEsperadoPct ?? null,
      cicloCapital: cicloCapital ? (cicloCapital as 'RAPIDO' | 'MADURACION') : null
    };

    const existente = this.data.producto;
    const peticion = existente
      ? this.productosApi.actualizar(existente.id, datos)
      : this.productosApi.crear(datos);

    peticion.pipe(switchMap((producto) => this.aplicarFoto(producto))).subscribe({
      next: ({ producto, errorFoto }) => {
        // No se resetea enviando()/no se conserva el diálogo abierto en éxito: se cierra de inmediato,
        // conservando los datos en el formulario solo tiene sentido en el camino de error (retry).
        this.dialogRef.close({ producto, esNuevo: !existente, errorFoto });
      },
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }

  /**
   * La foto se sube/quita con el producto ya guardado. Si falla NO se reintenta el alta (crearía un
   * duplicado): se cierra con el producto y el aviso, y la foto se corrige editando el producto.
   */
  private aplicarFoto(producto: ProductoResponse): Observable<{ producto: ProductoResponse; errorFoto?: string }> {
    const { archivo, quitar } = this.fotoCambio;
    let accion: Observable<ProductoResponse> | null = null;
    if (archivo) accion = this.productosApi.subirFotoProducto(producto.id, archivo);
    else if (quitar && producto.fotoUrl) accion = this.productosApi.quitarFotoProducto(producto.id);
    if (!accion) return of({ producto });
    return accion.pipe(
      map((conFoto) => ({ producto: conFoto })),
      catchError((error) => of({ producto, errorFoto: mapHttpError(error).mensaje }))
    );
  }

  protected cerrar(): void {
    this.dialogRef.close(undefined);
  }
}

function rangoValido(minimo: number | null, maximo: number | null): boolean {
  const valido = (valor: number | null): valor is number =>
    valor !== null &&
    Number.isFinite(valor) &&
    valor >= 0 &&
    valor < 1e12 &&
    Math.abs(valor * 10000 - Math.round(valor * 10000)) < 1e-4;
  return valido(minimo) && valido(maximo) && maximo > 0 && minimo <= maximo;
}
