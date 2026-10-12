import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { TokenStoreService } from './token-store.service';
import { UsuarioMeResponse } from './auth.models';

const usuario: UsuarioMeResponse = {
  id: 'u-1', nombre: 'Ana', email: 'ana@ecolacteos.pe', rolNombre: 'ADMIN', activo: true, unidadesResponsable: []
};

describe('authGuard', () => {
  let tokenStore: TokenStoreService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    tokenStore = TestBed.inject(TokenStoreService);
  });

  afterEach(() => localStorage.clear());

  it('permite el acceso si hay sesión activa', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: 0, usuario });
    const resultado = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/panel' } as RouterStateSnapshot)
    );
    expect(resultado).toBe(true);
  });

  it('redirige a /login con returnUrl si no hay sesión', () => {
    const resultado = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/panel' } as RouterStateSnapshot)
    ) as UrlTree;
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(resultado)).toBe('/login?returnUrl=%2Fpanel');
  });
});
