import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../card/card';

@Component({
  selector: 'app-not-found-page',
  imports: [CardComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-card titulo="Página no encontrada">
      <p>La ruta solicitada no existe en el panel de EcoLácteos.</p>
      <a class="btn primary" routerLink="/">Volver al inicio</a>
    </ui-card>
  `,
  styles: `
    :host { display: block; padding: var(--space-8); }
  `
})
export class NotFoundPage {}
