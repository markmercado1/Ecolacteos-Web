import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { enlaceWhatsapp } from '../../config/sitio.config';
import { ErrorAmigable, errorAmigable } from '../../core/api/http-error';
import { EstadoReserva, ReservaPublica } from '../../core/api/reservas.models';
import { ReservasPublicasApi } from '../../core/api/reservas.api';
import { ETIQUETA_ESTADO, fechaTitulo, formatearFecha, formatearFechaHora, formatearPrecio } from '../../shared/formato';
import { telefonoValido } from '../reservar/reservar';

const BADGE: Record<EstadoReserva, string> = {
  PENDIENTE: 'badge-warn',
  CONFIRMADA: '',
  RETIRADA: 'badge-info',
  RECHAZADA: 'badge-danger',
  CANCELADA: 'badge-off',
  VENCIDA: 'badge-off'
};

/**
 * Consulta de UNA reserva con su código y el teléfono (POST /catalogo/reservas/consulta). Muestra solo lo que el servidor autoriza:
 * estado, productos, fecha de retiro y precios. El motivo de un rechazo o cancelación no lo expone el backend público.
 */
@Component({
  selector: 'pub-consultar',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-title">
      <div class="container">
        <h1>Consultar mi reserva</h1>
        <p>Escribe el código de seguimiento que recibiste al reservar y el teléfono con el que la hiciste.</p>
      </div>
    </section>

    <section class="section">
      <div class="container cuerpo">
        <form class="card card-pad" [formGroup]="form" (ngSubmit)="consultar()" novalidate>
          <div class="field" [class.invalid]="invalido('codigo')">
            <label for="codigo">Código de seguimiento</label>
            <input id="codigo" type="text" formControlName="codigo" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" class="codigo-input"
                   [attr.aria-invalid]="invalido('codigo')">
            @if (invalido('codigo')) { <span class="error" role="alert">Escribe tu código de seguimiento.</span> }
          </div>
          <div class="field" [class.invalid]="invalido('telefono')">
            <label for="tel">Teléfono de la reserva</label>
            <input id="tel" type="tel" formControlName="telefono" autocomplete="tel" inputmode="tel" maxlength="30" placeholder="987 654 321" [attr.aria-invalid]="invalido('telefono')">
            @if (invalido('telefono')) { <span class="error" role="alert">Escribe un celular de 9 dígitos que empiece con 9 (con o sin +51).</span> }
          </div>
          @if (error(); as e) {
            <p class="alert alert-error" role="alert">{{ e.mensaje }}</p>
          }
          <button type="submit" class="btn btn-block" [disabled]="consultando()">{{ consultando() ? 'Consultando…' : 'Consultar reserva' }}</button>
        </form>

        @if (reserva(); as r) {
          <article class="card card-pad resultado" aria-live="polite" aria-labelledby="h-res">
            <h2 id="h-res">Reserva <span class="cod">{{ r.codigo }}</span></h2>
            <p><span class="badge" [class]="badge(r.estado)">{{ etiqueta(r.estado) }}</span></p>
            <p class="explicacion">{{ explicacion(r) }}</p>
            @if (r.estado === 'PENDIENTE' && r.precioAConfirmar) {
              <p class="alert alert-warn">Tu reserva incluye productos con <strong>precio a confirmar</strong>. El personal se comunicará contigo para acordarlo antes de confirmar.</p>
            }
            <dl>
              <div><dt>Fecha de retiro</dt><dd>{{ fecha(r.fechaRetiro) }}</dd></div>
              @if (r.estado === 'PENDIENTE') { <div><dt>Vence si no es atendida</dt><dd>{{ fechaHora(r.expiraEn) }}</dd></div> }
            </dl>
            <div class="tabla-scroll">
              <table class="tabla">
                <thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Subtotal</th></tr></thead>
                <tbody>
                  @for (l of r.lineas; track l.presentacionId) {
                    <tr>
                      <td>{{ l.producto }} <span class="muted small">· {{ l.presentacion }}</span></td>
                      <td class="num">{{ l.cantidad }}</td>
                      <td class="num">@if (l.precioUnitario !== null) { {{ precio(l.precioUnitario) }} } @else { <span class="por-confirmar">A confirmar</span> }</td>
                      <td class="num">@if (l.subtotal !== null) { {{ precio(l.subtotal) }} } @else { — }</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="total">@if (r.total !== null) { Total: <strong>{{ precio(r.total) }}</strong> } @else { Total: <strong class="por-confirmar">por confirmar</strong> }</p>
            @if (esFinal(r.estado)) {
              <div class="botones">
                <a class="btn btn-outline" routerLink="/catalogo">Hacer una nueva reserva</a>
                @if (whatsapp(); as wa) { <a class="btn btn-outline" [href]="wa" target="_blank" rel="noopener noreferrer">Escribirnos por WhatsApp</a> }
              </div>
            }
          </article>
        }
      </div>
    </section>
  `,
  styles: `
    .cuerpo { display: grid; grid-template-columns: minmax(0, 24rem) minmax(0, 1fr); gap: 1.5rem; align-items: start; }
    @media (max-width: 900px) { .cuerpo { grid-template-columns: 1fr; } }
    .codigo-input { font-family: ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; }
    .cod { font-family: ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.12em; }
    .resultado h2 { font-size: 1.4rem; margin-bottom: 0.5rem; }
    .explicacion { font-size: 1.05rem; }
    dl { margin: 0 0 1rem; display: grid; gap: 0.5rem; }
    dl div { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    dt { color: var(--color-muted); }
    dd { margin: 0; font-weight: 700; }
    .tabla-scroll { overflow-x: auto; }
    .tabla { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
    .tabla th, .tabla td { padding: 0.55rem 0.5rem; border-bottom: 1px solid var(--color-line); text-align: left; }
    .tabla .num { text-align: right; white-space: nowrap; }
    .por-confirmar { color: var(--color-warn-ink); font-weight: 700; }
    .total { font-size: 1.1rem; margin: 0.9rem 0 0; }
    .botones { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem; }
  `
})
export class ConsultarPage implements OnInit {
  /** `?codigo=` (por ejemplo desde la confirmación de la reserva). El teléfono nunca viaja en la URL. */
  readonly codigo = input<string>();

  private readonly api = inject(ReservasPublicasApi);
  private readonly fb = inject(FormBuilder);

  protected readonly consultando = signal(false);
  protected readonly intentado = signal(false);
  protected readonly error = signal<ErrorAmigable | null>(null);
  protected readonly reserva = signal<ReservaPublica | null>(null);
  protected readonly whatsapp = computed(() => enlaceWhatsapp('Hola, tengo una consulta sobre mi reserva.'));

  protected readonly form = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.maxLength(12), (c: { value: unknown }) => (String(c.value ?? '').trim() ? null : { required: true })]],
    telefono: ['', [Validators.required, Validators.maxLength(30), telefonoValido]]
  });

  ngOnInit(): void {
    const previo = this.codigo()?.trim().toUpperCase();
    if (previo) this.form.controls.codigo.setValue(previo.slice(0, 12));
  }

  protected badge = (e: EstadoReserva) => BADGE[e];
  protected etiqueta = (e: EstadoReserva) => ETIQUETA_ESTADO[e];
  protected fecha = (iso: string) => fechaTitulo(iso, true);
  protected fechaHora = formatearFechaHora;
  protected precio = formatearPrecio;
  protected esFinal = (e: EstadoReserva) => e === 'RECHAZADA' || e === 'CANCELADA' || e === 'VENCIDA' || e === 'RETIRADA';

  protected invalido(nombre: 'codigo' | 'telefono'): boolean {
    const c = this.form.controls[nombre];
    return c.invalid && (c.touched || this.intentado());
  }

  /** Explicación para el cliente según el estado que informa el servidor. */
  protected explicacion(r: ReservaPublica): string {
    switch (r.estado) {
      case 'PENDIENTE':
        return `Recibimos tu solicitud y está pendiente de confirmación: el personal la revisará. Todavía no está confirmada. Si no es atendida antes del ${formatearFechaHora(r.expiraEn)}, vence.`;
      case 'CONFIRMADA':
        return `¡Tu reserva está confirmada! Puedes retirar tus productos el ${formatearFecha(r.fechaRetiro)}. Las unidades quedan separadas hasta el final de ese día.`;
      case 'RETIRADA':
        return 'Esta reserva ya fue retirada. ¡Gracias por tu compra!';
      case 'RECHAZADA':
        return 'No pudimos aceptar esta reserva. No se realizó ningún cobro. Puedes hacer una nueva solicitud o contactarnos.';
      case 'CANCELADA':
        return 'Esta reserva fue cancelada. No se realizó ningún cobro. Puedes hacer una nueva solicitud cuando quieras.';
      case 'VENCIDA':
        return 'Esta reserva venció y las unidades fueron liberadas. Puedes hacer una nueva solicitud cuando quieras.';
    }
  }

  protected consultar(): void {
    if (this.consultando()) return;
    this.intentado.set(true);
    this.error.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { codigo, telefono } = this.form.getRawValue();
    this.consultando.set(true);
    this.reserva.set(null);
    this.api.consultar({ codigo: codigo.trim().toUpperCase(), telefono: telefono.trim() }).subscribe({
      next: (r) => {
        this.reserva.set(r);
        this.consultando.set(false);
      },
      error: (e) => {
        const err = errorAmigable(e);
        this.error.set(
          err.status === 404
            ? { ...err, mensaje: 'No encontramos una reserva con ese código y teléfono. Revisa que estén bien escritos (el teléfono debe ser el que usaste al reservar).' }
            : err
        );
        this.consultando.set(false);
      }
    });
  }
}
