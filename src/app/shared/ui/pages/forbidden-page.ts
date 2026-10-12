import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../card/card';

@Component({
  selector: 'app-forbidden-page',
  imports: [CardComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-card titulo="Permiso insuficiente">
      <p>Tu rol no tiene acceso a esta sección. Si crees que es un error, contacta a un administrador.</p>
      <a class="btn primary" routerLink="/">Volver al inicio</a>
    </ui-card>
  `,
  styles: `
    :host { display: block; padding: var(--space-8); }
  `
})
export class ForbiddenPage {}
