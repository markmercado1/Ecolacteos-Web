import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { mapHttpError } from '../../../../core/http/app-error';
import { fechaHoyLima } from '../../../../shared/util/fecha';
import { InsumoResponse } from '../../../catalogos/data-access/insumo.models';
import { ProveedorCompraResponse } from '../../../proveedores-compra/data-access/proveedor-compra.models';
import { ProveedorCompraSelectorComponent } from '../../../proveedores-compra/ui/proveedor-compra-selector/proveedor-compra-selector';
import { IngresosApi } from '../../data-access/ingresos.api';
import { ADJUNTO_ACEPTA, TrazabilidadApi, problemaDeAdjunto } from '../../../trazabilidad/data-access/trazabilidad.api';
import { DocumentoIngresoResponse, ETIQUETA_DOCUMENTO, TipoDocumentoIngreso } from '../../data-access/ingresos.models';

export interface IngresoDocumentoDialogData {
  /** Insumos que se pueden ingresar (activos). */
  insumos: InsumoResponse[];
  /** Si se abre desde la fila de un insumo: la primera línea ya lo trae. */
  insumoInicial?: InsumoResponse;
}

/** Cantidad con hasta 2 decimales (el stock es NUMERIC(12,2)). */
const CANTIDAD = /^\d{1,10}(\.\d{1,2})?$/;

type LineaForm = FormGroup<{
  insumoId: FormControl<string>;
  cantidad: FormControl<number | null>;
  vence: FormControl<string>;
  codigo: FormControl<string>;
  loteProveedor: FormControl<string>;
}>;

/**
 * Registrar ingreso (PRODUCCION o ADMIN): un documento (proveedor, tipo, número, fecha) con una o varias líneas; cada línea crea un
 * LOTE (insumo, cantidad, vencimiento opcional, código autogenerado o propio, lote del proveedor). Todo o nada. El ingreso por
 * insumo es el mismo modal con la primera línea ya cargada. Cada envío lleva un identificador propio: reintentar tras un corte de
 * red no duplica el ingreso.
 */
@Component({
  selector: 'app-ingreso-documento-dialog',
  imports: [ReactiveFormsModule, ProveedorCompraSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="ingreso-titulo">Registrar ingreso{{ data.insumoInicial ? ' · ' + data.insumoInicial.nombre : '' }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form class="dialog-body" [formGroup]="form" (ngSubmit)="enviar()" aria-labelledby="ingreso-titulo">
      <div class="field">
        <label>Proveedor (opcional)</label>
        <app-proveedor-compra-selector [(seleccionado)]="proveedor" />
      </div>

      <div class="fila">
        <div class="field">
          <label for="ing-tipo">Documento de respaldo</label>
          <select id="ing-tipo" formControlName="tipo">
            @for (t of tipos; track t) { <option [value]="t">{{ etiqueta(t) }}</option> }
          </select>
        </div>
        @if (tipoActual() !== 'SIN_DOCUMENTO') {
          <div class="field" [class.has-error]="numeroFalta()">
            <label for="ing-numero">Número</label>
            <input id="ing-numero" type="text" maxlength="40" formControlName="numero" placeholder="F001-0234">
            @if (numeroFalta()) { <span class="error">Indica el número del documento.</span> }
          </div>
          <div class="field">
            <label for="ing-fecha">Fecha del documento</label>
            <input id="ing-fecha" type="date" [max]="hoy" formControlName="fecha">
          </div>
        }
      </div>

      <fieldset class="lineas">
        <legend>Insumos que ingresan</legend>
        @for (l of lineas.controls; track l; let i = $index) {
          <div class="linea" [formGroup]="l" role="group" [attr.aria-label]="'Línea ' + (i + 1)">
            <div class="field">
              <label [for]="'ing-insumo-' + i">Insumo</label>
              <select [id]="'ing-insumo-' + i" formControlName="insumoId" required>
                <option value="">Selecciona el insumo</option>
                @if (habituales().length > 0) {
                  <optgroup label="Suele proveer">
                    @for (ins of habituales(); track ins.id) { <option [value]="ins.id">{{ ins.nombre }} ({{ ins.unidadMedida }})</option> }
                  </optgroup>
                  <optgroup label="Otros insumos">
                    @for (ins of otros(); track ins.id) { <option [value]="ins.id">{{ ins.nombre }} ({{ ins.unidadMedida }})</option> }
                  </optgroup>
                } @else {
                  @for (ins of data.insumos; track ins.id) { <option [value]="ins.id">{{ ins.nombre }} ({{ ins.unidadMedida }})</option> }
                }
              </select>
            </div>
            <div class="field" [class.has-error]="invalidaCantidad(l)">
              <label [for]="'ing-cantidad-' + i">Cantidad{{ unidadDe(l) ? ' (' + unidadDe(l) + ')' : '' }}</label>
              <input [id]="'ing-cantidad-' + i" type="number" min="0.01" step="0.01" formControlName="cantidad" required>
              @if (invalidaCantidad(l)) { <span class="error">Mayor que 0, con hasta dos decimales.</span> }
            </div>
            <div class="field">
              <label [for]="'ing-vence-' + i">Vence (opcional)</label>
              <input [id]="'ing-vence-' + i" type="date" [min]="hoy" formControlName="vence">
            </div>
            <div class="field">
              <label [for]="'ing-codigo-' + i">Código de lote</label>
              <input [id]="'ing-codigo-' + i" type="text" maxlength="40" formControlName="codigo" placeholder="Se genera solo">
            </div>
            <div class="field">
              <label [for]="'ing-prov-' + i">Lote del proveedor</label>
              <input [id]="'ing-prov-' + i" type="text" maxlength="60" formControlName="loteProveedor">
            </div>
            @if (lineas.length > 1) {
              <button type="button" class="btn small quitar" (click)="quitarLinea(i)" [attr.aria-label]="'Quitar línea ' + (i + 1)">Quitar</button>
            }
          </div>
        }
        <button type="button" class="btn small" (click)="agregarLinea()">+ Agregar línea</button>
      </fieldset>

      <div class="field adjuntos">
        <label for="ing-recibo">Recibo (opcional): foto o PDF, hasta 10 MB</label>
        <input id="ing-recibo" type="file" multiple [accept]="acepta" capture="environment" (change)="elegirArchivos($any($event.target))">
        @for (a of archivos(); track $index) { <span class="archivo">{{ a.name }} <button type="button" class="row-link" (click)="quitarArchivo($index)" [attr.aria-label]="'Quitar ' + a.name">Quitar</button></span> }
        @if (problemaArchivos()) { <span class="error" role="alert">{{ problemaArchivos() }}</span> }
      </div>

      <div class="field">
        <label for="ing-observacion">Observación (opcional)</label>
        <textarea id="ing-observacion" rows="2" maxlength="500" formControlName="observacion"></textarea>
      </div>

      @if (errorServidor()) { <p class="server-error" role="alert">{{ errorServidor() }}</p> }
      @if (registrado()) {
        <p class="server-error" role="alert">El ingreso ya quedó registrado, pero no se pudo adjuntar: {{ fallidos().join(', ') }}. Puedes adjuntarlo después en Trazabilidad.</p>
      }
      <div class="dialog-foot">
        @if (registrado(); as r) {
          <button type="button" class="btn primary" (click)="dialogRef.close(r)">Cerrar</button>
        } @else {
          <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
          <button type="submit" class="btn primary" [disabled]="enviando()">{{ enviando() ? 'Guardando…' : 'Registrar ingreso' }}</button>
        }
      </div>
      <p class="hint">Cada línea crea un lote y queda en el kardex del insumo con tu usuario, la fecha y hora. Los movimientos no se editan ni se eliminan.</p>
    </form>
  `,
  styles: `
    :host { display: block; width: min(46rem, 100%); background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 92vh; overflow: auto; }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; flex-shrink: 0; }
    .dialog-body { padding: var(--space-6); }
    .fila { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: var(--space-3); }
    .lineas { border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-3); margin: 0 0 var(--space-4); }
    .lineas legend { font-size: 0.75rem; font-weight: 700; padding: 0 var(--space-2); }
    .linea { display: grid; grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr)); gap: var(--space-3); align-items: end; padding-bottom: var(--space-3); margin-bottom: var(--space-3); border-bottom: 1px dashed var(--color-border); }
    .quitar { justify-self: start; }
    .error { font-size: 0.6875rem; color: var(--color-danger); font-weight: 600; }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); }
    .hint { color: var(--color-text-muted); font-size: 0.75rem; margin: var(--space-3) 0 0; }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class IngresoDocumentoDialog {
  protected readonly dialogRef = inject(DialogRef<DocumentoIngresoResponse | undefined>);
  protected readonly data = inject<IngresoDocumentoDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(IngresosApi);
  private readonly trazabilidadApi = inject(TrazabilidadApi);

  protected readonly acepta = ADJUNTO_ACEPTA;
  protected readonly archivos = signal<File[]>([]);
  protected readonly problemaArchivos = signal<string | null>(null);
  /** El ingreso ya registrado cuando algún adjunto falló (para cerrar sin repetirlo). */
  protected readonly registrado = signal<DocumentoIngresoResponse | null>(null);
  protected readonly fallidos = signal<string[]>([]);

  protected readonly tipos: TipoDocumentoIngreso[] = ['SIN_DOCUMENTO', 'GUIA', 'FACTURA', 'BOLETA', 'OTRO'];
  protected readonly etiqueta = (t: TipoDocumentoIngreso) => ETIQUETA_DOCUMENTO[t];
  protected readonly hoy = fechaHoyLima();
  protected readonly proveedor = signal<ProveedorCompraResponse | null>(null);
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  private readonly intentado = signal(false);
  /** Identificador de ESTE ingreso: reintentarlo (p. ej. tras un corte de red) nunca lo duplica. */
  private readonly uuidCliente = crypto.randomUUID();

  protected readonly form = this.fb.group({
    tipo: this.fb.nonNullable.control<TipoDocumentoIngreso>('SIN_DOCUMENTO'),
    numero: this.fb.nonNullable.control(''),
    fecha: this.fb.nonNullable.control(''),
    observacion: this.fb.nonNullable.control('', Validators.maxLength(500))
  });
  protected readonly lineas = new FormArray<LineaForm>([]);

  protected readonly tipoActual = signal<TipoDocumentoIngreso>('SIN_DOCUMENTO');
  /** Insumos que el proveedor elegido suele proveer van primero en el selector de cada línea. */
  protected readonly habituales = computed(() => {
    const ids = new Set(this.proveedor()?.insumosHabituales.map((i) => i.id) ?? []);
    return this.data.insumos.filter((i) => ids.has(i.id));
  });
  protected readonly otros = computed(() => {
    const ids = new Set(this.habituales().map((i) => i.id));
    return this.data.insumos.filter((i) => !ids.has(i.id));
  });

  constructor() {
    this.lineas.push(this.nuevaLinea(this.data.insumoInicial?.id ?? ''));
    this.form.controls.tipo.valueChanges.subscribe((t) => this.tipoActual.set(t));
  }

  private nuevaLinea(insumoId: string): LineaForm {
    return this.fb.nonNullable.group({
      insumoId: [insumoId, Validators.required],
      cantidad: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01), Validators.pattern(CANTIDAD)]),
      vence: [''],
      codigo: ['', Validators.maxLength(40)],
      loteProveedor: ['', Validators.maxLength(60)]
    }) as LineaForm;
  }

  protected agregarLinea(): void {
    this.lineas.push(this.nuevaLinea(''));
  }

  protected quitarLinea(i: number): void {
    if (this.lineas.length > 1) this.lineas.removeAt(i);
  }

  protected unidadDe(l: LineaForm): string {
    return this.data.insumos.find((i) => i.id === l.controls.insumoId.value)?.unidadMedida ?? '';
  }

  protected invalidaCantidad(l: LineaForm): boolean {
    const c = l.controls.cantidad;
    return c.invalid && (c.touched || this.intentado());
  }

  protected numeroFalta(): boolean {
    return this.tipoActual() !== 'SIN_DOCUMENTO' && !this.form.controls.numero.value.trim() && this.intentado();
  }

  protected elegirArchivos(input: HTMLInputElement): void {
    const nuevos = Array.from(input.files ?? []);
    input.value = '';
    const problema = nuevos.map(problemaDeAdjunto).find((p) => p !== null) ?? null;
    this.problemaArchivos.set(problema);
    if (!problema) this.archivos.update((a) => [...a, ...nuevos]);
  }

  protected quitarArchivo(i: number): void {
    this.archivos.update((a) => a.filter((_, k) => k !== i));
  }

  /** Sube los recibos uno por uno al documento ya registrado; los que fallen se avisan sin perder el ingreso. */
  private adjuntarYCerrar(doc: DocumentoIngresoResponse): void {
    const pendientes = [...this.archivos()];
    const fallidos: string[] = [];
    const siguiente = (): void => {
      const a = pendientes.shift();
      if (!a) {
        if (fallidos.length === 0) {
          this.dialogRef.close(doc);
        } else {
          this.enviando.set(false);
          this.fallidos.set(fallidos);
          this.registrado.set(doc);
        }
        return;
      }
      this.trazabilidadApi.adjuntar(doc.id, a).subscribe({ next: () => siguiente(), error: () => { fallidos.push(a.name); siguiente(); } });
    };
    siguiente();
  }

  protected enviar(): void {
    if (this.enviando()) return;
    this.intentado.set(true);
    this.lineas.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.form.invalid || this.lineas.invalid || this.numeroFalta()) return;
    this.enviando.set(true);
    this.errorServidor.set(null);
    this.api
      .registrar({
        uuidCliente: this.uuidCliente,
        proveedorId: this.proveedor()?.id ?? null,
        tipoDocumento: v.tipo,
        numeroDocumento: v.tipo === 'SIN_DOCUMENTO' ? null : v.numero.trim(),
        fechaDocumento: v.tipo === 'SIN_DOCUMENTO' ? null : v.fecha || null,
        observacion: v.observacion.trim() || null,
        lineas: this.lineas.controls.map((l) => {
          const x = l.getRawValue();
          return {
            insumoId: x.insumoId,
            cantidad: Number(x.cantidad),
            codigoLote: x.codigo.trim() || null,
            loteProveedor: x.loteProveedor.trim() || null,
            fechaVencimiento: x.vence || null
          };
        })
      })
      .subscribe({
        next: (r) => (this.archivos().length > 0 ? this.adjuntarYCerrar(r) : this.dialogRef.close(r)),
        error: (e) => {
          this.enviando.set(false);
          this.errorServidor.set(mapHttpError(e).mensaje);
        }
      });
  }
}
