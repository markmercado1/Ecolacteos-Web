import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import {
  AvisoPrivacidadResponse,
  CompradorSugerencia,
  ETIQUETAS_FORMA,
  ETIQUETAS_MEDIO,
  FormaAutorizacion,
  MEDIOS_COMERCIALES,
  MedioComercial,
  etiquetaCoincidencia
} from '../../data-access/cliente.models';
import { ClientesApi } from '../../data-access/clientes.api';

export interface RegistroClienteDialogData {
  /** Datos ya conocidos (por ejemplo, de la reserva) para no volver a escribirlos. */
  nombre?: string | null;
  telefono?: string | null;
  correo?: string | null;
}

/** Lo que devuelve el diálogo: la ficha creada o una ficha existente que el trabajador confirmó que es esa persona. */
export interface CompradorSeleccion {
  tipo: 'CLIENTE' | 'PROVEEDOR';
  id: string;
  nombre: string;
  mayorista: boolean;
}

/**
 * Fase H: registro VOLUNTARIO de un comprador. Se lee el aviso, el comprador autoriza (o no) el registro, y APARTE se le pregunta si
 * quiere recibir promociones (nunca marcado por defecto). Si no acepta el registro, se cierra sin crear nada y la venta sigue como
 * «Cliente varios». Antes de crear, se buscan fichas con el mismo teléfono o documento: el trabajador confirma si es alguna de ellas
 * (y la usa) o si es otra persona; nada se une solo.
 */
@Component({
  selector: 'app-registro-cliente-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="registro-titulo">Registrar como cliente</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="registro-titulo">
      <p class="hint-block">Es <strong>voluntario</strong>: si el comprador no quiere, cierra este diálogo y la venta sigue igual, al mismo precio.</p>

      @if (coincidencias().length) {
        <div class="coincidencias" role="alert" data-testid="coincidencias">
          <p><strong>Ya hay fichas con estos datos.</strong> Confirma con el comprador si es alguna de ellas:</p>
          <ul>
            @for (c of coincidencias(); track c.tipo + c.id) {
              <li>
                <span>{{ c.nombre }} · {{ c.tipo === 'PROVEEDOR' ? 'Proveedor' : 'Cliente' }}{{ c.telefono ? ' · ' + c.telefono : '' }}
                  <em>({{ coincidencia(c) }})</em></span>
                <button type="button" class="btn small" (click)="usar(c)">Es esta persona</button>
              </li>
            }
          </ul>
          <button type="button" class="btn small" (click)="registrarIgual()" [disabled]="enviando()">Es otra persona: registrarla</button>
        </div>
      }

      <div class="field" [class.has-error]="intentado() && form.controls.nombre.invalid">
        <label for="rc-nombre">Nombre</label>
        <input id="rc-nombre" type="text" formControlName="nombre" maxlength="150" required>
      </div>
      <div class="field" [class.has-error]="intentado() && form.controls.telefono.invalid">
        <label for="rc-telefono">Teléfono (celular)</label>
        <input id="rc-telefono" type="tel" formControlName="telefono" required>
      </div>
      <div class="field">
        <label for="rc-correo">Correo (opcional)</label>
        <input id="rc-correo" type="email" formControlName="correo" maxlength="120">
      </div>
      <details class="mas">
        <summary>DNI o RUC (opcional)</summary>
        <div class="field"><label for="rc-dni">DNI</label><input id="rc-dni" type="text" inputmode="numeric" formControlName="dni" maxlength="8"></div>
        <div class="field"><label for="rc-ruc">RUC</label><input id="rc-ruc" type="text" inputmode="numeric" formControlName="ruc" maxlength="11"></div>
      </details>

      <section class="aviso" aria-labelledby="aviso-registro">
        <h3 id="aviso-registro">Léele esto al comprador</h3>
        @if (aviso(); as a) {
          @for (p of a.avisoRegistro; track p) { <p>{{ p }}</p> }
          @if (!a.completo) {
            <p class="incompleto" data-testid="aviso-incompleto">Aviso incompleto: faltan datos del negocio ({{ a.faltantes.join('; ') }}). Pídeselos a ADMIN.</p>
          }
        } @else if (errorAviso()) {
          <p class="incompleto">No se pudo cargar el aviso: {{ errorAviso() }}</p>
        } @else { <p>Cargando aviso…</p> }
        <label class="check"><input type="checkbox" formControlName="autoriza" data-testid="autoriza-registro"> El comprador <strong>autoriza</strong> que guardemos su ficha</label>
        <div class="field">
          <label for="rc-forma">Cómo lo autorizó</label>
          <select id="rc-forma" formControlName="forma">
            @for (f of formas; track f) { <option [value]="f">{{ etiquetaForma(f) }}</option> }
          </select>
        </div>
      </section>

      <section class="aviso" aria-labelledby="aviso-promos">
        <h3 id="aviso-promos">Promociones (pregunta aparte, opcional)</h3>
        @if (aviso(); as a) { <p>{{ a.textoComunicaciones }}</p> }
        <label class="check"><input type="checkbox" formControlName="promociones" data-testid="acepta-promociones"> Acepta recibir promociones</label>
        @if (form.controls.promociones.value) {
          <fieldset class="medios">
            <legend>Por qué medios</legend>
            @for (m of medios; track m) {
              <label><input type="checkbox" [checked]="medioElegido(m)" (change)="alternarMedio(m)"> {{ etiquetaMedio(m) }}</label>
            }
          </fieldset>
        }
      </section>

      @if (error()) { <p class="server-error" role="alert">{{ error() }}</p> }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">No se registra</button>
        <button type="submit" class="btn primary" [disabled]="enviando() || !aviso()">{{ enviando() ? 'Guardando…' : 'Registrar' }}</button>
      </div>
    </form>
  `,
  styles: `
    :host { display: block; width: min(34rem, 100%); background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 92vh; overflow: auto; }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    .hint-block { font-size: var(--font-size-sm); color: var(--color-text-muted); background: var(--color-surface-soft); border-radius: var(--radius-control); padding: var(--space-3); margin: 0 0 var(--space-4); }
    .aviso { border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-3); margin: var(--space-4) 0; font-size: var(--font-size-sm); }
    .aviso h3 { font-size: var(--font-size-sm); margin: 0 0 var(--space-2); }
    .aviso p { margin: 0 0 var(--space-2); }
    .incompleto { color: var(--color-warning); background: var(--color-warning-bg); border-radius: var(--radius-control); padding: var(--space-2); }
    .check { display: flex; gap: var(--space-2); align-items: center; margin: var(--space-2) 0; }
    .medios { border: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: var(--space-3); }
    .medios legend { font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: var(--space-1); }
    .mas summary { cursor: pointer; font-size: var(--font-size-sm); margin-bottom: var(--space-2); }
    .coincidencias { background: var(--color-warning-bg); border-radius: var(--radius-control); padding: var(--space-3); margin-bottom: var(--space-4); font-size: var(--font-size-sm); }
    .coincidencias ul { list-style: none; padding: 0; margin: var(--space-2) 0; }
    .coincidencias li { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); padding: var(--space-1) 0; }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class RegistroClienteDialog {
  protected readonly dialogRef = inject(DialogRef<CompradorSeleccion | undefined>);
  protected readonly data = inject<RegistroClienteDialogData | null>(DIALOG_DATA, { optional: true }) ?? {};
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ClientesApi);

  protected readonly formas: FormaAutorizacion[] = ['VERBAL_PRESENCIAL', 'ESCRITO', 'TELEFONICA', 'DIGITAL'];
  protected readonly medios = MEDIOS_COMERCIALES;
  protected readonly aviso = signal<AvisoPrivacidadResponse | null>(null);
  protected readonly errorAviso = signal<string | null>(null);
  protected readonly coincidencias = signal<CompradorSugerencia[]>([]);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly intentado = signal(false);
  private readonly mediosElegidos = signal<MedioComercial[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    nombre: this.fb.nonNullable.control(this.data.nombre ?? '', [Validators.required, Validators.pattern(/\S/)]),
    telefono: this.fb.nonNullable.control(this.data.telefono ?? '', Validators.required),
    correo: this.fb.nonNullable.control(this.data.correo ?? ''),
    dni: this.fb.nonNullable.control(''),
    ruc: this.fb.nonNullable.control(''),
    // nunca marcados por defecto: el comprador decide
    autoriza: this.fb.nonNullable.control(false),
    forma: this.fb.nonNullable.control<FormaAutorizacion>('VERBAL_PRESENCIAL'),
    promociones: this.fb.nonNullable.control(false)
  });

  constructor() {
    this.api.avisos().subscribe({
      next: (a) => this.aviso.set(a),
      error: (e) => this.errorAviso.set(mapHttpError(e).mensaje)
    });
  }

  protected etiquetaForma(f: FormaAutorizacion): string {
    return ETIQUETAS_FORMA[f];
  }

  protected etiquetaMedio(m: MedioComercial): string {
    return ETIQUETAS_MEDIO[m];
  }

  protected coincidencia(c: CompradorSugerencia): string {
    return etiquetaCoincidencia(c.coincidencia);
  }

  protected medioElegido(m: MedioComercial): boolean {
    return this.mediosElegidos().includes(m);
  }

  protected alternarMedio(m: MedioComercial): void {
    this.mediosElegidos.update((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]));
  }

  protected usar(c: CompradorSugerencia): void {
    this.dialogRef.close({ tipo: c.tipo, id: c.id, nombre: c.nombre, mayorista: c.mayorista });
  }

  /** Primero busca fichas con el mismo teléfono o documento; si las hay, el trabajador decide. */
  enviar(): void {
    this.intentado.set(true);
    this.error.set(null);
    if (this.form.invalid || this.enviando()) return;
    const v = this.form.getRawValue();
    if (!v.autoriza) {
      this.error.set('Sin la autorización del comprador no se registra su ficha. Puedes cerrar y seguir con la venta como «Cliente varios».');
      return;
    }
    if (v.promociones && this.mediosElegidos().length === 0) {
      this.error.set('Elige por qué medios acepta recibir promociones, o desmarca la casilla.');
      return;
    }
    this.enviando.set(true);
    this.api.sugerencias({ telefono: v.telefono, dni: v.dni || null, ruc: v.ruc || null }).subscribe({
      next: (lista) => {
        this.enviando.set(false);
        if (lista.length) {
          this.coincidencias.set(lista);
          return;
        }
        this.crear(false);
      },
      error: () => this.crear(false)
    });
  }

  protected registrarIgual(): void {
    this.crear(true);
  }

  private crear(confirmadoSinCoincidencia: boolean): void {
    const v = this.form.getRawValue();
    const aviso = this.aviso();
    if (!aviso) return;
    this.enviando.set(true);
    this.api.registrar({
      nombre: v.nombre.trim(),
      telefono: v.telefono,
      correo: v.correo.trim() || null,
      dni: v.dni.trim() || null,
      ruc: v.ruc.trim() || null,
      autorizacionRegistro: { otorgada: true, forma: v.forma },
      comunicaciones: v.promociones ? { otorgada: true, medios: this.mediosElegidos(), forma: v.forma } : null,
      avisoVersion: aviso.version,
      confirmadoSinCoincidencia
    }).subscribe({
      next: (c) => this.dialogRef.close({ tipo: 'CLIENTE', id: c.id, nombre: c.nombre, mayorista: c.mayorista }),
      error: (e) => {
        this.enviando.set(false);
        this.error.set(mapHttpError(e).mensaje);
      }
    });
  }
}
