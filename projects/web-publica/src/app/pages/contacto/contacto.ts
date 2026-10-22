import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITIO, enlaceWhatsapp, hayDatosDeContacto } from '../../config/sitio.config';
import { MapaUbicacion } from '../../shared/mapa-ubicacion';

/**
 * Contacto y ubicación. Cada dato aparece SOLO si está configurado en config/sitio.config.ts: nada se inventa ni se muestra vacío.
 * Las reservas en línea siempre están disponibles como canal.
 */
@Component({
  selector: 'pub-contacto',
  imports: [RouterLink, MapaUbicacion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-title">
      <div class="container">
        <h1>Contacto y ubicación</h1>
        <p>Estas son las formas de comunicarte con {{ c.nombre }}.</p>
      </div>
    </section>

    <section class="section">
      <div class="container grilla">
        @if (c.contacto.whatsapp) {
          <article class="card card-pad">
            <h2>WhatsApp</h2>
            <p>Escríbenos y te respondemos en nuestro horario de atención.</p>
            <a class="btn" [href]="whatsapp" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
          </article>
        }
        @if (c.contacto.telefono) {
          <article class="card card-pad">
            <h2>Teléfono</h2>
            <p><a [href]="'tel:' + c.contacto.telefono" class="dato">{{ c.contacto.telefono }}</a></p>
          </article>
        }
        @if (c.contacto.correo) {
          <article class="card card-pad">
            <h2>Correo electrónico</h2>
            <p><a [href]="'mailto:' + c.contacto.correo" class="dato">{{ c.contacto.correo }}</a></p>
          </article>
        }
        @if (c.contacto.direccion || c.contacto.mapaUrl) {
          <article class="card card-pad ubicacion" [class.con-mapa]="c.contacto.mapaEmbedUrl">
            <h2>Dónde encontrarnos</h2>
            @if (c.contacto.direccion) { <p>{{ c.contacto.direccion }}</p> }
            @if (c.contacto.referencia) { <p class="muted">{{ c.contacto.referencia }}</p> }
            @if (c.contacto.mapaUrl) { <a class="btn btn-outline btn-sm" [href]="c.contacto.mapaUrl" target="_blank" rel="noopener noreferrer">Cómo llegar (Google Maps)</a> }
            @if (c.contacto.mapaEmbedUrl) {
              <pub-mapa-ubicacion class="mapa" [embedUrl]="c.contacto.mapaEmbedUrl" [titulo]="'Mapa de la ubicación de ' + c.nombre" />
            }
          </article>
        }
        @if (c.contacto.horario) {
          <article class="card card-pad">
            <h2>Horario de atención</h2>
            <p>{{ c.contacto.horario }}</p>
          </article>
        }
        <article class="card card-pad destacado">
          <h2>Reservas en línea</h2>
          <p>Elige tus productos, la fecha de retiro y recibe un código de seguimiento. Consulta el estado de tu reserva cuando quieras.</p>
          <div class="botones">
            <a routerLink="/reservar" class="btn btn-sm">Reservar productos</a>
            <a routerLink="/consultar-reserva" class="btn btn-sm btn-outline">Consultar mi reserva</a>
          </div>
        </article>
        @if (!hayContacto) {
          <article class="card card-pad">
            <h2>Preguntas frecuentes</h2>
            <p>Resolvemos las dudas más habituales sobre el catálogo, los precios y las reservas.</p>
            <a routerLink="/preguntas-frecuentes" class="btn btn-sm btn-outline">Ver preguntas frecuentes</a>
          </article>
        }
      </div>
    </section>
  `,
  styles: `
    .grilla { display: grid; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); gap: 1.25rem; }
    h2 { font-size: 1.2rem; }
    .dato { font-weight: 700; font-size: 1.1rem; }
    .destacado { background: var(--color-sage-soft); }
    .botones { display: flex; gap: 0.6rem; flex-wrap: wrap; }
    article p:last-child { margin-bottom: 0; }
    .ubicacion.con-mapa { grid-column: 1 / -1; }
    .mapa { display: block; margin-top: 1rem; }
  `
})
export class ContactoPage {
  protected readonly c = SITIO;
  protected readonly hayContacto = hayDatosDeContacto();
  protected readonly whatsapp = enlaceWhatsapp('Hola, quisiera información sobre sus productos.') ?? '';
}
