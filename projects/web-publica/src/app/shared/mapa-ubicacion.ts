import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/** Solo se incrustan mapas de Google Maps servidos por HTTPS; cualquier otra URL se ignora (no se confía en datos arbitrarios). */
const PREFIJO_PERMITIDO = 'https://www.google.com/maps';

/**
 * Mapa interactivo de la ubicación (iframe de Google Maps, sin clave de API ni cuenta). La URL viene SIEMPRE de
 * config/sitio.config.ts, nunca de datos del usuario. Sin URL válida no se renderiza nada.
 */
@Component({
  selector: 'pub-mapa-ubicacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src(); as url) {
      <div class="marco">
        <iframe
          [src]="url"
          [title]="titulo()"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          allowfullscreen
        ></iframe>
      </div>
    }
  `,
  styles: `
    .marco {
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--color-sage-soft);
      box-shadow: var(--shadow);
      aspect-ratio: 16 / 9;
      min-height: 15rem;
    }
    iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
      /* Acerca los colores del mapa a la paleta sin tocar su contenido ni su interacción. */
      filter: saturate(0.85) contrast(0.98);
    }
  `
})
export class MapaUbicacion {
  private readonly sanitizer = inject(DomSanitizer);

  readonly embedUrl = input<string>('');
  readonly titulo = input<string>('Mapa de nuestra ubicación');

  protected readonly src = computed<SafeResourceUrl | null>(() => {
    const url = this.embedUrl().trim();
    return url.startsWith(PREFIJO_PERMITIDO) ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
}
