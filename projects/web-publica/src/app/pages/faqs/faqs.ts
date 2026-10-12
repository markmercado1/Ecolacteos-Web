import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Pregunta {
  tema: string;
  pregunta: string;
  respuesta: string;
}

/**
 * Preguntas frecuentes. Las respuestas operativas describen el funcionamiento REAL de las reservas del backend (sin pagos en línea,
 * estados, vencimientos, consulta con código y teléfono). No incluyen políticas comerciales (pagos, entregas, devoluciones) porque
 * todavía no están definidas.
 */
const PREGUNTAS: Pregunta[] = [
  { tema: 'Catálogo', pregunta: '¿Cómo sé si un producto está disponible?',
    respuesta: 'Cada presentación muestra su disponibilidad: «Disponible», «Pocas unidades» o «Agotado». La calcula nuestro sistema con el inventario real. Al enviar tu reserva se vuelve a comprobar para la fecha de retiro que elijas.' },
  { tema: 'Catálogo', pregunta: '¿Qué significa «Precio a confirmar»?',
    respuesta: 'Que esa presentación todavía no tiene un precio publicado. Puedes reservarla igual: tu reserva queda pendiente hasta que el personal defina el precio y tú lo aceptes.' },
  { tema: 'Reservas', pregunta: '¿Tengo que pagar para reservar?',
    respuesta: 'No. Esta web no cobra ni procesa pagos: solo registra tu solicitud de reserva.' },
  { tema: 'Reservas', pregunta: '¿Cómo hago una reserva?',
    respuesta: 'Elige los productos en el catálogo y agrégalos a tu reserva, escoge una de las fechas de retiro disponibles, escribe tu nombre y tu celular y envía la solicitud. Recibirás un código de seguimiento.' },
  { tema: 'Reservas', pregunta: '¿Qué fechas de retiro puedo elegir?',
    respuesta: 'Las que muestra el formulario. Dependen de los días de atención, del plazo permitido y del horario de cierre, y se actualizan automáticamente.' },
  { tema: 'Reservas', pregunta: '¿Hay un máximo de unidades o de reservas?',
    respuesta: 'Sí. Hay un máximo de unidades por reserva (se indica en el formulario) y un límite de reservas pendientes por teléfono. Si lo superas, el formulario te lo explicará.' },
  { tema: 'Confirmación', pregunta: '¿Mi reserva queda confirmada al enviarla?',
    respuesta: 'No. Al enviarla queda como «Pendiente de confirmación» y el personal la revisa. Solo está confirmada cuando su estado lo indica al consultarla. Si nadie la atiende antes de la fecha de vencimiento que se te muestra, la solicitud vence y las unidades se liberan.' },
  { tema: 'Confirmación', pregunta: '¿Qué pasa si hay productos con precio a confirmar?',
    respuesta: 'El personal se comunicará con el teléfono que registraste para acordar el precio. La reserva se confirma después de esa aceptación.' },
  { tema: 'Retiro', pregunta: '¿Qué pasa si no retiro mi reserva?',
    respuesta: 'Una reserva confirmada se mantiene hasta el final de la fecha de retiro elegida. Después vence y las unidades vuelven a estar disponibles.' },
  { tema: 'Seguimiento', pregunta: '¿Cómo consulto el estado de mi reserva?',
    respuesta: 'En «Consultar reserva», escribe tu código de seguimiento y el teléfono con el que reservaste. Por seguridad, si los datos no coinciden no mostramos nada.' },
  { tema: 'Seguimiento', pregunta: '¿Puedo modificar o cancelar mi reserva?',
    respuesta: 'Por ahora los cambios y cancelaciones los gestiona el personal. Comunícate con nosotros por los medios de la página de contacto indicando tu código.' }
];

@Component({
  selector: 'pub-faqs',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-title">
      <div class="container">
        <h1>Preguntas frecuentes</h1>
        <p>Respuestas sobre el catálogo, los precios, las reservas, la confirmación, el retiro y la consulta de tu pedido.</p>
      </div>
    </section>

    <section class="section">
      <div class="container angosto">
        @for (p of preguntas; track p.pregunta) {
          <details class="card pregunta">
            <summary>
              <span class="tema">{{ p.tema }}</span>
              {{ p.pregunta }}
            </summary>
            <p>{{ p.respuesta }}</p>
          </details>
        }
        <p class="mas">¿No encontraste lo que buscabas? <a routerLink="/contacto">Mira cómo contactarnos</a>.</p>
      </div>
    </section>
  `,
  styles: `
    .angosto { max-width: 52rem; display: grid; gap: 0.75rem; }
    .pregunta { padding: 0; overflow: hidden; }
    summary { cursor: pointer; padding: 1rem 1.25rem; font-weight: 700; color: var(--color-navy); list-style: none; display: grid; gap: 0.15rem; position: relative; padding-right: 3rem; }
    summary::-webkit-details-marker { display: none; }
    summary::after { content: '+'; position: absolute; right: 1.25rem; top: 50%; transform: translateY(-50%); font-size: 1.5rem; color: var(--color-brand); }
    details[open] summary::after { content: '−'; }
    summary:focus-visible { outline: 3px solid var(--color-focus); outline-offset: -3px; }
    .tema { font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-muted); }
    .pregunta p { margin: 0; padding: 0 1.25rem 1.2rem; color: var(--color-ink); }
    .mas { margin-top: 1rem; text-align: center; }
  `
})
export class FaqsPage {
  protected readonly preguntas = PREGUNTAS;
}
