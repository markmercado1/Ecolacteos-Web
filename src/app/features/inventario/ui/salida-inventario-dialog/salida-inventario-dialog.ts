import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { mapHttpError } from '../../../../core/http/app-error';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { SalidaPendienteService } from '../../data-access/salida-pendiente.service';
import { InventarioApi } from '../../data-access/inventario.api';
import { LotesInsumoApi } from '../../data-access/lotes.api';
import { ETIQUETA_ESTADO_LOTE, LoteInsumoResponse } from '../../data-access/lotes.models';
import { LoteExistenciaResponse, MOTIVOS_INSUMO, SalidaInventarioRequest, SalidaInventarioResponse } from '../../data-access/inventario.models';

export interface SalidaInventarioDialogData {
  tipo: 'insumos' | 'presentaciones';
  id: string;
  nombre: string;
  controlaVencimiento: boolean;
}

@Component({
  selector: 'app-salida-inventario-dialog',
  imports: [ReactiveFormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../movimiento-inventario-dialog.css',
  template: `
    <div class="dialog-head"><h2 id="salida-titulo">Registrar salida · {{ data.nombre }}</h2>
      <button type="button" class="close" [disabled]="enviando()" (click)="cerrar()" aria-label="Cerrar">×</button>
    </div>
    <form class="dialog-body" [formGroup]="form" (ngSubmit)="enviar()" aria-labelledby="salida-titulo">
      <p class="hint">Retiro físico del inventario. Conserva su motivo y un movimiento en el Kardex.</p>
      @if (cargando()) { <p role="status">Cargando lotes…</p> }
      @if (errorCarga()) { <p role="alert" class="server-error">{{ errorCarga() }}</p><button type="button" class="btn" (click)="recargar()">Reintentar</button> }
      <fieldset [disabled]="enviando() || !!pendiente" class="campos-salida">
        @if (data.controlaVencimiento) {
          <div class="field"><label for="salida-lote">Lote</label><select id="salida-lote" formControlName="lote" required>
            <option value="">Selecciona el lote</option>
            @if (pendiente?.loteId) { <option [value]="pendiente!.loteId">Lote de la salida pendiente · {{ pendiente!.loteId }}</option> }
            @for (l of lotes(); track l.id) { <option [value]="l.id">{{ l.origen === 'LOTE' ? 'Producción' : 'Regularización' }} · {{ l.id.slice(0, 8) }} · Vence {{ l.fechaVencimiento | date:'dd/MM/yyyy' }} · {{ l.saldo }} unidades</option> }
          </select></div>
        }
        @if (data.tipo === 'insumos') {
          <div class="field"><label for="salida-lote-insumo">Lote</label><select id="salida-lote-insumo" formControlName="loteInsumo">
            <option value="">Automático (el que vence antes)</option>
            @for (l of lotesInsumo(); track l.id) { <option [value]="l.id">{{ l.codigo }} · {{ etiquetaEstado(l) }}{{ l.fechaVencimiento ? ' · vence ' + (l.fechaVencimiento | date:'dd/MM/yyyy') : '' }} · {{ l.cantidadDisponible }} disponible</option> }
          </select></div>
        }
        <div class="field"><label for="salida-cantidad">Cantidad que se retira</label>
          <input id="salida-cantidad" type="number" [min]="data.tipo === 'insumos' ? 0.01 : 1" [step]="data.tipo === 'insumos' ? 0.01 : 1" formControlName="cantidad" required></div>
        <div class="field"><label for="salida-tipo">Tipo de salida</label><select id="salida-tipo" formControlName="tipo">
          @if (data.tipo === 'insumos') {
            @for (m of motivosInsumo; track m.valor) { <option [value]="m.valor">{{ m.etiqueta }}</option> }
          } @else {
            @if (data.controlaVencimiento) { <option value="VENCIMIENTO">Vencimiento</option> }
            <option value="DETERIORO">Deterioro</option><option value="OTRA">Otra salida justificada</option>
          }
        </select></div>
        <div class="field"><label for="salida-motivo">Motivo</label><textarea id="salida-motivo" formControlName="motivo" maxlength="500" required rows="3"></textarea></div>
      </fieldset>
      @if (form.invalid && intentado()) { <p role="alert" class="error">Completa el lote cuando corresponda, una cantidad positiva válida y el motivo.</p> }
      @if (error()) { <p role="alert" class="server-error">{{ error() }}</p> }
      @if (pendiente && !enviando()) { <p class="hint">La operación puede haberse registrado. Reintenta con los mismos datos para comprobarla sin duplicar el descuento.</p> }
      <div class="dialog-foot"><button type="button" class="btn" [disabled]="enviando()" (click)="cerrar()">Cerrar</button>
        <button type="submit" class="btn primary" [disabled]="enviando() || cargando() || !!errorCarga()">{{ enviando() ? 'Guardando…' : pendiente ? 'Reintentar salida' : 'Registrar salida' }}</button></div>
    </form>
  `
})
export class SalidaInventarioDialog {
  protected readonly data = inject<SalidaInventarioDialogData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<SalidaInventarioResponse>);
  private readonly api = inject(InventarioApi);
  private readonly lotesApi = inject(LotesInsumoApi);
  protected readonly motivosInsumo = MOTIVOS_INSUMO;
  protected readonly lotesInsumo = signal<LoteInsumoResponse[]>([]);
  protected readonly etiquetaEstado = (l: LoteInsumoResponse) => ETIQUETA_ESTADO_LOTE[l.estado];
  private readonly dialog = inject(Dialog);
  private readonly pendientes = inject(SalidaPendienteService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  protected readonly lotes = signal<LoteExistenciaResponse[]>([]);
  protected readonly cargando = signal(false);
  protected readonly errorCarga = signal('');
  protected readonly error = signal('');
  protected readonly enviando = signal(false);
  protected readonly intentado = signal(false);
  protected pendiente: SalidaInventarioRequest | null = null;
  protected readonly form = this.fb.group({
    lote: ['', this.data.controlaVencimiento ? Validators.required : []],
    /** Lote de insumo elegido; vacío = automático (FEFO). */
    loteInsumo: [''],
    cantidad: this.fb.control<number | null>(null, [Validators.required, Validators.min(this.data.tipo === 'insumos' ? 0.01 : 1), Validators.pattern(this.data.tipo === 'insumos' ? /^\d{1,10}(\.\d{1,2})?$/ : /^\d{1,9}$/)]),
    tipo: this.fb.nonNullable.control<SalidaInventarioRequest['tipo']>(this.data.tipo === 'insumos' ? 'MERMA' : 'DETERIORO'),
    motivo: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)]]
  });
  constructor() {
    this.ref.disableClose = true;
    this.ref.backdropClick.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cerrar());
    this.ref.keydownEvents.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(e => {
      if (e.key === 'Escape') this.cerrar();
    });
    try {
      this.pendiente = this.pendientes.leer(this.data.tipo, this.data.id);
      if (this.pendiente) {
        this.form.patchValue({ ...this.pendiente, lote: this.pendiente.origenLote === 'INSUMO' ? '' : (this.pendiente.loteId ?? ''),
          loteInsumo: this.pendiente.origenLote === 'INSUMO' ? (this.pendiente.loteId ?? '') : '' });
      }
    } catch {
      this.errorCarga.set('El navegador no permite recuperar la salida pendiente. Habilita el almacenamiento de esta pestaña antes de continuar.');
    }
    if (this.data.controlaVencimiento && !this.pendiente && !this.errorCarga()) this.cargarLotes();
    if (this.data.tipo === 'insumos' && !this.errorCarga()) this.cargarLotesInsumo();
  }

  protected recargar(): void {
    if (this.data.tipo === 'insumos') this.cargarLotesInsumo(); else this.cargarLotes();
  }

  /** Lotes del insumo con existencia, para elegir de cuál sale (o dejarlo en automático). */
  protected cargarLotesInsumo(): void {
    this.cargando.set(true); this.errorCarga.set('');
    this.lotesApi.listar(this.data.id, true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: l => { this.lotesInsumo.set(l); this.cargando.set(false); },
      error: e => { this.errorCarga.set(mapHttpError(e).mensaje); this.cargando.set(false); }
    });
  }

  protected cerrar(): void {
    if (this.enviando()) return;
    if (!this.form.dirty && !this.pendiente) {
      this.ref.close();
      return;
    }
    const mensaje = this.pendiente
      ? 'La salida está pendiente de confirmar. Sus datos se conservarán en esta pestaña para reintentar sin duplicar el descuento al volver a abrirla.'
      : 'Se perderán los datos de esta salida que todavía no has registrado.';
    this.dialog.open<boolean>(ConfirmDialog, {
      ariaLabel: 'Cerrar salida de inventario',
      data: { titulo: 'Cerrar salida', mensaje, etiquetaConfirmar: 'Cerrar' }
    }).closed.subscribe(confirmado => { if (confirmado) this.ref.close(); });
  }
  protected cargarLotes(): void {
    this.cargando.set(true); this.errorCarga.set('');
    this.api.obtenerExistencias(this.data.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: e => { this.lotes.set(e.lotes); this.cargando.set(false); },
      error: e => { this.errorCarga.set(mapHttpError(e).mensaje); this.cargando.set(false); }
    });
  }
  protected enviar(): void {
    if (this.enviando() || this.cargando() || this.errorCarga()) return;
    this.intentado.set(true);
    if (!this.pendiente) {
      if (this.form.invalid) return;
      const v = this.form.getRawValue();
      const lote = this.lotes().find(l => l.id === v.lote);
      const loteInsumo = this.data.tipo === 'insumos' && v.loteInsumo ? v.loteInsumo : null;
      this.pendiente = { uuidCliente: crypto.randomUUID(), cantidad: Number(v.cantidad), tipo: v.tipo,
        motivo: v.motivo!.trim(), origenLote: loteInsumo ? 'INSUMO' : (lote?.origen ?? null), loteId: loteInsumo ?? lote?.id ?? null };
    }
    try {
      this.pendientes.guardar(this.data.tipo, this.data.id, this.pendiente);
    } catch {
      this.error.set('No se envió la salida: el navegador no permite conservar su identificador. Habilita el almacenamiento de esta pestaña y reintenta.');
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    this.api.registrarSalida(this.data.tipo, this.data.id, this.pendiente).subscribe({
      next: r => {
        this.pendientes.resolver(this.data.tipo, this.data.id);
        this.ref.close(r);
      },
      error: e => {
        this.enviando.set(false);
        this.error.set(mapHttpError(e).mensaje);
        // Un rechazo validado no escribió nada. Las respuestas inciertas conservan UUID y datos.
        if ([400, 403, 404, 422].includes(e.status)) {
          this.pendientes.resolver(this.data.tipo, this.data.id);
          this.pendiente = null;
        }
      }
    });
  }
}
