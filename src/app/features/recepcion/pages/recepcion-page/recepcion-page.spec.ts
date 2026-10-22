import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { RecepcionPage } from './recepcion-page';
import { RecepcionDetalleDialog } from '../../ui/recepcion-detalle-dialog/recepcion-detalle-dialog';
import { PaginaResponse } from '../../../../shared/models/pagina-response';
import { RecepcionPlanta } from '../../data-access/recepcion.models';

const base = environment.apiBaseUrl;

const recepcion1: RecepcionPlanta = {
  id: 'rp1',
  fecha: '2026-09-17',
  turno: 'UNICO',
  unidadId: 'u1',
  litrosCampo: 100,
  litrosPlanta: 98,
  diferenciaPct: -2,
  estado: 'OK',
  litrosRegistradosAcopio: 100,
  registroAcopioIds: ['r1', 'r2'],
  jornadaId: 'j1',
  horaLlegada: '2026-09-17T10:00:00',
  diferenciaLitros: -2,
  observacion: null,
};

const pagina0: PaginaResponse<RecepcionPlanta> = {
  contenido: [recepcion1],
  paginaActual: 0,
  tamanoPagina: 20,
  totalElementos: 1,
  totalPaginas: 1,
};

describe('RecepcionPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function crear() {
    const f = TestBed.createComponent(RecepcionPage);
    http
      .expectOne(`${base}/unidades/operativo`)
      .flush([{ id: 'u1', placa: 'ABC-123', capacidadTon: 5, zonaId: null, responsableId: 'ac1', responsableNombre: 'Acopiador Uno' }]);
    http.expectOne((r) => r.url === `${base}/recepcion-planta`).flush(pagina0);
    return { f, c: f.componentInstance };
  }

  it('carga la primera página sin filtros', () => {
    const { f, c } = crear();
    f.detectChanges();
    expect(c['recepciones']().length).toBe(1);
    expect(c['totalElementos']()).toBe(1);
    expect(f.nativeElement.textContent).toContain('ABC-123');
  });

  it('cambiar fecha o unidad reinicia la página a 0', () => {
    const { c } = crear();
    c['pagina'].set(3);
    c['cambiarFiltroUnidad']('u1');
    const req = http.expectOne((r) => r.url === `${base}/recepcion-planta`);
    expect(req.request.params.get('unidadId')).toBe('u1');
    expect(req.request.params.get('page')).toBe('0');
    req.flush({ ...pagina0, paginaActual: 0 });
    expect(c['pagina']()).toBe(0);
  });

  it('buscar manda el texto al servidor junto a los filtros y vuelve a la página 0; vaciar lo quita', () => {
    const { c } = crear();
    c['cambiarFiltroUnidad']('u1');
    http.expectOne((r) => r.url === `${base}/recepcion-planta`).flush({ ...pagina0, paginaActual: 0 });
    c['pagina'].set(2);

    c['buscar']('abc');
    const req = http.expectOne((r) => r.url === `${base}/recepcion-planta`);
    expect(req.request.params.get('busqueda')).toBe('abc');
    expect(req.request.params.get('unidadId')).toBe('u1');
    expect(req.request.params.get('page')).toBe('0');
    req.flush({ ...pagina0, paginaActual: 0 });

    c['buscar']('');
    const sin = http.expectOne((r) => r.url === `${base}/recepcion-planta`);
    expect(sin.request.params.has('busqueda')).toBe(false);
    sin.flush({ ...pagina0, paginaActual: 0 });
  });

  it('cambiarTamano y cambiarPagina piden lo indicado y no salen del rango', () => {
    const { c } = crear();
    c['cambiarPagina'](9);
    c['cambiarPagina'](-1);
    http.expectNone((r) => r.url === `${base}/recepcion-planta`);
    c['cambiarTamano'](50);
    const req = http.expectOne((r) => r.url === `${base}/recepcion-planta`);
    expect(req.request.params.get('size')).toBe('50');
    expect(req.request.params.get('page')).toBe('0');
    req.flush({ ...pagina0, paginaActual: 0 });
  });

  it('conserva el error 403 en vez de una lista vacía', () => {
    const f = TestBed.createComponent(RecepcionPage);
    http.expectOne(`${base}/unidades/operativo`).flush([]);
    http.expectOne((r) => r.url === `${base}/recepcion-planta`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(f.componentInstance['error']()?.status).toBe(403);
  });

  it('"Ver detalle" abre RecepcionDetalleDialog con la fila y la placa resueltas', () => {
    const { c } = crear();
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    c['verDetalle'](recepcion1);
    expect(abrirSpy.mock.calls[0][0]).toBe(RecepcionDetalleDialog);
    expect((abrirSpy.mock.calls[0][1] as { data: { recepcion: RecepcionPlanta; placa: string } }).data).toEqual({
      recepcion: recepcion1,
      placa: 'ABC-123',
    });
  });
});
