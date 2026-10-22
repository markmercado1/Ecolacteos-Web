/**
 * Configuración centralizada del sitio: TODO lo que es contenido de la empresa vive aquí.
 *
 * - Los valores vacíos ('') se OCULTAN en la web (no se muestra ningún dato inventado): rellena solo lo que sea real.
 * - Los textos marcados «PROVISIONAL» son redacción comercial neutral para dar estructura al sitio; solo afirman lo que el
 *   sistema hace de verdad (catálogo con disponibilidad, reservas sin pago en línea, consulta con código). Sustitúyelos por
 *   los textos oficiales cuando existan; no hace falta tocar ningún componente.
 */
export interface Sitio {
  nombre: string;
  /** Línea corta bajo el nombre (aparece en el pie y en metadatos). */
  descripcionCorta: string;
  portada: { etiqueta: string; titulo: string; subtitulo: string };
  /** PROVISIONAL */
  quienesSomos: { titulo: string; introduccion: string[]; pilares: { titulo: string; texto: string }[] };
  contacto: {
    telefono: string;
    /** Solo dígitos con código de país, p. ej. 51999999999. Vacío = el botón flotante y los enlaces de WhatsApp no se muestran. */
    whatsapp: string;
    correo: string;
    direccion: string;
    referencia: string;
    horario: string;
    /** Enlace de Google Maps de la ubicación real (https://maps.app.goo.gl/… o https://www.google.com/maps/…). */
    mapaUrl: string;
    /** URL de incrustación del mapa (https://www.google.com/maps?q=…&output=embed). Vacío = no se muestra el mapa, solo el botón «Cómo llegar». */
    mapaEmbedUrl: string;
    redes: { facebook: string; instagram: string; tiktok: string; youtube: string };
  };
}

export const SITIO: Sitio = {
  nombre: 'EcoLácteos Huata',
  descripcionCorta: 'Catálogo, disponibilidad y reservas en línea de nuestros productos lácteos.',

  portada: {
    etiqueta: 'Reserva en línea · Retiro en la fecha que elijas',
    titulo: 'Tus lácteos de EcoLácteos Huata, reservados y listos para retirar',
    subtitulo:
      'Mira lo que hay disponible hoy, elige la fecha de retiro y sigue tu reserva con un código. Sin pagos en línea.'
  },

  // PROVISIONAL
  quienesSomos: {
    titulo: 'Quiénes somos',
    introduccion: [
      'EcoLácteos Huata es una empresa de productos lácteos. Esta web reúne en un solo lugar nuestro catálogo, la disponibilidad actualizada de cada producto y la posibilidad de reservarlo para retirarlo cuando te convenga.',
      'Queremos que reservar sea simple y transparente: ves qué hay disponible, conoces el precio o te lo confirmamos antes de avanzar, y puedes consultar el estado de tu reserva en cualquier momento.'
    ],
    pilares: [
      {
        titulo: 'Disponibilidad al día',
        texto: 'La disponibilidad que ves la calcula nuestro sistema con el inventario real, no es una cifra aproximada.'
      },
      {
        titulo: 'Precios claros',
        texto: 'Cuando un producto aún no tiene precio publicado, te lo indicamos como «Precio a confirmar» y lo acordamos contigo antes de confirmar la reserva.'
      },
      {
        titulo: 'Seguimiento con tu código',
        texto: 'Cada reserva recibe un código de seguimiento. Con él y tu teléfono puedes consultar su estado cuando quieras.'
      }
    ]
  },

  contacto: {
    telefono: '',
    whatsapp: '',
    correo: '',
    direccion: '',
    referencia: '',
    horario: '',
    mapaUrl: 'https://maps.app.goo.gl/kbGYGuQX4PpEGZ7w8',
    // Lugar «Huata» (-15.6149462, -69.9719035) según el enlace anterior; afínalo con el punto exacto del local si hace falta.
    mapaEmbedUrl: 'https://www.google.com/maps?q=-15.6149462,-69.9719035&z=16&hl=es&output=embed',
    redes: { facebook: '', instagram: '', tiktok: '', youtube: '' }
  }
};

/** ¿Hay al menos un dato de contacto real configurado? */
export function hayDatosDeContacto(c: Sitio['contacto'] = SITIO.contacto): boolean {
  return !!(c.telefono || c.whatsapp || c.correo || c.direccion || c.horario || c.mapaUrl);
}

/** Enlace wa.me con mensaje opcional, o null si no hay WhatsApp configurado. */
export function enlaceWhatsapp(mensaje = '', c: Sitio['contacto'] = SITIO.contacto): string | null {
  const numero = c.whatsapp.replace(/\D/g, '');
  if (!numero) return null;
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`;
}
