import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenStoreService } from './token-store.service';

/** Evita mostrar /login cuando ya hay una sesión activa en memoria. */
export const guestGuard: CanActivateFn = () => {
  const tokenStore = inject(TokenStoreService);
  const router = inject(Router);
  return tokenStore.estaAutenticado() ? router.createUrlTree(['/']) : true;
};
