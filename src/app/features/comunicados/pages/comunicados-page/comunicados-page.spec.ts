import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { PaginaResponse } from '../../../../shared/models/pagina-response';
import { ComunicadoResponse } from '../../data-access/comunicado.models';
import { ComunicadosPage } from './comunicados-page';

const base = environment.apiBaseUrl;

function crearPagina(http: HttpTestingController): ComunicadosPage {
  const page = TestBed.createComponent(ComunicadosPage).componentInstance;
  http.expectOne(`${base}/admin/zonas`).flush([
    { id: 'z-1', nombre: 'Huancayo Norte', activa: true },
    { id: 'z-2', nombre: 'El Tambo', activa: true }
  ]);
  http.expectOne((r) => r.method === 'GET' && r.url === `${base}/comunicados`).flush(paginaDe([], 0, 0));
  return page;
}

function paginaDe(contenido: ComunicadoResponse[], paginaActual: number, totalElementos: number): PaginaResponse<ComunicadoResponse> {
  return { contenido, paginaActual, tamanoPagina: 20, totalElementos, totalPaginas: Math.ceil(totalElementos / 20) };
}

function comunicado(id: string): ComunicadoResponse {
  return { id, mensaje: `Mensaje ${id}`, fecha: '2026-09-16T08:00:00', zonasNombres: ['Huancayo Norte'] };
}

describe('ComunicadosPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('no publica sin mensaje y no llama a la API', () => {
    const page = crearPagina(http);
    page['form'].setValue({ mensaje: '   ' });
    page['zonasSeleccionadas'].set(new Set(['z-1']));

    page['publicar']();

    expect(page['errorPublicar']()).toContain('mensaje');
    http.expectNone((r) => r.url === `${base}/comunicados`);
  });

  it('no publica sin ninguna zona seleccionada', () => {
    const page = crearPagina(http);
    page['form'].setValue({ mensaje: 'Hola productores' });

    page['publicar']();

    expect(page['errorPublicar']()).toContain('zona');
    http.expectNone((r) => r.url === `${base}/comunicados`);
  });

  it('publica con mensaje y zonas válidas y recarga la primera página desde el servidor', () => {
    const page = crearPagina(http);
    page['pagina'].set(2);
    page['form'].setValue({ mensaje: 'Corte de agua programado' });
    page['zonasSeleccionadas'].set(new Set(['z-1']));

    page['publicar']();
    const req = http.expectOne((r) => r.method === 'POST' && r.url === `${base}/comunicados`);
    expect(req.request.body).toEqual({ mensaje: 'Corte de agua programado', zonaIds: ['z-1'] });
    req.flush({ id: 'c-1', mensaje: 'Corte de agua programado', fecha: '2026-09-16', zonasNombres: ['Huancayo Norte'] });

    const recarga = http.expectOne((r) => r.method === 'GET' && r.url === `${base}/comunicados`);
    expect(recarga.request.params.get('page')).toBe('0');
    recarga.flush(paginaDe([comunicado('c-1')], 0, 41));

    expect(page['comunicados']()[0].id).toBe('c-1');
    expect(page['totalElementos']()).toBe(41);
    expect(page['zonasSeleccionadas']().size).toBe(0);
  });

  it('pagina en el servidor y no pide páginas fuera de rango', () => {
    const page = crearPagina(http);
    page['totalPaginas'].set(3);

    page['cambiarPagina'](1);
    const req = http.expectOne((r) => r.url === `${base}/comunicados`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('20');
    req.flush(paginaDe([comunicado('c-21')], 1, 41));

    page['cambiarPagina'](3);
    page['cambiarPagina'](-1);
    http.expectNone((r) => r.url === `${base}/comunicados`);
    expect(page['pagina']()).toBe(1);
  });

  it('muestra el estado vacío cuando no hay comunicados', () => {
    const fixture = TestBed.createComponent(ComunicadosPage);
    http.expectOne(`${base}/admin/zonas`).flush([]);
    http.expectOne((r) => r.url === `${base}/comunicados`).flush(paginaDe([], 0, 0));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No se ha publicado ningún comunicado');
  });

  it('nombresZonasSeleccionadas() refleja la selección actual', () => {
    const page = crearPagina(http);
    expect(page['nombresZonasSeleccionadas']()).toBe('ninguna zona seleccionada');
    page['zonasSeleccionadas'].set(new Set(['z-2', 'z-1']));
    expect(page['nombresZonasSeleccionadas']()).toBe('Huancayo Norte, El Tambo');
  });
});
