import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { TokenStoreService } from './token-store.service';
import { UsuarioMeResponse } from './auth.models';

const base = environment.apiBaseUrl;
const usuario: UsuarioMeResponse = {
  id: 'u-1', nombre: 'Ana', email: 'ana@ecolacteos.pe', rolNombre: 'ADMIN', activo: true, unidadesResponsable: []
};

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let tokenStore: TokenStoreService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    tokenStore = TestBed.inject(TokenStoreService);
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  it('adjunta el Bearer token en una ruta protegida', () => {
    tokenStore.establecer({ token: 'abc', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: 0, usuario });
    http.get(`${base}/admin/usuarios`).subscribe();
    const req = backend.expectOne(`${base}/admin/usuarios`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc');
    req.flush([]);
  });

  it('no adjunta Authorization en /auth/login', () => {
    http.post(`${base}/auth/login`, { email: 'a', password: 'b' }).subscribe();
    const req = backend.expectOne(`${base}/auth/login`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('ante un 401 renueva una vez y reintenta la petición original', () => {
    tokenStore.establecer({ token: 'vencido', refreshToken: 'r-1', expiraEn: 0, refreshExpiraEn: 0, usuario });

    let resultado: unknown;
    http.get(`${base}/admin/usuarios`).subscribe((r) => (resultado = r));

    const primerIntento = backend.expectOne(`${base}/admin/usuarios`);
    expect(primerIntento.request.headers.get('Authorization')).toBe('Bearer vencido');
    primerIntento.flush({ mensaje: 'Token vencido' }, { status: 401, statusText: 'Unauthorized' });

    const refresh = backend.expectOne(`${base}/auth/refresh-token`);
    refresh.flush({
      token: 'nuevo', rol: 'ADMIN', nombre: 'Ana', expiraEnSegundos: 900,
      refreshToken: 'r-2', refreshExpiraEnSegundos: 3600
    });

    const reintento = backend.expectOne(`${base}/admin/usuarios`);
    expect(reintento.request.headers.get('Authorization')).toBe('Bearer nuevo');
    reintento.flush([{ id: 1 }]);

    expect(resultado).toEqual([{ id: 1 }]);
  });
});
