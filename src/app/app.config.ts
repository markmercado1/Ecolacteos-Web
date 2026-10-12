import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    // TokenStoreService ya restauró la sesión (si había una) de forma síncrona
    // en su propio constructor, así que los guards de la navegación inicial
    // la ven de inmediato. Este inicializador solo reprograma el temporizador
    // de renovación para el tiempo que quede; no bloquea el arranque.
    provideAppInitializer(() => inject(AuthService).reanudarSesion())
  ]
};
