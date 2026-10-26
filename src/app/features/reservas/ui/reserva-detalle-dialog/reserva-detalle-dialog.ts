import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Observable } from 'rxjs';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/ui/dialog/confirm-dialog';
import { CampoUnicoDialog, CampoUnicoDialogData } from '../../../../shared/ui/dialog/campo-unico-dialog';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { CompradorSelectorComponent } from '../../../clientes/ui/comprador-selector/comprador-selector';
import { CompradorSeleccion } from '../../../clientes/ui/registro-cliente-dialog/registro-cliente-dialog';
import { VentaDetalleDialog } from '../../../ventas/ui/venta-detalle-dialog/venta-detalle-dialog';
import { COLOR_ESTADO, ETIQUETAS_ESTADO, ETIQUETAS_EVENTO, ETIQUETAS_MEDIO } from '../../data-access/reserva.etiquetas';
import { ReservaResponse } from '../../data-access/reserva.models';
import { ReservasApi } from '../../data-access/reservas.api';
import { AceptacionPrecioDialog, AceptacionPrecioDialogData } from '../aceptacion-precio-dialog/aceptacion-precio-dialog';

export interface ReservaDetalleDialogData {
  id: string;
}

/**
 * Detalle de una reserva y sus acciones (VENTAS o ADMIN). Siempre muestra lo que dice el servidor: el panel no decide
 * si una reserva puede confirmarse, solo ofrece las acciones propias de su estado y muestra el motivo si el servidor
 * rechaza una (precio sin aceptar, sin cobertura de stock, estado ya cambiado…). Se cierra con `true` si hubo algún
 * cambio, para que el listado se recargue.
 */
@Component({
  selector: 'app-reserva-detalle-dialog',
  imports: [DatePipe, DecimalPipe, LoadingStateComponent, ErrorStateComponent, CompradorSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <div>
        <h2 id="reserva-detalle-titulo">Reserva {{ reserva()?.codigo ?? '' }}</h2>
        @if (reserva(); as r) {
          <span class="badge" [class]="colorEstado(r)">{{ etiquetaEstado(r) }}</span>
        }
      </div>
      <button type="button" class="close" (click)="cerrar()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="reserva-detalle-titulo">
      @if (cargando()) {
        <ui-loading-state mensaje="Cargando reserva…" />
      } @else if (error()) {
        <ui-error-state [error]="error()" (reintentar)="cargar()" />
      } @else if (reserva(); as r) {
        @if (r.sinCobertura) {
          <p class="aviso aviso-peligro" role="alert">
            <strong>Sin cobertura de inventario.</strong> Las existencias vendibles ya no alcanzan para respaldar esta reserva
            (por ejemplo, tras un ajuste por pérdida). Revisa el inventario; si no se puede cubrir, recházala o cancélala.
          </p>
        }
        @if (r.estado === 'PENDIENTE') {
          <p class="aviso">
            <strong>Pendiente de atención.</strong> Si nadie la atiende, vence el {{ r.expiraEn | date: 'dd/MM/yyyy HH:mm' }}.
          </p>
          @if (r.precioAConfirmar) {
            <p class="aviso aviso-alerta">
              Tiene presentaciones con <strong>precio a confirmar</strong>. Recotiza cuando el precio público esté configurado y
              registra la aceptación del cliente antes de confirmar.
            </p>
          } @else if (r.requiereAceptacion && r.aceptacion.totalAceptado === null) {
            <p class="aviso aviso-alerta">
              El cliente debe <strong>aceptar el importe</strong> antes de confirmar la reserva. Regístralo cuando lo confirme.
            </p>
          }
        }
        @if (r.estado === 'VENCIDA') {
          <p class="aviso aviso-peligro">Reserva vencida: ya no compromete unidades de inventario.</p>
        }

        <dl class="datos">
          <div><dt>Cliente</dt><dd>{{ r.nombreCliente }}</dd></div>
          <div><dt>Teléfono</dt><dd>{{ r.telefono }}</dd></div>
          <div><dt>Correo</dt><dd>{{ r.correo ?? '—' }}</dd></div>
          <div><dt>Fecha de retiro</dt><dd>{{ r.fechaRetiro | date: 'dd/MM/yyyy' }}</dd></div>
          <div><dt>Plazo máximo de retiro</dt><dd>{{ r.fechaMaximaRetiro | date: 'dd/MM/yyyy' }}</dd></div>
          <div><dt>Solicitada</dt><dd>{{ r.creadoEn | date: 'dd/MM/yyyy HH:mm' }}</dd></div>
          <div><dt>Vence (si sigue pendiente)</dt><dd>{{ r.expiraEn | date: 'dd/MM/yyyy HH:mm' }}</dd></div>
          @if (r.notaCliente) { <div class="ancho"><dt>Nota del cliente</dt><dd>{{ r.notaCliente }}</dd></div> }
        </dl>

        <div class="tabla-scroll">
          <table class="tabla-lineas">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Presentación</th>
                <th class="align-end">Cantidad</th>
                <th class="align-end">P. unitario</th>
                <th class="align-end">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              @for (linea of r.lineas; track linea.presentacionId) {
                <tr>
                  <td>{{ linea.producto }}</td>
                  <td>{{ linea.presentacion }} <small>({{ linea.unidadConteo }})</small></td>
                  <td class="align-end">{{ linea.cantidad }}</td>
                  <td class="align-end">
                    @if (linea.precioUnitario === null) { <span class="a-confirmar">A confirmar</span> }
                    @else { S/ {{ linea.precioUnitario | number: '1.2-2' }} }
                  </td>
                  <td class="align-end">
                    @if (linea.subtotal === null) { <span class="a-confirmar">—</span> }
                    @else { S/ {{ linea.subtotal | number: '1.2-2' }} }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="total">
          @if (r.total === null) { Total: <span class="a-confirmar">a confirmar</span> (hay presentaciones sin precio) }
          @else { Total: S/ {{ r.total | number: '1.2-2' }} }
        </p>

        <section class="bloque" aria-label="Comprador" data-testid="comprador-reserva">
          <h3>Comprador</h3>
          @if (r.comprador; as c) {
            <p><strong>{{ c.nombre }}</strong> · {{ c.tipo === 'PROVEEDOR' ? 'Proveedor' : 'Cliente' }} (confirmado). Al retirar, la venta queda a su nombre.
              @if (editableComprador(r)) { <button type="button" class="row-link" [disabled]="ocupado()" (click)="quitarComprador(r)">Quitar</button> }</p>
          } @else {
            <p class="nota">Sin comprador confirmado: al retirar, la venta guarda solo el nombre de la reserva y no se crea ninguna ficha.</p>
            @if (editableComprador(r)) {
              @if (buscandoComprador()) {
                <app-comprador-selector [inicial]="r.telefono" [permitirVarios]="false"
                  [datosRegistro]="{ nombre: r.nombreCliente, telefono: r.telefono, correo: r.correo }"
                  (elegido)="vincular(r, $event)" />
              } @else {
                <button type="button" class="btn small" (click)="buscandoComprador.set(true)">Identificar comprador</button>
              }
            }
          }
        </section>

        @if (r.aceptacion.totalAceptado !== null) {
          <section class="bloque" aria-label="Aceptación del cliente">
            <h3>Aceptación del cliente</h3>
            <p>
              Aceptó <strong>S/ {{ r.aceptacion.totalAceptado | number: '1.2-2' }}</strong>
              @if (r.aceptacion.medio) { por {{ etiquetaMedio(r.aceptacion.medio) }} }
              el {{ r.aceptacion.aceptadoEn | date: 'dd/MM/yyyy HH:mm' }}
              @if (r.aceptacion.registradoPor) { · registrado por {{ r.aceptacion.registradoPor }} }
              @if (r.aceptacion.nota) { <br><small>{{ r.aceptacion.nota }}</small> }
            </p>
          </section>
        }

        @if (r.ventaId) {
          <section class="bloque" aria-label="Venta del retiro">
            <h3>Venta del retiro</h3>
            <p>El retiro generó una venta real (inventario y kardex ya descontados).
              <button type="button" class="row-link" (click)="verVenta(r.ventaId)">Ver venta</button></p>
          </section>
        }

        <section class="bloque" aria-label="Historial">
          <h3>Historial</h3>
          <ol class="historial">
            @for (e of r.eventos; track $index) {
              <li>
                <strong>{{ etiquetaEvento(e.tipo) }}</strong>
                <span class="meta">{{ e.creadoEn | date: 'dd/MM/yyyy HH:mm' }}@if (e.usuario) { · {{ e.usuario }} }</span>
                @if (e.motivo) { <span class="motivo">«{{ e.motivo }}»</span> }
              </li>
            }
          </ol>
        </section>
      }
      @if (errorAccion()) { <p class="aviso aviso-peligro" role="alert">{{ errorAccion() }}</p> }
    </div>
    @if (reserva(); as r) {
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="cerrar()">Cerrar</button>
        @if (r.estado === 'PENDIENTE') {
          <button type="button" class="btn" [disabled]="ocupado()" (click)="recotizar(r)">Recotizar precios</button>
          @if (r.requiereAceptacion && r.aceptacion.totalAceptado === null) {
            <button type="button" class="btn" [disabled]="ocupado() || r.precioAConfirmar" [attr.title]="r.precioAConfirmar ? 'Primero recotiza para fijar los precios' : null" (click)="registrarAceptacion(r)">Registrar aceptación</button>
          }
          <button type="button" class="btn danger" [disabled]="ocupado()" (click)="rechazar(r)">Rechazar</button>
          <button type="button" class="btn primary" [disabled]="ocupado()" (click)="confirmar(r)">
            {{ ocupado() ? 'Procesando…' : 'Confirmar reserva' }}
          </button>
        }
        @if (r.estado === 'CONFIRMADA') {
          <button type="button" class="btn danger" [disabled]="ocupado()" (click)="cancelar(r)">Cancelar reserva</button>
          <button type="button" class="btn primary" [disabled]="ocupado()" (click)="retirar(r)">
            {{ ocupado() ? 'Procesando…' : 'Registrar retiro' }}
          </button>
        }
      </div>
    }
  `,
  styles: `
    /* ancho FIJO con tope (no porcentual): con textos largos el panel del overlay se estiraba y la tarjeta quedaba a la izquierda */
    :host {
      display: block; width: 46rem; max-width: calc(100vw - 2rem); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; gap: var(--space-3); }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0 0 var(--space-2); }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .aviso { background: var(--color-surface-soft); border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); line-height: 1.5; }
    .aviso-alerta { background: var(--color-warning-bg); color: var(--color-warning); border-color: transparent; }
    .aviso-peligro { background: var(--color-danger-bg); color: var(--color-danger); border-color: transparent; }
    dl.datos { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3) var(--space-4); margin: 0 0 var(--space-4); }
    dl.datos .ancho { grid-column: 1 / -1; }
    dt { color: var(--color-text-muted); font-size: 0.75rem; }
    dd { margin: 0.2rem 0 0; font-weight: 600; overflow-wrap: anywhere; }
    .tabla-scroll { overflow-x: auto; }
    .tabla-lineas { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
    .tabla-lineas th, .tabla-lineas td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--color-border); }
    .tabla-lineas th.align-end, .tabla-lineas td.align-end { text-align: right; }
    .tabla-lineas small { color: var(--color-text-muted); }
    .a-confirmar { color: var(--color-warning); font-weight: 700; }
    .total { font-weight: 700; margin: var(--space-3) 0; text-align: right; }
    .bloque { border-top: 1px solid var(--color-border); padding-top: var(--space-3); margin-top: var(--space-3); }
    .bloque h3 { font-size: var(--font-size-sm); margin: 0 0 var(--space-2); }
    .bloque p { margin: 0; font-size: var(--font-size-sm); }
    .bloque small { color: var(--color-text-muted); }
    .historial { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); font-size: var(--font-size-sm); }
    .historial li { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-3); align-items: baseline; }
    .historial .meta { color: var(--color-text-muted); font-size: 0.75rem; }
    .historial .motivo { flex-basis: 100%; color: var(--color-text); font-style: italic; }
    .dialog-foot { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: var(--space-2); padding: 0 var(--space-6) var(--space-6); }
    @media (max-width: 600px) { dl.datos { grid-template-columns: 1fr 1fr; } }
  `
})
export class ReservaDetalleDialog {
  protected readonly dialogRef = inject(DialogRef<boolean>);
  protected readonly data = inject<ReservaDetalleDialogData>(DIALOG_DATA);
  private readonly api = inject(ReservasApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly reserva = signal<ReservaResponse | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly errorAccion = signal<string | null>(null);
  private huboCambios = false;
  /** Clave de idempotencia del retiro: una sola por apertura del detalle, conservada en los reintentos tras un fallo de red. */
  private readonly uuidRetiro = crypto.randomUUID();

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.obtener(this.data.id).subscribe({
      next: (reserva) => {
        this.reserva.set(reserva);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(mapHttpError(error));
        this.cargando.set(false);
      }
    });
  }

  protected cerrar(): void {
    this.dialogRef.close(this.huboCambios);
  }

  protected etiquetaEstado(r: ReservaResponse): string {
    return ETIQUETAS_ESTADO[r.estado];
  }
  protected colorEstado(r: ReservaResponse): string {
    return COLOR_ESTADO[r.estado];
  }
  protected etiquetaEvento(tipo: keyof typeof ETIQUETAS_EVENTO): string {
    return ETIQUETAS_EVENTO[tipo];
  }
  protected etiquetaMedio(medio: keyof typeof ETIQUETAS_MEDIO): string {
    return ETIQUETAS_MEDIO[medio];
  }

  /** Fase H: el comprador se confirma o se quita solo mientras la reserva está pendiente o confirmada. */
  protected readonly buscandoComprador = signal(false);

  protected editableComprador(r: ReservaResponse): boolean {
    return r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA';
  }

  protected vincular(r: ReservaResponse, c: CompradorSeleccion | null): void {
    if (!c) return;
    this.buscandoComprador.set(false);
    this.ejecutar(this.api.vincularComprador(r.id, { tipo: c.tipo, id: c.id }), `Comprador confirmado: ${c.nombre}.`);
  }

  protected quitarComprador(r: ReservaResponse): void {
    this.ejecutar(this.api.desvincularComprador(r.id), 'Comprador quitado de la reserva.');
  }

  protected verVenta(ventaId: string): void {
    this.dialog.open(VentaDetalleDialog, { ariaLabel: 'Detalle de venta', data: { id: ventaId } });
  }

  // ---------------------------------------------------------------- acciones (todas las valida el servidor)

  protected recotizar(r: ReservaResponse): void {
    this.pedirConfirmacion(
      {
        titulo: 'Recotizar precios',
        mensaje: `Se volverán a cotizar todas las líneas de ${r.codigo} con el precio público vigente hoy. `
          + 'Si algún importe cambia, el cliente tendrá que aceptarlo de nuevo.',
        etiquetaConfirmar: 'Recotizar'
      },
      () => this.ejecutar(this.api.recotizar(r.id), 'Precios recotizados con el precio público vigente.')
    );
  }

  protected registrarAceptacion(r: ReservaResponse): void {
    const ref = this.dialog.open<ReservaResponse | undefined>(AceptacionPrecioDialog, {
      ariaLabel: 'Registrar aceptación del cliente',
      data: { reservaId: r.id, codigo: r.codigo, total: r.total } satisfies AceptacionPrecioDialogData
    });
    ref.closed.subscribe((actualizada) => {
      if (!actualizada) return;
      this.aplicar(actualizada);
      this.toast.exito(`Aceptación del cliente registrada en ${actualizada.codigo}.`);
    });
  }

  protected confirmar(r: ReservaResponse): void {
    this.pedirConfirmacion(
      {
        titulo: 'Confirmar reserva',
        mensaje: `Se confirmará la reserva ${r.codigo} de ${r.nombreCliente}. Las unidades quedan separadas hasta el fin de la fecha de retiro. `
          + 'Confirmar no genera una venta ni mueve el inventario: la venta se registra al retirar.',
        etiquetaConfirmar: 'Confirmar reserva'
      },
      () => this.ejecutar(this.api.confirmar(r.id), `Reserva ${r.codigo} confirmada.`)
    );
  }

  protected rechazar(r: ReservaResponse): void {
    this.pedirMotivo(
      `Rechazar reserva ${r.codigo}`,
      'Motivo del rechazo',
      'Se informará este motivo en el historial. Las unidades quedan libres.',
      'Rechazar reserva',
      (motivo) => this.api.rechazar(r.id, motivo),
      `Reserva ${r.codigo} rechazada.`
    );
  }

  protected cancelar(r: ReservaResponse): void {
    this.pedirMotivo(
      `Cancelar reserva ${r.codigo}`,
      'Motivo de la cancelación',
      'Quedará en el historial. Las unidades separadas vuelven a estar libres.',
      'Cancelar reserva',
      (motivo) => this.api.cancelar(r.id, motivo),
      `Reserva ${r.codigo} cancelada.`
    );
  }

  protected retirar(r: ReservaResponse): void {
    this.pedirConfirmacion(
      {
        titulo: 'Registrar retiro',
        mensaje: `Se registrará la entrega de ${r.codigo} a ${r.nombreCliente}: se crea la venta real, se descuenta el inventario `
          + '(primero lo que vence antes) y se registra en el kardex. No se puede deshacer desde aquí.',
        etiquetaConfirmar: 'Registrar retiro'
      },
      () => {
        this.iniciar();
        this.api.retirar(r.id, this.uuidRetiro).subscribe({
          next: (venta) => {
            this.toast.exito(`Retiro registrado. Venta por S/ ${venta.total.toFixed(2)}.`);
            this.huboCambios = true;
            this.refrescar();
          },
          error: (error) => this.fallar(error)
        });
      }
    );
  }

  // ---------------------------------------------------------------- utilidades

  private pedirConfirmacion(datos: ConfirmDialogData, accion: () => void): void {
    this.dialog.open<boolean>(ConfirmDialog, { ariaLabel: datos.titulo, data: datos }).closed.subscribe((acepto) => {
      if (acepto) accion();
    });
  }

  private pedirMotivo(
    titulo: string, etiquetaCampo: string, ayuda: string, etiquetaGuardar: string,
    llamada: (motivo: string) => Observable<ReservaResponse>, mensajeExito: string
  ): void {
    const data: CampoUnicoDialogData = {
      titulo, etiquetaCampo, ayuda, etiquetaGuardar, valorInicial: '',
      guardar: (motivo) => llamada(motivo.trim())
    };
    this.dialog.open<ReservaResponse | undefined>(CampoUnicoDialog, { ariaLabel: titulo, data }).closed.subscribe((actualizada) => {
      if (!actualizada) return;
      this.errorAccion.set(null);
      this.aplicar(actualizada);
      this.toast.exito(mensajeExito);
    });
  }

  private ejecutar(llamada: Observable<ReservaResponse>, mensajeExito: string): void {
    this.iniciar();
    llamada.subscribe({
      next: (actualizada) => {
        this.aplicar(actualizada);
        this.toast.exito(mensajeExito);
        this.ocupado.set(false);
      },
      error: (error) => this.fallar(error)
    });
  }

  private iniciar(): void {
    this.ocupado.set(true);
    this.errorAccion.set(null);
  }

  private fallar(error: unknown): void {
    this.errorAccion.set(mapHttpError(error).mensaje);
    this.ocupado.set(false);
    // El estado pudo cambiar en otra sesión (por ejemplo, otra persona ya la atendió): se refresca para no actuar sobre datos viejos.
    this.api.obtener(this.data.id).subscribe({ next: (r) => this.reserva.set(r), error: () => undefined });
  }

  private aplicar(reserva: ReservaResponse): void {
    this.reserva.set(reserva);
    this.huboCambios = true;
  }

  private refrescar(): void {
    this.api.obtener(this.data.id).subscribe({
      next: (r) => {
        this.reserva.set(r);
        this.ocupado.set(false);
      },
      error: (error) => {
        this.errorAccion.set(mapHttpError(error).mensaje);
        this.ocupado.set(false);
      }
    });
  }
}
