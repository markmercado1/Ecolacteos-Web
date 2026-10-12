import { TestBed } from '@angular/core/testing';
import { TokenStoreService } from './token-store.service';
import { Sesion, UsuarioMeResponse } from './auth.models';

const CLAVE = 'ecolacteos.sesion.v1';

const usuario: UsuarioMeResponse = {
  id: 'u-1', nombre: 'Ana', email: 'ana@ecolacteos.pe', rolNombre: 'ADMIN', activo: true, unidadesResponsable: []
};

function sesionValida(): Sesion {
  return {
    token: 'token-1',
    refreshToken: 'refresh-1',
    expiraEn: Date.now() + 900_000,
    refreshExpiraEn: Date.now() + 3_600_000,
    usuario
  };
}

/** Cada llamada simula un arranque nuevo de la app (F5 o abrir el navegador de nuevo). */
function crear(): TokenStoreService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  return TestBed.inject(TokenStoreService);
}

describe('TokenStoreService (persistencia de sesión)', () => {
  afterEach(() => localStorage.clear());

  it('sin nada en localStorage, arranca sin sesión', () => {
    const store = crear();
    expect(store.estaAutenticado()).toBe(false);
  });

  it('establecer() persiste, y una nueva instancia (equivalente a un F5) restaura la sesión', () => {
    const primera = crear();
    primera.establecer(sesionValida());

    const segunda = crear();
    expect(segunda.estaAutenticado()).toBe(true);
    expect(segunda.token()).toBe('token-1');
    expect(segunda.usuario()?.rolNombre).toBe('ADMIN');
  });

  it('limpiar() borra el almacenamiento: una nueva instancia (F5 tras cerrar sesión) no restaura nada', () => {
    const primera = crear();
    primera.establecer(sesionValida());
    primera.limpiar();

    const segunda = crear();
    expect(segunda.estaAutenticado()).toBe(false);
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });

  it('si el refreshToken ya venció, no restaura la sesión persistida', () => {
    const vencida: Sesion = {
      ...sesionValida(),
      expiraEn: Date.now() - 10_000,
      refreshExpiraEn: Date.now() - 5_000
    };
    localStorage.setItem(CLAVE, JSON.stringify(vencida));

    const store = crear();
    expect(store.estaAutenticado()).toBe(false);
  });

  it('ignora una entrada corrupta en localStorage sin lanzar error', () => {
    localStorage.setItem(CLAVE, '{esto no es json válido');
    expect(() => crear()).not.toThrow();
    expect(crear().estaAutenticado()).toBe(false);
  });

  it('actualizarTokens() y actualizarUsuario() también persisten el estado más reciente', () => {
    const primera = crear();
    primera.establecer(sesionValida());
    primera.actualizarTokens({
      token: 'token-2',
      refreshToken: 'refresh-2',
      expiraEn: Date.now() + 900_000,
      refreshExpiraEn: Date.now() + 3_600_000
    });

    const segunda = crear();
    expect(segunda.token()).toBe('token-2');
    expect(segunda.refreshToken()).toBe('refresh-2');
  });
});
