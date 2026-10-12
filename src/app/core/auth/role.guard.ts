import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RolNombre } from '../../shared/models/rol';
import { TokenStoreService } from './token-store.service';

/**
 * Compara el rol de /auth/me con route.data['roles']. Es una guía de
 * navegación en el cliente; el backend sigue siendo quien decide el permiso
 * efectivo (ver docs/ARQUITECTURA.md, "Sesión y permisos").
 */
export const roleGuard: CanActivateFn = (route) => {
  const tokenStore = inject(TokenStoreService);
  const router = inject(Router);

  const rolesPermitidos = route.data['roles'] as RolNombre[] | undefined;
  const rolActual = tokenStore.usuario()?.rolNombre;

  if (!rolesPermitidos || !rolActual || rolesPermitidos.includes(rolActual)) {
    return true;
  }
  return router.createUrlTree(['/403']);
};
