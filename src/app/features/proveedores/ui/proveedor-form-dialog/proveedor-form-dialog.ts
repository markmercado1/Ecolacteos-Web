import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { ZonaResponse } from '../../../catalogos/data-access/zona.models';
import { limpiarDocumento, problemaDocumentos } from '../../data-access/documentos';
import { ProveedorAdminResponse, TipoPersona } from '../../data-access/proveedor.models';
import { ProveedoresApi } from '../../data-access/proveedores.api';

export interface ProveedorFormDialogData {
  zonas: ZonaResponse[];
  proveedor?: ProveedorAdminResponse;
}

/**
 * Crear y editar comparten formulario, pero no contrato: crear admite
 * zonaActualId (ProveedorRequest); editar no cambia zona (ProveedorUpdateRequest;
 * docs/ALCANCE.md dice explícitamente que el PUT de datos no mueve al
 * proveedor de zona). El campo de zona solo aparece al crear.
 *
 * Fase G: persona natural (nombre y DNI obligatorios, RUC opcional en la misma ficha) o empresa (RUC y razón social obligatorios,
 * sin DNI; nombre comercial opcional). El formulario avisa los errores de forma antes de enviar; el servidor decide (también que DNI y
 * RUC no estén repetidos). Un DNI o RUC anterior fuera de formato que no se toca se conserva tal cual.
 */
@Component({
  selector: 'app-proveedor-form-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="proveedor-form-titulo">{{ esEdicion ? 'Editar proveedor' : 'Nuevo proveedor' }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="proveedor-form-titulo">
      <fieldset class="tipo">
        <legend>Tipo de proveedor</legend>
        <label><input type="radio" formControlName="tipoPersona" value="NATURAL" (change)="cambioTipo()"> Persona natural</label>
        <label><input type="radio" formControlName="tipoPersona" value="EMPRESA" (change)="cambioTipo()"> Empresa</label>
      </fieldset>

      @if (esEmpresa()) {
        <div class="field" [class.has-error]="intentado() && !form.controls.razonSocial.value.trim()">
          <label for="razonSocial">Razón social</label>
          <input id="razonSocial" type="text" formControlName="razonSocial" maxlength="150" required>
        </div>
        <div class="field" [class.has-error]="problemaVisible()?.includes('RUC')">
          <label for="ruc">RUC</label>
          <input id="ruc" type="text" inputmode="numeric" formControlName="ruc" maxlength="13" required aria-describedby="ruc-ayuda">
          <span class="ayuda" id="ruc-ayuda">11 dígitos; el de una empresa empieza con 20.</span>
        </div>
        <div class="field">
          <label for="nombre">Nombre comercial o de contacto (opcional)</label>
          <input id="nombre" type="text" formControlName="nombre" maxlength="150">
          <span class="ayuda">Si lo dejas vacío se usa la razón social.</span>
        </div>
      } @else {
        <div class="field" [class.has-error]="intentado() && !form.controls.nombre.value.trim()">
          <label for="nombre">Nombre completo</label>
          <input id="nombre" type="text" formControlName="nombre" maxlength="150" required>
          @if (intentado() && !form.controls.nombre.value.trim()) { <span class="error">El nombre es obligatorio.</span> }
        </div>
        <div class="field" [class.has-error]="problemaVisible()?.includes('DNI')">
          <label for="dni">DNI</label>
          <input id="dni" type="text" inputmode="numeric" formControlName="dni" maxlength="15" required>
        </div>
        <div class="field" [class.has-error]="problemaVisible()?.includes('RUC')">
          <label for="ruc">RUC (opcional)</label>
          <input id="ruc" type="text" inputmode="numeric" formControlName="ruc" maxlength="13" aria-describedby="ruc-ayuda">
          <span class="ayuda" id="ruc-ayuda">Si tiene RUC: 10 + su DNI + un dígito verificador. Puede quedar vacío.</span>
        </div>
      }
      @if (problemaVisible(); as p) { <p class="error-bloque" role="alert">{{ p }}</p> }

      <div class="field">
        <label for="telefono">Teléfono (opcional)</label>
        <input id="telefono" type="tel" formControlName="telefono">
      </div>
      @if (!esEdicion) {
        <div class="field">
          <label for="zonaActualId">Zona actual (opcional)</label>
          <select id="zonaActualId" formControlName="zonaActualId">
            <option value="">Sin zona</option>
            @for (zona of data.zonas; track zona.id) {
              <option [value]="zona.id">{{ zona.nombre }}</option>
            }
          </select>
        </div>
      } @else {
        <p class="hint-block">Para cambiar de zona usa la acción "Cambiar zona" del listado.</p>
      }

      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }

      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando()">
          {{ enviando() ? 'Guardando…' : (esEdicion ? 'Guardar cambios' : 'Crear proveedor') }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block; width: min(28rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    .tipo { border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-3); margin: 0 0 var(--space-4); display: flex; gap: var(--space-4); flex-wrap: wrap; }
    .tipo legend { font-size: var(--font-size-sm); font-weight: 600; padding: 0 var(--space-1); }
    .tipo label { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-sm); }
    .ayuda { display: block; font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.25rem; }
    .error-bloque { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .hint-block { font-size: var(--font-size-sm); color: var(--color-text-muted); background: var(--color-surface-soft); border-radius: var(--radius-control); padding: var(--space-3); margin: 0 0 var(--space-4); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class ProveedorFormDialog {
  protected readonly dialogRef = inject(DialogRef<ProveedorAdminResponse | undefined>);
  protected readonly data = inject<ProveedorFormDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly proveedoresApi = inject(ProveedoresApi);

  protected readonly esEdicion = !!this.data.proveedor;
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly intentado = signal(false);
  /** Problema de forma detectado al intentar guardar (se recalcula en cada intento). */
  protected readonly problemaVisible = signal<string | null>(null);
  protected readonly esEmpresa = signal(this.data.proveedor?.tipoPersona === 'EMPRESA');

  protected readonly form = this.fb.nonNullable.group({
    tipoPersona: this.fb.nonNullable.control<TipoPersona>(this.data.proveedor?.tipoPersona ?? 'NATURAL'),
    // en una empresa cuyo nombre es su razón social, el campo de nombre comercial empieza vacío
    nombre: this.fb.nonNullable.control(
      this.data.proveedor?.tipoPersona === 'EMPRESA' && this.data.proveedor.nombre === this.data.proveedor.razonSocial
        ? '' : (this.data.proveedor?.nombre ?? '')),
    dni: this.fb.nonNullable.control(this.data.proveedor?.dni ?? ''),
    ruc: this.fb.nonNullable.control(this.data.proveedor?.ruc ?? ''),
    razonSocial: this.fb.nonNullable.control(this.data.proveedor?.razonSocial ?? ''),
    telefono: this.fb.control<string | null>(this.data.proveedor?.telefono ?? null),
    zonaActualId: this.fb.nonNullable.control(this.data.proveedor?.zonaActualId ?? '')
  });

  protected cambioTipo(): void {
    this.esEmpresa.set(this.form.controls.tipoPersona.value === 'EMPRESA');
    this.errorServidor.set(null);
    this.problemaVisible.set(null);
  }

  /** Primer problema de forma de lo escrito, o null. */
  protected problema(): string | null {
    const v = this.form.getRawValue();
    const original = this.data.proveedor;
    const dni = v.tipoPersona === 'EMPRESA' ? null : (v.dni.trim() === (original?.dni ?? null) ? original!.dni : limpiarDocumento(v.dni));
    const ruc = v.ruc.trim() === (original?.ruc ?? null) ? original!.ruc : limpiarDocumento(v.ruc);
    return problemaDocumentos(v.tipoPersona, dni, ruc, v.tipoPersona === 'EMPRESA' ? v.razonSocial : null,
      !!original && dni === original.dni, !!original && ruc === original.ruc);
  }

  enviar(): void {
    this.intentado.set(true);
    const v = this.form.getRawValue();
    const empresa = v.tipoPersona === 'EMPRESA';
    this.problemaVisible.set(this.problema());
    if (this.enviando() || (!empresa && !v.nombre.trim()) || this.problemaVisible()) {
      return;
    }
    this.enviando.set(true);
    this.errorServidor.set(null);
    const documentos = {
      tipoPersona: v.tipoPersona,
      // el servidor normaliza espacios/guiones; un valor anterior sin tocar viaja tal cual para conservarse
      dni: empresa ? null : (v.dni.trim() || null),
      ruc: v.ruc.trim() || null,
      razonSocial: empresa ? v.razonSocial.trim() : null
    };
    const telefono = v.telefono || null;

    const peticion = this.esEdicion
      ? this.proveedoresApi.actualizar(this.data.proveedor!.id, { nombre: v.nombre.trim(), telefono, ...documentos })
      : this.proveedoresApi.crear({ nombre: v.nombre.trim(), telefono, zonaActualId: v.zonaActualId || null, ...documentos });

    peticion.subscribe({
      next: (proveedor) => this.dialogRef.close(proveedor),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
