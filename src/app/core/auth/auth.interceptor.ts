import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, takeUntil, throwError } from 'rxjs';
import { AuthService, AUTH_RUTAS_PUBLICAS } from './auth.service';
import { TokenStoreService } from './token-store.service';

function esRutaPublica(url: string): boolean {
  return AUTH_RUTAS_PUBLICAS.some((ruta) => url.includes(ruta));
}

/**
 * Adjunta el Bearer token, y ante un 401 en una ruta protegida intenta una
 * única renovación compartida antes de reintentar la petición original una
 * sola vez. Login y refresh-token quedan excluidos para no formar un bucle.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStore = inject(TokenStoreService);
  const auth = inject(AuthService);

  const esPublica = esRutaPublica(req.url);
  const token = tokenStore.token();
  const solicitud = !esPublica && token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(solicitud).pipe(
    takeUntil(auth.sesionTerminada$),
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !esPublica &&
        tokenStore.refreshToken()
      ) {
        return auth.renovarSesion().pipe(
          switchMap((respuesta) => {
            const reintento = req.clone({
              setHeaders: { Authorization: `Bearer ${respuesta.token}` }
            });
            return next(reintento);
          }),
          catchError((errorRenovacion) => throwError(() => errorRenovacion))
        );
      }
      return throwError(() => error);
    })
  );
};
