import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { InsumoResponse } from '../../data-access/insumo.models';
import { ProductoResponse } from '../../data-access/producto.models';
import { RecetaRequest, RecetaResponse } from '../../data-access/receta.models';
import { RecetasApi } from '../../data-access/recetas.api';

export interface RecetaFormDialogData {
  receta?: RecetaResponse;
  productos: ProductoResponse[];
  insumos: InsumoResponse[];
}

type FilaInsumo = FormGroup<{ insumoId: FormControl<string>; cantidad: FormControl<number | null> }>;

/** Cantidades con hasta 3 decimales (NUMERIC(12,3)), estrictamente mayores que 0. */
const CANTIDAD_RECETA = /^\d{1,9}(\.\d{1,3})?$/;
/** Litros base con hasta 2 decimales (NUMERIC(9,2)). */
const LITROS_BASE = /^\d{1,7}(\.\d{1,2})?$/;

/**
 * Crear/editar una receta (solo ADMIN). La receta se define "por litrosBase" de leche: los insumos (del
 * catálogo existente, en su propia unidad de medida) y el rendimiento en la presentación de salida. El
 * backend escala proporcionalmente al planificar. Producto y presentación no se editan después de crear
 * (un lote planificado conserva su receta); para otra salida se crea otra receta.
 */
@Component({
  selector: 'app-receta-form-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="receta-titulo">{{ esEdicion ? 'Editar receta' : 'Nueva receta' }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="receta-titulo">
      <div class="field" [class.has-error]="invalido('nombre')">
        <label for="receta-nombre">Nombre de la receta</label>
        <input id="receta-nombre" type="text" formControlName="nombre" maxlength="100" placeholder="Receta estándar" required>
        @if (invalido('nombre')) { <span class="error">Ingresa un nombre (máx. 100 caracteres).</span> }
      </div>

      <div class="grid-campos">
        <div class="field" [class.has-error]="invalido('productoId')">
          <label for="receta-producto">Producto a fabricar</label>
          <select id="receta-producto" formControlName="productoId" required>
            <option value="" disabled>Selecciona un producto</option>
            @for (p of productosActivos(); track p.id) { <option [value]="p.id">{{ p.nombre }}</option> }
          </select>
        </div>
        <div class="field" [class.has-error]="invalido('presentacionId')">
          <label for="receta-presentacion">Presentación obtenida</label>
          <select id="receta-presentacion" formControlName="presentacionId" required>
            <option value="" disabled>{{ presentaciones().length ? 'Selecciona' : 'El producto no tiene presentaciones activas' }}</option>
            @for (pr of presentaciones(); track pr.id) { <option [value]="pr.id">{{ pr.nombre }}</option> }
          </select>
        </div>
      </div>
      @if (esEdicion) { <p class="hint">El producto y la presentación no se cambian: crea otra receta para otra salida.</p> }

      <fieldset>
        <legend>Base de la receta</legend>
        <div class="grid-campos">
          <div class="field" [class.has-error]="invalido('litrosBase')">
            <label for="receta-litros">Leche base (L)</label>
            <input id="receta-litros" type="number" min="0.01" step="0.01" formControlName="litrosBase" placeholder="100" required>
            @if (invalido('litrosBase')) { <span class="error">Mayor que 0, hasta 2 decimales.</span> }
          </div>
          <div class="field" [class.has-error]="invalido('rendimientoBase')">
            <label for="receta-rendimiento">Rendimiento esperado ({{ unidadSalida() }})</label>
            <input id="receta-rendimiento" type="number" min="0.001" step="0.001" formControlName="rendimientoBase" placeholder="1" required>
            @if (invalido('rendimientoBase')) { <span class="error">Mayor que 0, hasta 3 decimales.</span> }
          </div>
        </div>
        <p class="hint">Ejemplo: 100 L de leche → 1 pieza. Al producir 1000 L, el sistema calcula 10 piezas esperadas.</p>
      </fieldset>

      <fieldset>
        <legend>Insumos por cada {{ form.controls.litrosBase.value || '…' }} L</legend>
        @for (fila of insumosForm.controls; track fila; let i = $index) {
          <div class="fila-insumo" [formGroup]="fila">
            <div class="field">
              <label [for]="'insumo-' + i">Insumo</label>
              <select [id]="'insumo-' + i" formControlName="insumoId" required>
                <option value="" disabled>Selecciona</option>
                @for (ins of opcionesInsumo(i); track ins.id) {
                  <option [value]="ins.id">{{ ins.nombre }} ({{ ins.unidadMedida }})</option>
                }
              </select>
            </div>
            <div class="field" [class.has-error]="fila.controls.cantidad.invalid && fila.controls.cantidad.touched">
              <label [for]="'cantidad-' + i">Cantidad{{ unidadInsumo(fila.controls.insumoId.value) }}</label>
              <input [id]="'cantidad-' + i" type="number" min="0.001" step="0.001" formControlName="cantidad" required>
            </div>
            <button type="button" class="btn small ghost quitar" (click)="quitarInsumo(i)" [attr.aria-label]="'Quitar insumo ' + (i + 1)">Quitar</button>
          </div>
        } @empty {
          <p class="hint">Sin insumos: la receta usará solo leche.</p>
        }
        <button type="button" class="btn small" (click)="agregarInsumo()" [disabled]="!puedeAgregarInsumo()">Agregar insumo</button>
        <p class="hint">Las cantidades se expresan en la unidad de medida de cada insumo (no se convierten unidades).</p>
      </fieldset>

      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando()">
          {{ enviando() ? 'Guardando…' : (esEdicion ? 'Guardar cambios' : 'Crear receta') }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host { display: block; width: min(38rem, 100%); background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto; }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    .grid-campos { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
    fieldset { border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-3) var(--space-4); margin: var(--space-4) 0 0; }
    legend { font-size: var(--font-size-sm); font-weight: 800; padding: 0 var(--space-2); }
    .fila-insumo { display: grid; grid-template-columns: 2fr 1fr auto; gap: var(--space-3); align-items: end; }
    .quitar { margin-bottom: var(--space-4); }
    .hint { color: var(--color-text-muted); font-size: 0.75rem; }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: var(--space-4) 0 0; }
    .error { font-size: 0.6875rem; color: var(--color-danger); font-weight: 600; }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
    @media (max-width: 480px) { .grid-campos, .fila-insumo { grid-template-columns: 1fr; } .quitar { margin-bottom: 0; } }
  `
})
export class RecetaFormDialog {
  protected readonly dialogRef = inject(DialogRef<RecetaResponse | undefined>);
  protected readonly data = inject<RecetaFormDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly recetasApi = inject(RecetasApi);

  protected readonly esEdicion = !!this.data.receta;
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);

  protected readonly productosActivos = computed(() =>
    this.data.productos.filter((p) => p.activo || p.id === this.data.receta?.productoId)
  );
  private readonly insumosActivos = this.data.insumos.filter((i) => i.activo);

  protected readonly form = this.fb.group({
    nombre: this.fb.nonNullable.control(this.data.receta?.nombre ?? '', [Validators.required, Validators.maxLength(100)]),
    productoId: this.fb.nonNullable.control(
      { value: this.data.receta?.productoId ?? '', disabled: this.esEdicion },
      Validators.required
    ),
    presentacionId: this.fb.nonNullable.control(
      { value: this.data.receta?.presentacionId ?? '', disabled: this.esEdicion },
      Validators.required
    ),
    litrosBase: this.fb.control<number | null>(this.data.receta?.litrosBase ?? null, [
      Validators.required,
      Validators.min(0.01),
      Validators.pattern(LITROS_BASE)
    ]),
    rendimientoBase: this.fb.control<number | null>(this.data.receta?.rendimientoBase ?? null, [
      Validators.required,
      Validators.min(0.001),
      Validators.pattern(CANTIDAD_RECETA)
    ])
  });

  protected readonly insumosForm: FormArray<FilaInsumo> = this.fb.array<FilaInsumo>(
    (this.data.receta?.insumos ?? []).map((i) => this.crearFila(i.insumoId, i.cantidad))
  );

  private readonly productoIdValor = toSignal(this.form.controls.productoId.valueChanges, {
    initialValue: this.form.controls.productoId.value
  });
  private readonly presentacionIdValor = toSignal(this.form.controls.presentacionId.valueChanges, {
    initialValue: this.form.controls.presentacionId.value
  });
  private readonly insumosValor = toSignal(this.insumosForm.valueChanges, { initialValue: this.insumosForm.value });

  protected readonly presentaciones = computed(() => {
    const producto = this.data.productos.find((p) => p.id === this.productoIdValor());
    return (producto?.presentaciones ?? []).filter(
      (pr) => pr.activo || pr.id === this.data.receta?.presentacionId
    );
  });

  protected readonly unidadSalida = computed(() => {
    const pr = this.presentaciones().find((p) => p.id === this.presentacionIdValor());
    return pr ? `${pr.unidadConteo} · ${pr.nombre}` : 'unidades de la presentación';
  });

  protected readonly puedeAgregarInsumo = computed(() => {
    const usados = new Set(this.insumosValor().map((f) => f.insumoId).filter(Boolean));
    return this.insumosActivos.some((i) => !usados.has(i.id));
  });

  constructor() {
    // Al cambiar de producto, la presentación anterior deja de ser válida.
    this.form.controls.productoId.valueChanges.subscribe(() =>
      this.form.controls.presentacionId.setValue('')
    );
  }

  private crearFila(insumoId = '', cantidad: number | null = null): FilaInsumo {
    return this.fb.group({
      insumoId: this.fb.nonNullable.control(insumoId, Validators.required),
      cantidad: this.fb.control<number | null>(cantidad, [
        Validators.required,
        Validators.min(0.001),
        Validators.pattern(CANTIDAD_RECETA)
      ])
    });
  }

  /** Opciones de una fila: excluye los insumos ya elegidos en otras filas (sin duplicados). */
  protected opcionesInsumo(indice: number): InsumoResponse[] {
    const valores = this.insumosValor();
    const usadosEnOtras = new Set(valores.filter((_, j) => j !== indice).map((f) => f.insumoId));
    const actual = valores[indice]?.insumoId;
    return this.data.insumos.filter(
      (i) => (i.activo || i.id === actual) && !usadosEnOtras.has(i.id)
    );
  }

  protected unidadInsumo(insumoId: string): string {
    const insumo = this.data.insumos.find((i) => i.id === insumoId);
    return insumo ? ` (${insumo.unidadMedida})` : '';
  }

  protected agregarInsumo(): void {
    this.insumosForm.push(this.crearFila());
  }

  protected quitarInsumo(indice: number): void {
    this.insumosForm.removeAt(indice);
  }

  protected invalido(campo: 'nombre' | 'productoId' | 'presentacionId' | 'litrosBase' | 'rendimientoBase'): boolean {
    const control = this.form.controls[campo];
    return control.invalid && control.touched;
  }

  protected enviar(): void {
    if (this.enviando()) return;
    if (this.form.invalid || this.insumosForm.invalid) {
      this.form.markAllAsTouched();
      this.insumosForm.markAllAsTouched();
      this.errorServidor.set('Revisa los campos marcados antes de guardar.');
      return;
    }
    const valor = this.form.getRawValue();
    const datos: RecetaRequest = {
      nombre: valor.nombre.trim(),
      productoId: valor.productoId,
      presentacionId: valor.presentacionId,
      litrosBase: Number(valor.litrosBase),
      rendimientoBase: Number(valor.rendimientoBase),
      insumos: this.insumosForm.getRawValue().map((f) => ({ insumoId: f.insumoId, cantidad: Number(f.cantidad) }))
    };
    this.enviando.set(true);
    this.errorServidor.set(null);
    const peticion = this.esEdicion
      ? this.recetasApi.actualizar(this.data.receta!.id, datos)
      : this.recetasApi.crear(datos);
    peticion.subscribe({
      next: (receta) => this.dialogRef.close(receta),
      error: (e) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(e).mensaje);
      }
    });
  }
}
