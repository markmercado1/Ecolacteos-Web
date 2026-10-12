import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { GRUPOS_NAVEGACION } from './nav-items';

/**
 * '' no tiene una página propia: redirige a la primera sección que el rol puede ver, recorriendo
 * GRUPOS_NAVEGACION en el mismo orden que el sidebar (Shell.grupos() aplica el mismo filtro por rol).
 * Antes redirigía a un '/supervision' hardcodeado para todo el que no fuera ADMIN; esa ruta apuntaba a
 * PendingFeaturePage (sin implementar) y se eliminó junto con el ítem de navegación.
 */
@Component({
  selector: 'app-home-redirect',
  template: ''
})
export class HomeRedirect {
  constructor() {
    const router = inject(Router);
    const auth = inject(AuthService);
    const rol = auth.usuario()?.rolNombre;
    const primerItem = GRUPOS_NAVEGACION
      .flatMap((grupo) => grupo.items)
      .find((item) => !rol || item.roles.includes(rol));
    router.navigateByUrl(primerItem?.ruta ?? '/403', { replaceUrl: true });
  }
}
