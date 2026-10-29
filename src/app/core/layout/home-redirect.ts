import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RolNombre } from '../../shared/models/rol';
import { AuthService } from '../auth/auth.service';
import { GRUPOS_NAVEGACION } from './nav-items';

/**
 * Pantalla inicial de los roles cuyo primer ítem del menú no es su tarea principal. VENTAS ve Inventario antes
 * que Ventas (el grupo Producción va primero en el menú), pero entra a registrar ventas.
 */
const INICIO_POR_ROL: Partial<Record<RolNombre, string>> = { VENTAS: '/ventas' };

/**
 * Ruta a la que se redirige '' para el rol dado: la indicada en INICIO_POR_ROL o, si no hay, la primera sección
 * que el rol puede ver, recorriendo GRUPOS_NAVEGACION en el mismo orden que el sidebar.
 */
export function rutaInicial(rol: RolNombre | undefined): string {
  const propia = rol ? INICIO_POR_ROL[rol] : undefined;
  if (propia) return propia;
  const primerItem = GRUPOS_NAVEGACION
    .flatMap((grupo) => grupo.items)
    .find((item) => !rol || item.roles.includes(rol));
  return primerItem?.ruta ?? '/403';
}

/**
 * '' no tiene una página propia: redirige a `rutaInicial` según el rol (Shell.grupos() aplica el mismo filtro por rol).
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
    router.navigateByUrl(rutaInicial(auth.usuario()?.rolNombre), { replaceUrl: true });
  }
}
