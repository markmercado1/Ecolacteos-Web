import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { ProveedorPublicoResponse } from '../../../proveedores/data-access/proveedor.models';
import { MODALIDADES, ModalidadPagoProveedor, PagoProveedorRequest, PagoProveedorResponse, exigeDatosBancarios } from '../../data-access/pago-proveedor.models';
import { PagosProveedorApi } from '../../data-access/pagos-proveedor.api';

export interface RegistrarPagoDialogData {
  /** Para elegir el proveedor cuando no viene fijo. */
  proveedores?: ProveedorPublicoResponse[];
  /** Proveedor fijo (se abre desde su liquidación o su perfil). */
  proveedorId?: string;
  proveedorNombre?: string;
  /** Liquidación a la que puede aplicarse el pago en el mismo registro (el servidor valida el saldo). */
  liquidacion?: { pagoId: string; semana: string; saldo: number };
}

const vacio = (v: unknown) => !String(v ?? '').trim();

/** Transferencia y depósito exigen banco y número de operación; en cualquier modalidad, si se escribe uno se escribe el otro. */
function datosBancarios(grupo: AbstractControl): ValidationErrors | null {
  const modalidad = grupo.get('modalidad')?.value as string;
  const banco = grupo.get('banco')?.value;
  const operacion = grupo.get('nroOperacion')?.value;
  if (exigeDatosBancarios(modalidad) && (vacio(banco) || vacio(operacion))) return { bancarios: true };
  if (vacio(banco) !== vacio(operacion)) return { bancarios: true };
  return null;
}

const limpio = (v: string | null | undefined): string | undefined => {
  const t = (v ?? '').trim();
  return t ? t : undefined;
};

/**
 * Registra un pago a un proveedor (dinero realmente entregado). El `uuidCliente` se genera al abrir el diálogo y se conserva en los reintentos:
 * si la respuesta no llegó, reenviar lo mismo no crea un segundo pago (el servidor devuelve el ya registrado). El servidor decide los topes:
 * este formulario no calcula saldos.
 */
@Component({
  selector: 'app-registrar-pago-proveedor-dialog',
  imports: [ReactiveFormsModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="registrar-pago-titulo">Registrar pago a proveedor</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="registrar-pago-titulo">
      @if (data.proveedorId) {
        <p class="proveedor-fijo" data-testid="proveedor-fijo">Proveedor: <b>{{ data.proveedorNombre }}</b></p>
      } @else {
        <div class="field" [class.has-error]="invalido('proveedorId')">
          <label for="pp-proveedor">Proveedor</label>
          <select id="pp-proveedor" formControlName="proveedorId" required>
            <option value="" disabled>Selecciona un proveedor</option>
            @for (proveedor of data.proveedores ?? []; track proveedor.id) {
              <option [value]="proveedor.id">{{ proveedor.nombre }}</option>
            }
          </select>
        </div>
      }
      <div class="fila">
        <div class="field">
          <label for="pp-modalidad">Modalidad</label>
          <select id="pp-modalidad" formControlName="modalidad">
            @for (m of modalidades; track m.valor) { <option [value]="m.valor">{{ m.etiqueta }}</option> }
          </select>
        </div>
        <div class="field" [class.has-error]="invalido('monto')">
          <label for="pp-monto">Monto (S/)</label>
          <input id="pp-monto" type="number" step="0.01" min="0.01" inputmode="decimal" formControlName="monto" required>
        </div>
      </div>
      @if (bancarios()) {
        <div class="fila" data-testid="datos-bancarios">
          <div class="field" [class.has-error]="invalido('banco')">
            <label for="pp-banco">Banco</label>
            <input id="pp-banco" type="text" maxlength="80" formControlName="banco" autocomplete="off">
          </div>
          <div class="field" [class.has-error]="invalido('nroOperacion')">
            <label for="pp-operacion">N.º de operación</label>
            <input id="pp-operacion" type="text" maxlength="80" formControlName="nroOperacion" autocomplete="off">
          </div>
        </div>
        <small class="hint">Solo banco y número de operación: no se guardan cuentas completas. La misma operación no puede registrarse dos veces.</small>
      }
      <div class="field">
        <label for="pp-recibo">N.º de recibo (opcional)</label>
        <input id="pp-recibo" type="text" maxlength="80" formControlName="nroRecibo" autocomplete="off">
      </div>
      <div class="field">
        <label for="pp-concepto">Concepto (opcional)</label>
        <input id="pp-concepto" type="text" maxlength="200" formControlName="concepto" autocomplete="off">
      </div>
      <div class="field">
        <label for="pp-observacion">Observación (opcional)</label>
        <textarea id="pp-observacion" rows="2" maxlength="500" formControlName="observacion"></textarea>
      </div>

      @if (data.liquidacion; as l) {
        <label class="aplicar" data-testid="aplicar-liquidacion">
          <input type="checkbox" formControlName="aplicar">
          <span>
            Aplicarlo a la liquidación del {{ l.semana }}
            <small>Saldo actual S/ {{ l.saldo | number: '1.2-2' }}. Si el monto es mayor, desmarca esta opción para dejarlo como adelanto.</small>
          </span>
        </label>
      } @else {
        <p class="hint" data-testid="aviso-adelanto">Sin aplicar a una liquidación, el pago queda como adelanto y puede aplicarse después.</p>
      }

      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="form.invalid || enviando()">
          {{ enviando() ? 'Registrando…' : 'Registrar pago' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block; width: min(28rem, 100%); max-height: 92vh; overflow-y: auto; background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay);
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    .proveedor-fijo { margin: 0 0 var(--space-4); }
    .fila { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
    @media (max-width: 30rem) { .fila { grid-template-columns: 1fr; } }
    .hint { display: block; color: var(--color-text-muted); font-size: 0.75rem; margin: 0 0 var(--space-4); }
    .aplicar { display: flex; gap: var(--space-2); align-items: flex-start; background: var(--color-surface-soft); border-radius: var(--radius-control); padding: var(--space-3); margin: 0 0 var(--space-4); font-size: var(--font-size-sm); }
    .aplicar small { display: block; color: var(--color-text-muted); font-size: 0.75rem; }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class RegistrarPagoProveedorDialog {
  protected readonly dialogRef = inject(DialogRef<PagoProveedorResponse | undefined>);
  protected readonly data = inject<RegistrarPagoDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PagosProveedorApi);
  /** Se conserva en los reintentos: reenviar el mismo pago no crea otro. */
  private readonly uuidCliente = crypto.randomUUID();

  protected readonly modalidades = MODALIDADES;
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      proveedorId: this.fb.nonNullable.control(this.data.proveedorId ?? '', Validators.required),
      modalidad: this.fb.nonNullable.control<ModalidadPagoProveedor>('EFECTIVO'),
      monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01), Validators.max(9999999999.99), Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
      banco: this.fb.nonNullable.control('', Validators.maxLength(80)),
      nroOperacion: this.fb.nonNullable.control('', Validators.maxLength(80)),
      nroRecibo: this.fb.nonNullable.control('', Validators.maxLength(80)),
      concepto: this.fb.nonNullable.control('', Validators.maxLength(200)),
      observacion: this.fb.nonNullable.control('', Validators.maxLength(500)),
      aplicar: this.fb.nonNullable.control(true)
    },
    { validators: datosBancarios }
  );
  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  /** Los datos bancarios se piden en transferencia y depósito, y se permiten en efectivo solo si el usuario los quiere dar. */
  protected readonly bancarios = computed(() => exigeDatosBancarios(this.valores().modalidad ?? 'EFECTIVO') || !!limpio(this.valores().banco) || !!limpio(this.valores().nroOperacion));

  protected invalido(campo: 'proveedorId' | 'monto' | 'banco' | 'nroOperacion'): boolean {
    const control = this.form.get(campo);
    if (!control || !control.touched) return false;
    if (campo === 'banco' || campo === 'nroOperacion') return !!this.form.errors?.['bancarios'] && vacio(control.value);
    return control.invalid;
  }

  protected enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const solicitud: PagoProveedorRequest = {
      uuidCliente: this.uuidCliente,
      proveedorId: v.proveedorId,
      modalidad: v.modalidad,
      monto: v.monto as number,
      concepto: limpio(v.concepto),
      banco: limpio(v.banco),
      nroOperacion: limpio(v.nroOperacion),
      nroRecibo: limpio(v.nroRecibo),
      observacion: limpio(v.observacion),
      aplicaciones: this.data.liquidacion && v.aplicar ? [{ pagoId: this.data.liquidacion.pagoId, monto: v.monto as number }] : undefined
    };
    this.enviando.set(true);
    this.errorServidor.set(null);
    this.api.registrar(solicitud).subscribe({
      next: (pago) => this.dialogRef.close(pago),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
