import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { AcopiadoresPage } from './acopiadores-page';
import { AsignarUnidadDialogData } from '../../../unidades/ui/asignar-unidad-dialog/asignar-unidad-dialog';
import { UnidadFormDialogData } from '../../../unidades/ui/unidad-form-dialog/unidad-form-dialog';
import { UsuarioResponse } from '../../../usuarios/data-access/usuario.models';
import { PaginaResponse } from '../../../../shared/models/pagina-response';

const base = environment.apiBaseUrl;

const usuarios: UsuarioResponse[] = [
  { id: 'u-1', nombre: 'Jorge Palomino', email: 'jorge@ecolacteos.pe', rolNombre: 'ACOPIADOR', activo: true },
  { id: 'u-2', nombre: 'Lidia Espinoza', email: 'lidia@ecolacteos.pe', rolNombre: 'ACOPIADOR', activo: false },
  { id: 'u-3', nombre: 'Luis Ventas', email: 'luis@ecolacteos.pe', rolNombre: 'VENTAS', activo: true }
];
/** El servidor ya filtra rol=ACOPIADOR: la página solo trae acopiadores. */
const acopiadores = usuarios.filter((u) => u.rolNombre === 'ACOPIADOR');
const esPaginado = (r: { url: string }) => r.url === `${base}/admin/usuarios/paginado`;

function paginaDe(contenido: UsuarioResponse[], paginaActual = 0, totalElementos = contenido.length): PaginaResponse<UsuarioResponse> {
  return { contenido, paginaActual, tamanoPagina: 12, totalElementos, totalPaginas: Math.ceil(totalElementos / 12) };
}

const unidadExistente = { id: 'un-9', placa: 'ZZZ-999', capacidadTon: null, zonaId: null, responsableId: 'u-3', responsableNombre: 'Luis Ventas' };

function flushCargaInicial(http: HttpTestingController): void {
  http.expectOne(`${base}/admin/zonas`).flush([]);
  http.expectOne(`${base}/admin/unidades`).flush([unidadExistente]);
  const req = http.expectOne(esPaginado);
  expect(req.request.params.get('rol')).toBe('ACOPIADOR');
  expect(req.request.params.get('size')).toBe('12');
  req.flush(paginaDe(acopiadores));
}

describe('AcopiadoresPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // Regresión: "Asignar unidad" / "Añadir otra unidad" navegaba a /unidades?nuevaPara=<id> (otra
  // pantalla). Ahora abre AsignarUnidadDialog en el momento, sin navegar, con la flota ya cargada y el
  // acopiador de esta tarjeta como responsable a asignar.
  it('asignarUnidad() abre AsignarUnidadDialog (paso "existente vs. nueva") sin navegar', () => {
    const page = TestBed.createComponent(AcopiadoresPage).componentInstance;
    flushCargaInicial(http);
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);

    page['asignarUnidad'](usuarios[0]);

    const config = abrirSpy.mock.calls[0][1] as { ariaLabel: string; data: AsignarUnidadDialogData };
    expect(config.ariaLabel).toBe('Asignar unidad');
    expect(config.data.responsableId).toBe('u-1');
    expect(config.data.responsableNombre).toBe('Jorge Palomino');
    expect(config.data.unidades).toEqual([unidadExistente]);
  });

  it('si el diálogo resuelve "reasignada", refresca el listado y avisa por toast (no abre un segundo diálogo)', () => {
    const page = TestBed.createComponent(AcopiadoresPage).componentInstance;
    flushCargaInicial(http);
    const dialog = TestBed.inject(Dialog);
    const unidadReasignada = { ...unidadExistente, responsableId: 'u-1', responsableNombre: 'Jorge Palomino' };
    const abrirSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ closed: { subscribe: (cb: (r: unknown) => void) => cb({ tipo: 'reasignada', unidad: unidadReasignada }) } } as never);

    page['asignarUnidad'](usuarios[0]);
    flushCargaInicial(http); // this.cargar() vuelve a pedir zonas/unidades/usuarios

    expect(abrirSpy).toHaveBeenCalledTimes(1); // no se encadena UnidadFormDialog
  });

  // El punto central de este ajuste: solo si el usuario contesta "es nueva" en AsignarUnidadDialog se
  // encadena el formulario de creación completo (UnidadFormDialog), con el mismo responsable.
  it('si el diálogo resuelve "crear-nueva", encadena UnidadFormDialog con el responsable preseleccionado', () => {
    const page = TestBed.createComponent(AcopiadoresPage).componentInstance;
    flushCargaInicial(http);
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValueOnce({ closed: { subscribe: (cb: (r: unknown) => void) => cb({ tipo: 'crear-nueva' }) } } as never)
      .mockReturnValueOnce({ closed: { subscribe: () => undefined } } as never);

    page['asignarUnidad'](usuarios[0]);
    // El selector de responsable necesita todos los acopiadores activos, no solo la página visible.
    http.expectOne(`${base}/admin/usuarios`).flush(usuarios);

    expect(abrirSpy).toHaveBeenCalledTimes(2);
    const segundaConfig = abrirSpy.mock.calls[1][1] as { ariaLabel: string; data: UnidadFormDialogData };
    expect(segundaConfig.ariaLabel).toBe('Nueva unidad');
    expect(segundaConfig.data.responsableIdInicial).toBe('u-1');
    expect(segundaConfig.data.unidad).toBeUndefined();
    expect(segundaConfig.data.responsables.map((r) => r.id)).toEqual(['u-1']); // solo acopiadores activos
  });

  it('si el usuario cierra AsignarUnidadDialog sin elegir nada, no pasa nada (no encadena ni refresca)', () => {
    const page = TestBed.createComponent(AcopiadoresPage).componentInstance;
    flushCargaInicial(http);
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: (cb: (r: unknown) => void) => cb(undefined) } } as never);

    page['asignarUnidad'](usuarios[0]);

    expect(abrirSpy).toHaveBeenCalledTimes(1);
  });

  it('pagina los acopiadores en el servidor y no pide páginas fuera de rango', () => {
    const fixture = TestBed.createComponent(AcopiadoresPage);
    const page = fixture.componentInstance;
    http.expectOne(`${base}/admin/zonas`).flush([]);
    http.expectOne(`${base}/admin/unidades`).flush([]);
    http.expectOne(esPaginado).flush(paginaDe(acopiadores, 0, 14));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Mostrando 1–12 de 14 acopiadores');

    page['cambiarPagina'](1);
    const req = http.expectOne(esPaginado);
    expect(req.request.params.get('page')).toBe('1');
    req.flush(paginaDe([acopiadores[0]], 1, 14));
    page['cambiarPagina'](2);
    http.expectNone(esPaginado);
  });

  it('un error al pedir la lista completa para el selector no abre el formulario', () => {
    const page = TestBed.createComponent(AcopiadoresPage).componentInstance;
    flushCargaInicial(http);
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValueOnce({ closed: { subscribe: (cb: (r: unknown) => void) => cb({ tipo: 'crear-nueva' }) } } as never);

    page['asignarUnidad'](usuarios[0]);
    http.expectOne(`${base}/admin/usuarios`).flush({}, { status: 500, statusText: 'Server Error' });

    expect(abrirSpy).toHaveBeenCalledTimes(1);
  });
});
