import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenStoreService } from './token-store.service';

/** Exige sesión activa; sin sesión (incluida tras recargar la página) vuelve a /login. */
export const authGuard: CanActivateFn = (_route, state) => {
  const tokenStore = inject(TokenStoreService);
  const router = inject(Router);

  if (tokenStore.estaAutenticado()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
