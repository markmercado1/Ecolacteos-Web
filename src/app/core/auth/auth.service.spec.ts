import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { TokenStoreService } from './token-store.service';
import { LoginResponse, UsuarioMeResponse } from './auth.models';

const base = environment.apiBaseUrl;

const loginResponse: LoginResponse = {
  token: 'token-inicial',
  rol: 'ADMIN',
  nombre: 'Ana Torres',
  expiraEnSegundos: 900,
  refreshToken: 'refresh-inicial',
  refreshExpiraEnSegundos: 3600
};

const usuarioMe: UsuarioMeResponse = {
  id: 'u-1',
  nombre: 'Ana Torres',
  email: 'ana@ecolacteos.pe',
  rolNombre: 'ADMIN',
  activo: true,
  unidadesResponsable: []
};

describe('AuthService', () => {
  let service: AuthService;
  let tokenStore: TokenStoreService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthService);
    tokenStore = TestBed.inject(TokenStoreService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('guarda la sesión y consulta /auth/me tras un login válido', () => {
    let usuarioRecibido: UsuarioMeResponse | undefined;
    service.login({ email: usuarioMe.email, password: 'secreta123' }).subscribe((u) => (usuarioRecibido = u));

    const loginReq = http.expectOne(`${base}/auth/login`);
    expect(loginReq.request.method).toBe('POST');
    loginReq.flush(loginResponse);

    const meReq = http.expectOne(`${base}/auth/me`);
    expect(meReq.request.headers.get('Authorization')).toBe('Bearer token-inicial');
    meReq.flush(usuarioMe);

    expect(usuarioRecibido).toEqual(usuarioMe);
    expect(tokenStore.estaAutenticado()).toBe(true);
    expect(tokenStore.token()).toBe('token-inicial');
  });

  it('propaga el error y no crea sesión ante credenciales inválidas', () => {
    let errorRecibido: unknown;
    service.login({ email: usuarioMe.email, password: 'incorrecta' }).subscribe({
      error: (e) => (errorRecibido = e)
    });

    const loginReq = http.expectOne(`${base}/auth/login`);
    loginReq.flush({ timestamp: '', status: 401, error: 'Unauthorized', mensaje: 'Credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' });

    expect(errorRecibido).toBeTruthy();
    expect(tokenStore.estaAutenticado()).toBe(false);
  });

  it('comparte una única renovación en curso entre varios llamantes', () => {
    tokenStore.establecer({
      token: 'viejo',
      refreshToken: 'refresh-viejo',
      expiraEn: Date.now(),
      refreshExpiraEn: Date.now() + 100000,
      usuario: usuarioMe
    });

    service.renovarSesion().subscribe();
    service.renovarSesion().subscribe();

    const solicitudes = http.match(`${base}/auth/refresh-token`);
    expect(solicitudes.length).toBe(1);
    solicitudes[0].flush(loginResponse);

    expect(tokenStore.token()).toBe('token-inicial');
  });

  it('cierra sesión localmente y navega a /login cuando falla la renovación', () => {
    tokenStore.establecer({
      token: 'viejo',
      refreshToken: 'refresh-viejo',
      expiraEn: Date.now(),
      refreshExpiraEn: Date.now() + 100000,
      usuario: usuarioMe
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    service.renovarSesion().subscribe({ error: () => undefined });
    const req = http.expectOne(`${base}/auth/refresh-token`);
    req.flush({ mensaje: 'Refresh inválido' }, { status: 401, statusText: 'Unauthorized' });

    expect(tokenStore.estaAutenticado()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { queryParams: { motivo: 'expirada' } });
  });

  it('reanudarSesion() reprograma la renovación de una sesión restaurada desde localStorage (equivalente a un F5)', () => {
    vi.useFakeTimers();
    const expiraEn = Date.now() + 1000;
    tokenStore.establecer({
      token: 'restaurado', refreshToken: 'r-restaurado', expiraEn,
      refreshExpiraEn: Date.now() + 100_000, usuario: usuarioMe
    });

    service.reanudarSesion();
    vi.advanceTimersByTime(900); // 80% de los 1000ms restantes ya pasó

    const req = http.expectOne(`${base}/auth/refresh-token`);
    req.flush(loginResponse);

    expect(tokenStore.token()).toBe('token-inicial');
  });

  it('logout() manual limpia la sesión y navega a /login sin motivo', () => {
    tokenStore.establecer({
      token: 't', refreshToken: 'r', expiraEn: Date.now() + 900000, refreshExpiraEn: Date.now() + 3600000, usuario: usuarioMe
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    service.logout();

    expect(tokenStore.estaAutenticado()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], undefined);
  });
});
