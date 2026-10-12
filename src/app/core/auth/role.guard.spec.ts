import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, UrlTree } from '@angular/router';
import { roleGuard } from './role.guard';
import { TokenStoreService } from './token-store.service';
import { UsuarioMeResponse } from './auth.models';

function usuarioCon(rolNombre: UsuarioMeResponse['rolNombre']): UsuarioMeResponse {
  return { id: 'u-1', nombre: 'Ana', email: 'ana@ecolacteos.pe', rolNombre, activo: true, unidadesResponsable: [] };
}

function rutaConRoles(roles: string[]): ActivatedRouteSnapshot {
  return { data: { roles } } as unknown as ActivatedRouteSnapshot;
}

describe('roleGuard', () => {
  let tokenStore: TokenStoreService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    tokenStore = TestBed.inject(TokenStoreService);
  });

  afterEach(() => localStorage.clear());

  it('permite el acceso cuando el rol de /auth/me está en la lista de la ruta', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: 0, usuario: usuarioCon('ADMIN') });
    const resultado = TestBed.runInInjectionContext(() =>
      roleGuard(rutaConRoles(['ADMIN', 'VENTAS']), {} as never)
    );
    expect(resultado).toBe(true);
  });

  it('redirige a /403 cuando el rol no está permitido', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: 0, usuario: usuarioCon('VENTAS') });
    const resultado = TestBed.runInInjectionContext(() =>
      roleGuard(rutaConRoles(['ADMIN']), {} as never)
    ) as UrlTree;
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(resultado)).toBe('/403');
  });
});
