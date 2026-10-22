import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { UnidadesPage } from './unidades-page';
import { UnidadResponse } from '../../data-access/unidad.models';
import { UnidadFormDialogData } from '../../ui/unidad-form-dialog/unidad-form-dialog';

const base = environment.apiBaseUrl;

const unidades: UnidadResponse[] = [
  { id: 'un-1', placa: 'W6P-814', capacidadTon: 5, zonaId: 'z-1', responsableId: 'u-2', responsableNombre: 'Jorge Palomino' },
  { id: 'un-2', placa: 'C4H-221', capacidadTon: null, zonaId: null, responsableId: 'u-3', responsableNombre: 'Lidia Espinoza' },
  { id: 'un-3', placa: 'ZZZ-000', capacidadTon: null, zonaId: null, responsableId: 'u-4', responsableNombre: 'Luis Ventas' }
];

function flushCargaInicial(http: HttpTestingController): void {
  http.expectOne(`${base}/admin/zonas`).flush([{ id: 'z-1', nombre: 'Huancayo Norte', activa: true }]);
  http.expectOne(`${base}/admin/usuarios`).flush([
    { id: 'u-2', nombre: 'Jorge Palomino', email: 'jorge@ecolacteos.pe', rolNombre: 'ACOPIADOR', activo: true },
    { id: 'u-4', nombre: 'Luis Ventas', email: 'luis@ecolacteos.pe', rolNombre: 'VENTAS', activo: true }
  ]);
  http.expectOne(`${base}/admin/unidades`).flush(unidades);
}

describe('UnidadesPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('filtra por placa o responsable en cliente', () => {
    const page = TestBed.createComponent(UnidadesPage).componentInstance;
    flushCargaInicial(http);

    expect(page['lista'].filtradas().length).toBe(3);
    page['lista'].buscar('lidia');
    expect(page['lista'].filtradas().map((u: UnidadResponse) => u.id)).toEqual(['un-2']);
  });

  it('la búsqueda no distingue mayúsculas ni acentos y recorre TODA la flota, no solo la página visible', () => {
    const page = TestBed.createComponent(UnidadesPage).componentInstance;
    flushCargaInicial(http);
    page['lista'].buscar('  LIDIÁ ');
    expect(page['lista'].filtradas().map((u: UnidadResponse) => u.id)).toEqual(['un-2']);
    expect(page['lista'].totalElementos()).toBe(1);
    expect(page['lista'].paginaActual()).toBe(0);
  });

  it('pagina en el cliente y respeta el tamaño de página', () => {
    const page = TestBed.createComponent(UnidadesPage).componentInstance;
    flushCargaInicial(http);
    page['lista'].cambiarTamano(2);
    expect(page['lista'].totalPaginas()).toBe(2);
    expect(page['lista'].filas()).toHaveLength(2);
    page['lista'].irA(1);
    expect(page['lista'].filas()).toHaveLength(1);
  });

  it('resuelve el nombre de zona y "Sin zona" cuando no hay zonaId', () => {
    const page = TestBed.createComponent(UnidadesPage).componentInstance;
    flushCargaInicial(http);

    expect(page['nombreZona']('z-1')).toBe('Huancayo Norte');
    expect(page['nombreZona'](null)).toBe('Sin zona');
  });

  it('al editar una unidad cuyo responsable SÍ es acopiador activo, no marca responsableActual', () => {
    const page = TestBed.createComponent(UnidadesPage).componentInstance;
    flushCargaInicial(http);
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);

    page['editarUnidad'](unidades[0]); // responsableId 'u-2', Jorge Palomino, ACOPIADOR activo

    const config = abrirSpy.mock.calls[0][1] as { data: UnidadFormDialogData };
    expect(config.data.responsableActual).toBeUndefined();
    expect(config.data.responsables.some((r) => r.id === 'u-2')).toBe(true);
  });

  it('al editar una unidad cuyo responsable tiene otro rol, pasa su ficha completa como responsableActual', () => {
    const page = TestBed.createComponent(UnidadesPage).componentInstance;
    flushCargaInicial(http);
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);

    page['editarUnidad'](unidades[2]); // responsableId 'u-4', Luis Ventas, rol VENTAS

    const config = abrirSpy.mock.calls[0][1] as { data: UnidadFormDialogData };
    expect(config.data.responsableActual?.id).toBe('u-4');
    expect(config.data.responsableActual?.rolNombre).toBe('VENTAS');
  });

  // Regresión: el botón principal de /unidades debe CREAR una unidad nueva, no reasignar una existente
  // (antes abría un diálogo distinto pensado solo para reasignar la placa de otro acopiador).
  it('nuevaUnidad() abre UnidadFormDialog en modo creación (sin unidad precargada)', () => {
    const page = TestBed.createComponent(UnidadesPage).componentInstance;
    flushCargaInicial(http);
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);

    page['nuevaUnidad']();

    const config = abrirSpy.mock.calls[0][1] as { ariaLabel: string; data: UnidadFormDialogData };
    expect(config.ariaLabel).toBe('Nueva unidad');
    expect(config.data.unidad).toBeUndefined();
    expect(config.data.responsables.some((r) => r.id === 'u-2')).toBe(true);
  });

  it('al editar una unidad cuyo responsable no aparece en ningún listado, no inventa datos: responsableActual queda undefined', () => {
    const page = TestBed.createComponent(UnidadesPage).componentInstance;
    flushCargaInicial(http);
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);

    page['editarUnidad'](unidades[1]); // responsableId 'u-3', no está en ningún listado de usuarios

    const config = abrirSpy.mock.calls[0][1] as { data: UnidadFormDialogData };
    expect(config.data.responsableActual).toBeUndefined();
    expect(config.data.unidad?.responsableNombre).toBe('Lidia Espinoza'); // el nombre real no se pierde
  });
});
