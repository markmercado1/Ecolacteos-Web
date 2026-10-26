import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AuthService } from '../../../../core/auth/auth.service';
import { mapHttpError } from '../../../../core/http/app-error';
import {
  AvisoPrivacidadResponse,
  CanalHabitual,
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
  /** Canal que se propone al vender (solo clientes; null o ausente = PÚBLICO). */
  canalHabitual?: CanalHabitual | null;
}

type Campo = 'nombre' | 'razonSocial' | 'telefono' | 'correo' | 'dni' | 'ruc' | 'motivoMayorista';

/**
 * Fase H, refactor: registro VOLUNTARIO de un comprador en un solo paso. El trabajador le lee el aviso y, si el comprador acepta,
 * pulsa «Registrar cliente»: ESA acción es la que deja constancia de su autorización (con la forma elegida y la versión del aviso), sin
 * casillas ni confirmaciones extra. Las promociones son una pregunta aparte y opcional: marcar por qué medios acepta recibirlas es su
 * autorización; sin medios, no se registra ninguna. Antes de crear se buscan fichas con el mismo teléfono o documento: el trabajador
 * confirma si es alguna (y la usa) o si es otra persona; nada se une solo.
 *
 * Tipo de cliente (regular o mayorista; mayorista solo ADMIN, con motivo) y canal habitual (el que se propone al vender) son campos
 * distintos; el servidor vuelve a validar ambos.
 */
@Component({
  selector: 'app-registro-cliente-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="registro-titulo">Registrar cliente</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="registro-titulo" novalidate>
      <p class="hint-block">Registrarse es <strong>voluntario</strong>: si el comprador no quiere, cancela y la venta sigue igual, al mismo precio.</p>

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

      <fieldset class="opciones">
        <legend>Tipo de persona</legend>
        <label><input type="radio" formControlName="tipoPersona" value="NATURAL" (change)="cambioTipoPersona()"> Persona natural</label>
        <label><input type="radio" formControlName="tipoPersona" value="EMPRESA" (change)="cambioTipoPersona()"> Empresa</label>
      </fieldset>

      @if (esEmpresa()) {
        <div class="field" [class.has-error]="errorDe('razonSocial')">
          <label for="rc-razon">Razón social</label>
          <input id="rc-razon" type="text" formControlName="razonSocial" maxlength="150" aria-describedby="rc-razon-error">
          @if (errorDe('razonSocial'); as e) { <span class="error" id="rc-razon-error">{{ e }}</span> }
        </div>
        <div class="fila-campos">
          <div class="field" [class.has-error]="errorDe('ruc')">
            <label for="rc-ruc">RUC</label>
            <input id="rc-ruc" type="text" inputmode="numeric" formControlName="ruc" maxlength="11" aria-describedby="rc-ruc-error">
            @if (errorDe('ruc'); as e) { <span class="error" id="rc-ruc-error">{{ e }}</span> }
          </div>
          <div class="field">
            <label for="rc-nombre">Nombre comercial (opcional)</label>
            <input id="rc-nombre" type="text" formControlName="nombre" maxlength="150">
          </div>
        </div>
      } @else {
        <div class="field" [class.has-error]="errorDe('nombre')">
          <label for="rc-nombre">Nombre</label>
          <input id="rc-nombre" type="text" formControlName="nombre" maxlength="150" aria-describedby="rc-nombre-error">
          @if (errorDe('nombre'); as e) { <span class="error" id="rc-nombre-error">{{ e }}</span> }
        </div>
        <div class="fila-campos">
          <div class="field" [class.has-error]="errorDe('dni')">
            <label for="rc-dni">DNI (opcional)</label>
            <input id="rc-dni" type="text" inputmode="numeric" formControlName="dni" maxlength="8" aria-describedby="rc-dni-error">
            @if (errorDe('dni'); as e) { <span class="error" id="rc-dni-error">{{ e }}</span> }
          </div>
          <div class="field" [class.has-error]="errorDe('ruc')">
            <label for="rc-ruc">RUC (opcional)</label>
            <input id="rc-ruc" type="text" inputmode="numeric" formControlName="ruc" maxlength="11" aria-describedby="rc-ruc-error">
            @if (errorDe('ruc'); as e) { <span class="error" id="rc-ruc-error">{{ e }}</span> }
          </div>
        </div>
      }

      <div class="fila-campos">
        <div class="field" [class.has-error]="errorDe('telefono')">
          <label for="rc-telefono">Teléfono (celular)</label>
          <input id="rc-telefono" type="tel" formControlName="telefono" aria-describedby="rc-telefono-error">
          @if (errorDe('telefono'); as e) { <span class="error" id="rc-telefono-error">{{ e }}</span> }
        </div>
        <div class="field" [class.has-error]="errorDe('correo')">
          <label for="rc-correo">Correo (opcional)</label>
          <input id="rc-correo" type="email" formControlName="correo" maxlength="120" aria-describedby="rc-correo-error">
          @if (errorDe('correo'); as e) { <span class="error" id="rc-correo-error">{{ e }}</span> }
        </div>
      </div>

      <div class="fila-campos">
        <div class="field">
          <label for="rc-tipo-cliente">Tipo de cliente</label>
          <select id="rc-tipo-cliente" formControlName="tipoCliente" (change)="cambioTipoCliente()" aria-describedby="rc-tipo-ayuda">
            <option value="REGULAR">Regular</option>
            <option value="MAYORISTA" [disabled]="!esAdmin()">Mayorista{{ esAdmin() ? '' : ' (solo ADMIN)' }}</option>
          </select>
          <span class="hint" id="rc-tipo-ayuda">{{ esAdmin() ? 'Mayorista habilita el precio MAYORISTA.' : 'Solo ADMIN habilita mayoristas.' }}</span>
        </div>
        <div class="field">
          <label for="rc-canal">Canal habitual</label>
          <select id="rc-canal" formControlName="canalHabitual" aria-describedby="rc-canal-ayuda">
            <option value="PUBLICO">Público</option>
            <option value="MAYORISTA" [disabled]="!esMayorista()">Mayorista</option>
          </select>
          <span class="hint" id="rc-canal-ayuda">Se propone al venderle; cada venta puede usar otro canal permitido.</span>
        </div>
      </div>
      @if (esMayorista()) {
        <div class="field" [class.has-error]="errorDe('motivoMayorista')">
          <label for="rc-motivo">Motivo para habilitarlo como mayorista</label>
          <input id="rc-motivo" type="text" formControlName="motivoMayorista" maxlength="300" aria-describedby="rc-motivo-error">
          @if (errorDe('motivoMayorista'); as e) { <span class="error" id="rc-motivo-error">{{ e }}</span> }
        </div>
      }

      <section class="aviso" aria-labelledby="aviso-registro">
        <h3 id="aviso-registro">Léele el aviso al comprador</h3>
        @if (aviso(); as a) {
          @for (p of a.avisoRegistro; track p) { <p>{{ p }}</p> }
          @if (!a.completo) {
            <p class="incompleto" data-testid="aviso-incompleto">Aviso incompleto: faltan datos del negocio ({{ a.faltantes.join('; ') }}). Pídeselos a ADMIN.</p>
          }
        } @else if (errorAviso()) {
          <p class="incompleto">No se pudo cargar el aviso: {{ errorAviso() }}</p>
        } @else { <p>Cargando aviso…</p> }
        <div class="field compacto">
          <label for="rc-forma">Cómo aceptó</label>
          <select id="rc-forma" formControlName="forma">
            @for (f of formas; track f) { <option [value]="f">{{ etiquetaForma(f) }}</option> }
          </select>
        </div>
      </section>

      <section class="aviso" aria-labelledby="aviso-promos">
        <h3 id="aviso-promos">Promociones (pregunta aparte, opcional)</h3>
        @if (aviso(); as a) { <p>{{ a.textoComunicaciones }}</p> }
        <fieldset class="medios" data-testid="medios-promociones">
          <legend>Si acepta recibirlas, marca por dónde. Si no, déjalo sin marcar.</legend>
          @for (m of medios; track m) {
            <label><input type="checkbox" [checked]="medioElegido(m)" (change)="alternarMedio(m)"> {{ etiquetaMedio(m) }}</label>
          }
        </fieldset>
      </section>

      @if (error()) { <p class="server-error" role="alert">{{ error() }}</p> }
      <p class="constancia">Al pulsar «Registrar cliente» queda constancia de que el comprador escuchó el aviso y aceptó guardar su ficha.</p>
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando() || !aviso()">{{ enviando() ? 'Guardando…' : 'Registrar cliente' }}</button>
      </div>
    </form>
  `,
  styles: `
    /* ancho FIJO (no porcentual): así el panel del overlay se ajusta a la tarjeta y queda centrado, aunque los textos sean largos */
    :host {
      display: block; width: 38rem; max-width: calc(100vw - 2rem); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    .hint-block { font-size: var(--font-size-sm); color: var(--color-text-muted); background: var(--color-surface-soft); border-radius: var(--radius-control); padding: var(--space-3); margin: 0 0 var(--space-4); }
    .opciones { border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-3); margin: 0 0 var(--space-4); display: flex; gap: var(--space-4); flex-wrap: wrap; }
    .opciones legend { font-size: var(--font-size-sm); font-weight: 600; padding: 0 var(--space-1); }
    .opciones label { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-sm); }
    .fila-campos { display: grid; grid-template-columns: 1fr 1fr; gap: 0 var(--space-4); }
    .aviso { border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-3); margin: 0 0 var(--space-4); font-size: var(--font-size-sm); }
    .aviso h3 { font-size: var(--font-size-sm); margin: 0 0 var(--space-2); }
    .aviso p { margin: 0 0 var(--space-2); }
    .field.compacto { margin: var(--space-3) 0 0; max-width: 18rem; }
    .incompleto { color: var(--color-warning); background: var(--color-warning-bg); border-radius: var(--radius-control); padding: var(--space-2); }
    .medios { border: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); }
    .medios legend { font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: var(--space-2); padding: 0; }
    .medios label { display: inline-flex; align-items: center; gap: var(--space-2); }
    .coincidencias { background: var(--color-warning-bg); border-radius: var(--radius-control); padding: var(--space-3); margin-bottom: var(--space-4); font-size: var(--font-size-sm); }
    .coincidencias ul { list-style: none; padding: 0; margin: var(--space-2) 0; }
    .coincidencias li { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); padding: var(--space-1) 0; }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); }
    .constancia { font-size: 0.75rem; color: var(--color-text-muted); margin: 0; }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-3); flex-wrap: wrap; }
    @media (max-width: 560px) {
      .dialog-head, .dialog-body { padding-left: var(--space-4); padding-right: var(--space-4); }
      .fila-campos { grid-template-columns: 1fr; }
      .coincidencias li { flex-direction: column; align-items: flex-start; }
    }
  `
})
export class RegistroClienteDialog {
  protected readonly dialogRef = inject(DialogRef<CompradorSeleccion | undefined>);
  protected readonly data = inject<RegistroClienteDialogData | null>(DIALOG_DATA, { optional: true }) ?? {};
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ClientesApi);
  private readonly auth = inject(AuthService);

  protected readonly esAdmin = computed(() => this.auth.usuario()?.rolNombre === 'ADMIN');
  protected readonly formas: FormaAutorizacion[] = ['VERBAL_PRESENCIAL', 'ESCRITO', 'TELEFONICA', 'DIGITAL'];
  protected readonly medios = MEDIOS_COMERCIALES;
  protected readonly aviso = signal<AvisoPrivacidadResponse | null>(null);
  protected readonly errorAviso = signal<string | null>(null);
  protected readonly coincidencias = signal<CompradorSugerencia[]>([]);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Errores de forma por campo, calculados al intentar registrar (se muestran junto a cada campo). */
  private readonly errores = signal<Partial<Record<Campo, string>>>({});
  private readonly mediosElegidos = signal<MedioComercial[]>([]);
  private intentado = false;
  protected readonly esEmpresa = signal(false);
  protected readonly esMayorista = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    tipoPersona: this.fb.nonNullable.control<'NATURAL' | 'EMPRESA'>('NATURAL'),
    nombre: this.fb.nonNullable.control(this.data.nombre ?? ''),
    razonSocial: this.fb.nonNullable.control(''),
    telefono: this.fb.nonNullable.control(this.data.telefono ?? ''),
    correo: this.fb.nonNullable.control(this.data.correo ?? ''),
    dni: this.fb.nonNullable.control(''),
    ruc: this.fb.nonNullable.control(''),
    tipoCliente: this.fb.nonNullable.control<'REGULAR' | 'MAYORISTA'>('REGULAR'),
    motivoMayorista: this.fb.nonNullable.control(''),
    canalHabitual: this.fb.nonNullable.control<CanalHabitual>('PUBLICO'),
    forma: this.fb.nonNullable.control<FormaAutorizacion>('VERBAL_PRESENCIAL')
  });

  constructor() {
    this.api.avisos().subscribe({
      next: (a) => this.aviso.set(a),
      error: (e) => this.errorAviso.set(mapHttpError(e).mensaje)
    });
    // tras el primer intento, los errores se recalculan al escribir: uno corregido desaparece en el acto
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.intentado) this.errores.set(this.validar());
    });
  }

  protected errorDe(campo: Campo): string | null {
    return this.errores()[campo] ?? null;
  }

  protected cambioTipoPersona(): void {
    const empresa = this.form.controls.tipoPersona.value === 'EMPRESA';
    this.esEmpresa.set(empresa);
    if (empresa) this.form.controls.dni.setValue(''); // una empresa no lleva DNI
    else this.form.controls.razonSocial.setValue('');
    this.errores.set(this.intentado ? this.validar() : {});
  }

  protected cambioTipoCliente(): void {
    const mayorista = this.form.controls.tipoCliente.value === 'MAYORISTA';
    this.esMayorista.set(mayorista);
    if (!mayorista) {
      this.form.controls.canalHabitual.setValue('PUBLICO'); // el canal MAYORISTA exige ser mayorista
      this.form.controls.motivoMayorista.setValue('');
    }
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
    this.dialogRef.close({ tipo: c.tipo, id: c.id, nombre: c.nombre, mayorista: c.mayorista, canalHabitual: c.canalHabitual });
  }

  /** Mismas formas que el servidor (que vuelve a validar todo, incluidos duplicados). */
  private validar(): Partial<Record<Campo, string>> {
    const v = this.form.getRawValue();
    const e: Partial<Record<Campo, string>> = {};
    const digitos = (t: string) => t.replace(/[\s\-.]/g, '');
    const dni = digitos(v.dni);
    const ruc = digitos(v.ruc);
    if (v.tipoPersona === 'EMPRESA') {
      if (!v.razonSocial.trim()) e.razonSocial = 'La razón social es obligatoria para una empresa.';
      if (!ruc) e.ruc = 'El RUC es obligatorio para una empresa.';
      else if (!/^20\d{9}$/.test(ruc)) e.ruc = 'El RUC de una empresa tiene 11 dígitos y empieza con 20.';
    } else {
      if (!v.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
      if (dni && !/^\d{8}$/.test(dni)) e.dni = 'El DNI tiene exactamente 8 dígitos.';
      if (ruc && !/^10\d{9}$/.test(ruc)) e.ruc = 'El RUC de una persona natural tiene 11 dígitos y empieza con 10.';
    }
    const telefono = digitos(v.telefono).replace(/^\+?51(?=9\d{8}$)/, '');
    if (!telefono) e.telefono = 'El teléfono es obligatorio.';
    else if (!/^9\d{8}$/.test(telefono)) e.telefono = 'Debe ser un celular peruano: 9 dígitos que empiezan con 9.';
    if (v.correo.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.correo.trim())) e.correo = 'El correo no es válido.';
    if (v.tipoCliente === 'MAYORISTA' && !v.motivoMayorista.trim()) e.motivoMayorista = 'El motivo es obligatorio para habilitar un mayorista.';
    return e;
  }

  /** Primero busca fichas con el mismo teléfono o documento; si las hay, el trabajador decide. */
  enviar(): void {
    this.error.set(null);
    this.intentado = true;
    const errores = this.validar();
    this.errores.set(errores);
    if (Object.keys(errores).length || this.enviando()) return;
    const v = this.form.getRawValue();
    this.enviando.set(true);
    this.api.sugerencias({ telefono: v.telefono, dni: v.dni.trim() || null, ruc: v.ruc.trim() || null }).subscribe({
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
    const empresa = v.tipoPersona === 'EMPRESA';
    const mayorista = v.tipoCliente === 'MAYORISTA' && this.esAdmin();
    const medios = this.mediosElegidos();
    this.enviando.set(true);
    this.api.registrar({
      tipoPersona: v.tipoPersona,
      nombre: v.nombre.trim() || (empresa ? v.razonSocial.trim() : ''),
      telefono: v.telefono,
      correo: v.correo.trim() || null,
      dni: empresa ? null : v.dni.trim() || null,
      ruc: v.ruc.trim() || null,
      razonSocial: empresa ? v.razonSocial.trim() : null,
      // pulsar «Registrar cliente» tras leer el aviso ES la autorización: se registra con la forma elegida
      autorizacionRegistro: { otorgada: true, forma: v.forma },
      // promociones: solo si eligió medios (nunca por defecto)
      comunicaciones: medios.length ? { otorgada: true, medios, forma: v.forma } : null,
      avisoVersion: aviso.version,
      confirmadoSinCoincidencia,
      mayorista,
      motivoMayorista: mayorista ? v.motivoMayorista.trim() : null,
      canalHabitual: mayorista ? v.canalHabitual : 'PUBLICO'
    }).subscribe({
      next: (c) => this.dialogRef.close({ tipo: 'CLIENTE', id: c.id, nombre: c.nombre, mayorista: c.mayorista, canalHabitual: c.canalHabitual }),
      error: (e) => {
        this.enviando.set(false);
        this.error.set(mapHttpError(e).mensaje);
      }
    });
  }
}
