import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { normalizarTelefonoPeru } from '../util/telefono-peru';

const CLAVE = 'ecolacteos.whatsapp.numero';

/**
 * Envío del comprobante por WhatsApp con un enlace `wa.me` (sin cuentas ni API: se abre WhatsApp con el mensaje listo y el vendedor lo envía).
 * El número es configurable: se propone el último que se usó (hoy uno, mañana otro) y, la primera vez, el número ficticio de
 * `environment.whatsappPorDefecto`. Vive en un servicio para que las pruebas lo reemplacen: el entorno de pruebas no puede abrir ventanas.
 */
@Injectable({ providedIn: 'root' })
export class WhatsappService {
  /** Número propuesto (internacional, sin «+»): el último usado en este navegador o, si no hay, el de configuración. */
  numeroPropuesto(): string {
    try {
      const guardado = normalizarTelefonoPeru(localStorage.getItem(CLAVE));
      if (guardado) return guardado;
    } catch {
      // sin almacenamiento disponible (ventana privada o datos bloqueados): se usa el de configuración
    }
    return normalizarTelefonoPeru(environment.whatsappPorDefecto) ?? environment.whatsappPorDefecto;
  }

  /** Recuerda el número para la próxima vez; nunca falla si el navegador no deja guardar. */
  recordar(numero: string): void {
    try {
      localStorage.setItem(CLAVE, numero);
    } catch {
      // se ignora: es solo una comodidad
    }
  }

  /** Enlace de WhatsApp para un número ya normalizado y un texto. */
  enlace(numero: string, mensaje: string): string {
    return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
  }

  /** Abre WhatsApp en otra pestaña con el mensaje listo y recuerda el número. Devuelve false si el navegador bloqueó la ventana. */
  abrir(numero: string, mensaje: string): boolean {
    this.recordar(numero);
    return window.open(this.enlace(numero, mensaje), '_blank', 'noopener') !== null;
  }
}
