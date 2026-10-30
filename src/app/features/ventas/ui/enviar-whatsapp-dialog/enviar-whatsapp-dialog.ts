import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { VentaResumenResponse } from '../../data-access/venta.models';
import { WhatsappService } from '../../data-access/whatsapp.service';
import { mensajeComprobante } from '../../util/mensaje-whatsapp';
import { formatearTelefonoPeru, normalizarTelefonoPeru } from '../../util/telefono-peru';

export interface EnviarWhatsappDialogData {
  venta: VentaResumenResponse;
}

/**
 * Enviar el comprobante por WhatsApp. El número es configurable: se propone el último usado (o el ficticio de configuración la primera vez) y
 * se puede cambiar en cada envío. Abre WhatsApp (`wa.me`) con el mensaje listo; el PDF no viaja en el enlace, así que se adjunta aparte con
 * «Descargar PDF». Se valida que sea un móvil peruano (9 dígitos que empiezan con 9, con o sin +51).
 */
@Component({
  selector: 'app-enviar-whatsapp-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="whatsapp-titulo">Enviar por WhatsApp</h2>
      <button type="button" class="close" (click)="dialogRef.close(false)" aria-label="Cerrar">×</button>
    </div>
    <form class="dialog-body" aria-labelledby="whatsapp-titulo" (submit)="$event.preventDefault(); enviar()">
      <p class="resumen">{{ venta.comprobante ?? 'Venta' }} · S/ {{ venta.total.toFixed(2) }}</p>

      <div class="field" [class.has-error]="mostrarError()">
        <label for="wa-numero">Número de WhatsApp</label>
        <input id="wa-numero" name="numero" type="tel" inputmode="tel" autocomplete="off" placeholder="+51 900 000 000"
               [value]="numero()" (input)="numero.set($any($event.target).value)"
               [attr.aria-invalid]="mostrarError() ? 'true' : null" [attr.aria-describedby]="mostrarError() ? 'wa-numero-error' : 'wa-numero-ayuda'">
        @if (mostrarError()) {
          <span class="error" id="wa-numero-error" data-testid="numero-error">Escribe un móvil peruano: 9 dígitos que empiecen con 9 (con o sin +51).</span>
        } @else {
          <span class="hint" id="wa-numero-ayuda" data-testid="numero-ayuda">
            @if (normalizado(); as n) { Se enviará a {{ formatear(n) }}. } @else { Se recordará para el próximo envío. }
          </span>
        }
      </div>

      <div class="field">
        <label for="wa-mensaje">Mensaje</label>
        <textarea id="wa-mensaje" name="mensaje" rows="8" [value]="mensaje()" (input)="mensaje.set($any($event.target).value)"></textarea>
      </div>

      <p class="aviso">WhatsApp se abre con el mensaje listo. El PDF no viaja en el enlace: descárgalo y adjúntalo en la conversación.</p>

      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close(false)">Cancelar</button>
        <button type="submit" class="btn primary" data-testid="abrir-whatsapp">Abrir WhatsApp</button>
      </div>
    </form>
  `,
  styles: `
    :host { display: block; width: min(30rem, 100%); background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto; }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6) var(--space-6); }
    .resumen { margin: 0 0 var(--space-4); font-weight: 700; color: var(--color-primary); }
    textarea { width: 100%; resize: vertical; font-family: inherit; }
    .aviso { margin: 0 0 var(--space-4); font-size: var(--font-size-sm); color: var(--color-text-muted); }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); }
  `
})
export class EnviarWhatsappDialog {
  protected readonly dialogRef = inject(DialogRef<boolean>);
  protected readonly venta = inject<EnviarWhatsappDialogData>(DIALOG_DATA).venta;
  private readonly whatsapp = inject(WhatsappService);
  private readonly toast = inject(ToastService);

  protected readonly numero = signal(formatearTelefonoPeru(this.whatsapp.numeroPropuesto()));
  protected readonly mensaje = signal(mensajeComprobante(this.venta));
  /** El error solo se muestra tras intentar enviar: no mientras se está tecleando el primer dígito. */
  private readonly intentado = signal(false);

  protected readonly normalizado = computed(() => normalizarTelefonoPeru(this.numero()));
  protected readonly mostrarError = computed(() => this.intentado() && !this.normalizado());

  protected formatear = formatearTelefonoPeru;

  protected enviar(): void {
    this.intentado.set(true);
    const numero = this.normalizado();
    if (!numero) return;
    if (!this.whatsapp.abrir(numero, this.mensaje())) {
      this.toast.error('El navegador bloqueó la ventana de WhatsApp. Permite las ventanas emergentes e inténtalo de nuevo.');
      return;
    }
    this.dialogRef.close(true);
  }
}
