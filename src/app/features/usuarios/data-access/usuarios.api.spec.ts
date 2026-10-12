import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { UsuariosApi } from './usuarios.api';
import { UsuarioResponse } from './usuario.models';

const base = environment.apiBaseUrl;

const usuario: UsuarioResponse = {
  id: 'u-1', nombre: 'Ana', email: 'ana@ecolacteos.pe', rolNombre: 'ACOPIADOR', activo: true
};

describe('UsuariosApi', () => {
  let api: UsuariosApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(UsuariosApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() hace GET /admin/usuarios', () => {
    api.listar().subscribe();
    const req = http.expectOne(`${base}/admin/usuarios`);
    expect(req.request.method).toBe('GET');
    req.flush([usuario]);
  });

  it('crear() envía UsuarioRequest exacto por POST', () => {
    api.crear({ nombre: 'Ana', email: 'ana@ecolacteos.pe', password: 'secreta123', rolNombre: 'ACOPIADOR' }).subscribe();
    const req = http.expectOne(`${base}/admin/usuarios`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      nombre: 'Ana', email: 'ana@ecolacteos.pe', password: 'secreta123', rolNombre: 'ACOPIADOR'
    });
    req.flush(usuario);
  });

  it('actualizar() hace PUT sin nuevaPassword cuando no se cambia', () => {
    api.actualizar('u-1', { nombre: 'Ana', email: 'ana@ecolacteos.pe', rolNombre: 'ACOPIADOR' }).subscribe();
    const req = http.expectOne(`${base}/admin/usuarios/u-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.nuevaPassword).toBeUndefined();
    req.flush(usuario);
  });

  it('desactivar() hace DELETE por id', () => {
    api.desactivar('u-1').subscribe();
    const req = http.expectOne(`${base}/admin/usuarios/u-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('reactivar() hace PATCH a /reactivar', () => {
    api.reactivar('u-1').subscribe();
    const req = http.expectOne(`${base}/admin/usuarios/u-1/reactivar`);
    expect(req.request.method).toBe('PATCH');
    req.flush(usuario);
  });

  it('listarRoles() hace GET /admin/roles', () => {
    api.listarRoles().subscribe();
    const req = http.expectOne(`${base}/admin/roles`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'r-1', nombre: 'ADMIN' }]);
  });

  it('listarPaginado() envía page/size y solo los filtros presentes', () => {
    api.listarPaginado({ page: 1, size: 20, rol: 'ACOPIADOR', activo: false, busqueda: '  ana ' }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/admin/usuarios/paginado`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('rol')).toBe('ACOPIADOR');
    expect(req.request.params.get('activo')).toBe('false');
    expect(req.request.params.get('busqueda')).toBe('ana');
    req.flush({ contenido: [], paginaActual: 1, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });

    api.listarPaginado({ page: 0, size: 20, busqueda: '   ' }).subscribe();
    const sinFiltros = http.expectOne((r) => r.url === `${base}/admin/usuarios/paginado`);
    expect(sinFiltros.request.params.keys().sort()).toEqual(['page', 'size']);
    sinFiltros.flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });
});
