import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { UsuariosPage } from './usuarios-page';
import { UsuarioResponse } from '../../data-access/usuario.models';
import { PaginaResponse } from '../../../../shared/models/pagina-response';
import { UsuarioFormDialog } from '../../ui/usuario-form-dialog/usuario-form-dialog';

const base = environment.apiBaseUrl;

const usuarios: UsuarioResponse[] = [
  { id: 'u-1', nombre: 'Ana Torres', email: 'ana@ecolacteos.pe', rolNombre: 'ADMIN', activo: true },
  { id: 'u-2', nombre: 'Jorge Palomino', email: 'jorge@ecolacteos.pe', rolNombre: 'ACOPIADOR', activo: true },
  { id: 'u-3', nombre: 'Mónica Rojas', email: 'monica@ecolacteos.pe', rolNombre: 'PRODUCCION', activo: false }
];

const esPaginado = (r: { url: string }) => r.url === `${base}/admin/usuarios/paginado`;

function paginaDe(contenido: UsuarioResponse[], paginaActual = 0, totalElementos = contenido.length): PaginaResponse<UsuarioResponse> {
  return { contenido, paginaActual, tamanoPagina: 20, totalElementos, totalPaginas: Math.ceil(totalElementos / 20) };
}

describe('UsuariosPage (filtros y paginación en el servidor)', () => {
  let http: HttpTestingController;
  let page: UsuariosPage;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    page = TestBed.createComponent(UsuariosPage).componentInstance;

    http.expectOne(`${base}/admin/roles`).flush([
      { id: 'r-1', nombre: 'ADMIN' }, { id: 'r-2', nombre: 'ACOPIADOR' }, { id: 'r-3', nombre: 'PRODUCCION' }
    ]);
    const inicial = http.expectOne(esPaginado);
    expect(inicial.request.params.get('page')).toBe('0');
    expect(inicial.request.params.get('size')).toBe('20');
    expect(inicial.request.params.has('rol')).toBe(false);
    expect(inicial.request.params.has('activo')).toBe(false);
    expect(inicial.request.params.has('busqueda')).toBe(false);
    inicial.flush(paginaDe(usuarios, 0, 45));
  });

  afterEach(() => http.verify());

  it('sin filtros muestra la página recibida y guarda el total del servidor', () => {
    expect(page['usuarios']().length).toBe(3);
    expect(page['totalElementos']()).toBe(45);
    expect(page['totalPaginas']()).toBe(3);
  });

  it('el filtro de rol se envía al servidor y reinicia la página', () => {
    page['pagina'].set(2);
    page['cambiarFiltroRol']('ACOPIADOR');
    const req = http.expectOne(esPaginado);
    expect(req.request.params.get('rol')).toBe('ACOPIADOR');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(paginaDe([usuarios[1]]));
    expect(page['usuarios']().map((u: UsuarioResponse) => u.id)).toEqual(['u-2']);
  });

  it('el filtro de estado se traduce a activo=true/false y "Todos" lo omite', () => {
    page['cambiarFiltroEstado']('INACTIVOS');
    expect(http.expectOne(esPaginado).request.params.get('activo')).toBe('false');
    page['cambiarFiltroEstado']('ACTIVOS');
    expect(http.expectOne(esPaginado).request.params.get('activo')).toBe('true');
    page['cambiarFiltroEstado']('TODOS');
    expect(http.expectOne(esPaginado).request.params.has('activo')).toBe(false);
  });

  // El debounce vive en ui-buscador (buscador.spec.ts); aquí se prueba qué hace la página con el texto.
  it('la búsqueda viaja al servidor combinada con rol y estado y vuelve a la página 0', () => {
    page['cambiarFiltroRol']('ADMIN');
    http.expectOne(esPaginado).flush(paginaDe([usuarios[0]]));
    page['cambiarFiltroEstado']('ACTIVOS');
    http.expectOne(esPaginado).flush(paginaDe([usuarios[0]]));

    page['buscar']('ana');
    const req = http.expectOne(esPaginado);
    expect(req.request.params.get('busqueda')).toBe('ana');
    expect(req.request.params.get('rol')).toBe('ADMIN');
    expect(req.request.params.get('activo')).toBe('true');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(paginaDe([usuarios[0]]));
  });

  it('cambiarTamano pide la primera página con el nuevo tamaño', () => {
    page['cambiarTamano'](10);
    const req = http.expectOne(esPaginado);
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(paginaDe(usuarios));
  });

  it('cambiarPagina no sale del rango y corrige una página que quedó vacía tras desactivar', () => {
    page['cambiarPagina'](-1);
    http.expectNone(esPaginado);

    page['cambiarPagina'](2);
    http.expectOne(esPaginado).flush({ contenido: [], paginaActual: 2, tamanoPagina: 20, totalElementos: 40, totalPaginas: 2 });
    const reintento = http.expectOne(esPaginado);
    expect(reintento.request.params.get('page')).toBe('1');
    reintento.flush(paginaDe(usuarios, 1, 40));
    expect(page['pagina']()).toBe(1);
  });
});

describe('UsuariosPage (regresión: contenido real de cada columna en el DOM)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<UsuariosPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UsuariosPage);

    http.expectOne(`${base}/admin/roles`).flush([
      { id: 'r-1', nombre: 'ADMIN' }, { id: 'r-2', nombre: 'ACOPIADOR' }, { id: 'r-3', nombre: 'PRODUCCION' }
    ]);
    http.expectOne(esPaginado).flush(paginaDe(usuarios));
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('cada fila muestra nombre, correo, rol y estado propios, no el mismo valor repetido', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const filas = raiz.querySelectorAll('tbody tr');
    expect(filas.length).toBe(3);

    const celdas = (fila: Element) => Array.from(fila.querySelectorAll('td')).map((td) => td.textContent?.trim());

    const [c1, c2, c3] = [celdas(filas[0]), celdas(filas[1]), celdas(filas[2])];
    expect(c1[0]).toBe('Ana Torres');
    expect(c1[1]).toBe('ana@ecolacteos.pe');
    expect(c1[2]).toBe('ADMIN');
    expect(c1[3]).toBe('Activo');

    expect(c2[0]).toBe('Jorge Palomino');
    expect(c2[1]).toBe('jorge@ecolacteos.pe');
    expect(c2[2]).toBe('ACOPIADOR');
    expect(c2[3]).toBe('Activo');

    expect(c3[0]).toBe('Mónica Rojas');
    expect(c3[1]).toBe('monica@ecolacteos.pe');
    expect(c3[2]).toBe('PRODUCCION');
    expect(c3[3]).toBe('Inactivo');
  });

  it('el botón "Editar" de una fila abre el diálogo con el usuario correcto, no el de otra fila', () => {
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);

    const raiz = fixture.nativeElement as HTMLElement;
    const filas = raiz.querySelectorAll('tbody tr');
    const botonEditarFila2 = Array.from(filas[1].querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Editar'
    )!;
    botonEditarFila2.click();

    expect(abrirSpy).toHaveBeenCalledTimes(1);
    const [componente, config] = abrirSpy.mock.calls[0];
    expect(componente).toBe(UsuarioFormDialog);
    expect((config?.data as { usuario: UsuarioResponse }).usuario.id).toBe('u-2');
    expect((config?.data as { usuario: UsuarioResponse }).usuario.nombre).toBe('Jorge Palomino');
  });
});
