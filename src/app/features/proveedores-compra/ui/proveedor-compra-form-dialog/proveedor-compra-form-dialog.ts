import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { InsumosApi } from '../../../catalogos/data-access/insumos.api';
import { InsumoResponse } from '../../../catalogos/data-access/insumo.models';
import { ProveedoresCompraApi } from '../../data-access/proveedores-compra.api';
import { CategoriaProveedor, ProveedorCompraResponse } from '../../data-access/proveedor-compra.models';

export interface ProveedorCompraFormDialogData {
  proveedor?: ProveedorCompraResponse;
}

/** RUC con o sin separadores: 11 dígitos. El dígito verificador lo valida el servidor. */
export function rucDe(texto: string): string {
  return texto.replace(/[\s.\-]/g, '');
}

/**
 * Alta y edición de un proveedor de compra. Las categorías se marcan como chips (un proveedor puede estar en Leche y en
 * Otros insumos); los insumos habituales son opcionales y solo sirven para sugerirlos al registrar un ingreso.
 */
@Component({
  selector: 'app-proveedor-compra-form-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="prov-titulo">{{ esEdicion ? 'Editar proveedor' : 'Nuevo proveedor' }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form class="dialog-body" [formGroup]="form" (ngSubmit)="enviar()" aria-labelledby="prov-titulo">
      <div class="field" [class.has-error]="invalido('nombre')">
        <label for="prov-nombre">Nombre o razón social</label>
        <input id="prov-nombre" type="text" maxlength="150" formControlName="nombre" required>
        @if (invalido('nombre')) { <span class="error">Indica el nombre o la razón social.</span> }
      </div>
      <div class="field" [class.has-error]="invalido('ruc')">
        <label for="prov-ruc">RUC</label>
        <input id="prov-ruc" type="text" inputmode="numeric" maxlength="14" formControlName="ruc" required>
        @if (invalido('ruc')) { <span class="error">El RUC tiene 11 dígitos.</span> }
      </div>
      <div class="fila">
        <div class="field">
          <label for="prov-telefono">Teléfono (opcional)</label>
          <input id="prov-telefono" type="tel" maxlength="20" formControlName="telefono">
        </div>
        <div class="field">
          <label for="prov-contacto">Contacto (opcional)</label>
          <input id="prov-contacto" type="text" maxlength="100" formControlName="contacto">
        </div>
      </div>

      <fieldset class="field">
        <legend>Categorías</legend>
        <div class="chips" role="group" aria-label="Categorías del proveedor">
          @for (c of categorias(); track c.id) {
            <label class="chip" [class.marcado]="seleccion().has(c.codigo)">
              <input type="checkbox" [checked]="seleccion().has(c.codigo)" (change)="alternar(c.codigo)">
              {{ c.nombre }}
            </label>
          }
        </div>
        @if (seleccion().size === 0) { <span class="error">Marca al menos una categoría.</span> }
      </fieldset>

      @if (insumos().length > 0) {
        <details class="habituales">
          <summary>Insumos que suele proveer (opcional) · {{ habituales().size }} marcados</summary>
          <p class="hint">Solo sirve para sugerirlos al registrar un ingreso de este proveedor.</p>
          <div class="chips" role="group" aria-label="Insumos habituales">
            @for (i of insumos(); track i.id) {
              <label class="chip" [class.marcado]="habituales().has(i.id)">
                <input type="checkbox" [checked]="habituales().has(i.id)" (change)="alternarInsumo(i.id)">
                {{ i.nombre }}
              </label>
            }
          </div>
        </details>
      }

      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando()">{{ enviando() ? 'Guardando…' : (esEdicion ? 'Guardar cambios' : 'Crear proveedor') }}</button>
      </div>
    </form>
  `,
  styles: `
    :host { display: block; width: min(32rem, 100%); background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto; }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    .fila { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
    fieldset.field { border: 0; padding: 0; margin: 0 0 var(--space-4); }
    legend { font-size: 0.75rem; font-weight: 700; margin-bottom: var(--space-2); padding: 0; }
    .chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .chip { display: inline-flex; align-items: center; gap: 0.4rem; border: 1px solid var(--color-border); border-radius: 999px; padding: 0.3rem 0.8rem; font-size: var(--font-size-sm); cursor: pointer; }
    .chip.marcado { background: var(--color-primary-bg, rgba(20, 90, 60, 0.12)); border-color: var(--color-primary, #145a3c); font-weight: 700; }
    .chip input { margin: 0; }
    .habituales summary { cursor: pointer; font-size: var(--font-size-sm); font-weight: 600; margin-bottom: var(--space-2); }
    .hint { color: var(--color-text-muted); font-size: 0.75rem; margin: 0 0 var(--space-2); }
    .error { font-size: 0.6875rem; color: var(--color-danger); font-weight: 600; }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class ProveedorCompraFormDialog {
  protected readonly dialogRef = inject(DialogRef<ProveedorCompraResponse | undefined>);
  private readonly data = inject<ProveedorCompraFormDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ProveedoresCompraApi);
  private readonly insumosApi = inject(InsumosApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly esEdicion = !!this.data.proveedor;
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly categorias = signal<CategoriaProveedor[]>([]);
  protected readonly insumos = signal<InsumoResponse[]>([]);
  protected readonly seleccion = signal<Set<string>>(new Set(this.data.proveedor?.categorias.map((c) => c.codigo) ?? ['OTROS_INSUMOS']));
  protected readonly habituales = signal<Set<string>>(new Set(this.data.proveedor?.insumosHabituales.map((i) => i.id) ?? []));

  protected readonly form = this.fb.nonNullable.group({
    nombre: [this.data.proveedor?.nombre ?? '', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    ruc: [this.data.proveedor?.ruc ?? '', [Validators.required, (c: { value: string }) => (/^\d{11}$/.test(rucDe(c.value ?? '')) ? null : { ruc: true })]],
    telefono: [this.data.proveedor?.telefono ?? '', Validators.maxLength(20)],
    contacto: [this.data.proveedor?.contacto ?? '', Validators.maxLength(100)]
  });

  constructor() {
    this.api.categorias().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (c) => this.categorias.set(c), error: () => undefined });
    // Los insumos habituales solo los edita ADMIN (el catálogo completo exige ese rol); si no se pueden leer, la sección no aparece.
    this.insumosApi.listar().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (i) => this.insumos.set(i.filter((x) => x.activo)),
      error: () => undefined
    });
  }

  protected invalido(campo: 'nombre' | 'ruc'): boolean {
    const c = this.form.controls[campo];
    return c.invalid && c.touched;
  }

  protected alternar(codigo: string): void {
    this.seleccion.update((s) => {
      const n = new Set(s);
      if (!n.delete(codigo)) n.add(codigo);
      return n;
    });
  }

  protected alternarInsumo(id: string): void {
    this.habituales.update((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  }

  protected enviar(): void {
    if (this.enviando()) return;
    if (this.form.invalid || this.seleccion().size === 0) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const datos = {
      nombre: v.nombre.trim(),
      ruc: rucDe(v.ruc),
      telefono: v.telefono.trim() || null,
      contacto: v.contacto.trim() || null,
      categorias: [...this.seleccion()],
      // Solo se envían si la sección se pudo cargar: así editar sin ver los insumos nunca los borra.
      insumosHabituales: this.insumos().length > 0 ? [...this.habituales()] : null
    };
    const peticion = this.esEdicion ? this.api.actualizar(this.data.proveedor!.id, datos) : this.api.crear(datos);
    this.enviando.set(true);
    this.errorServidor.set(null);
    peticion.subscribe({
      next: (r) => this.dialogRef.close(r),
      error: (e) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(e).mensaje);
      }
    });
  }
}
