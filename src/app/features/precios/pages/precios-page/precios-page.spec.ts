import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { PreciosPage } from './precios-page';
import { PrecioLitroResponse } from '../../data-access/precio.models';
import { FilaPrecioPresentacionResponse } from '../../data-access/precio-queso.models';
import { FamiliaResponse } from '../../../catalogos/data-access/familia.models';
import { PaginaResponse } from '../../../../shared/models/pagina-response';

const base = environment.apiBaseUrl;

function isoHaceDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function paginaCon(contenido: FilaPrecioPresentacionResponse[], datos: Partial<PaginaResponse<FilaPrecioPresentacionResponse>> = {}): PaginaResponse<FilaPrecioPresentacionResponse> {
  return { contenido, paginaActual: 0, tamanoPagina: 20, totalElementos: contenido.length, totalPaginas: 1, ...datos };
}

function fila(datos: Partial<FilaPrecioPresentacionResponse> & { productoId: string; productoNombre: string }): FilaPrecioPresentacionResponse {
  return {
    familiaId: 'fam-1',
    familiaNombre: 'Yogures',
    presentacionId: null,
    presentacionNombre: null,
    mayorista: { estado: 'SIN_PRECIO', precio: null, vigenteDesde: null },
    proveedor: { estado: 'SIN_PRECIO', precio: null, vigenteDesde: null },
    publico: { estado: 'SIN_PRECIO', precio: null, vigenteDesde: null },
    porTipo: {},
    ...datos
  };
}

describe('PreciosPage', () => {
  let http: HttpTestingController;
  let page: PreciosPage;

  /** Flushea las 3 peticiones que dispara el constructor: leche, familias y la página inicial de
   *  productos -- las tres son independientes entre sí (no anidadas), así que el orden no importa. */
  function flushCargaInicial(
    preciosLitro: PrecioLitroResponse[],
    familias: FamiliaResponse[],
    paginaQueso: PaginaResponse<FilaPrecioPresentacionResponse>
  ): void {
    flushLeche(preciosLitro);
    http.expectOne(`${base}/admin/familias`).flush(familias);
    http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`).flush(paginaQueso);
  }

  /** Histórico de leche (paginado) + precio vigente (endpoint propio). */
  function flushLeche(preciosLitro: PrecioLitroResponse[], vigente: PrecioLitroResponse | null = null, total = preciosLitro.length): void {
    const req = http.expectOne((r) => r.url === `${base}/admin/precios-litro`);
    req.flush({ contenido: preciosLitro, paginaActual: Number(req.request.params.get('page')), tamanoPagina: 20, totalElementos: total, totalPaginas: Math.ceil(total / 20) });
    http.expectOne(`${base}/admin/precios-litro/vigente`).flush(vigente);
  }

  function flushCargaInicialCon(preciosLitro: PrecioLitroResponse[], vigente: PrecioLitroResponse | null): void {
    flushLeche(preciosLitro, vigente);
    http.expectOne(`${base}/admin/familias`).flush([]);
    http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`).flush(paginaCon([]));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    page = TestBed.createComponent(PreciosPage).componentInstance;
    http.expectOne((r) => r.url.endsWith('/tipos-precio')).flush([{ codigo: 'MAYORISTA', nombre: 'Mayorista', descripcion: '', activo: true, protegido: false, reglaComprador: 'CLIENTE_HABILITADO', ultimoCambio: null }, { codigo: 'PROVEEDOR', nombre: 'Proveedor', descripcion: '', activo: true, protegido: false, reglaComprador: 'PROVEEDOR_PADRON', ultimoCambio: null }, { codigo: 'PUBLICO', nombre: 'Público', descripcion: '', activo: true, protegido: false, reglaComprador: 'CUALQUIERA', ultimoCambio: null }]);
  });

  afterEach(() => http.verify());

  it('toma el precio vigente del servidor (no de la página visible) y distingue anteriores/programados', () => {
    const precios: PrecioLitroResponse[] = [
      { id: 'p-futuro', precio: 2.5, vigenteDesde: isoHaceDias(30) },
      { id: 'p-viejo', precio: 2.1, vigenteDesde: isoHaceDias(-60) }
    ];
    // El vigente real está en otra página del histórico: la página visible no lo contiene.
    const vigente: PrecioLitroResponse = { id: 'p-actual', precio: 2.3, vigenteDesde: isoHaceDias(-10) };
    flushCargaInicialCon(precios, vigente);

    expect(page['precioVigente']()?.id).toBe('p-actual');
    expect(page['estadoDe'](vigente)).toBe('Vigente');
    expect(page['estadoDe'](precios[0])).toBe('Programado');
    expect(page['estadoDe'](precios[1])).toBe('Anterior');
  });

  it('sin precio vigente (204) oculta la tarjeta sin romper el histórico', () => {
    flushCargaInicialCon([{ id: 'p-futuro', precio: 2.5, vigenteDesde: isoHaceDias(30) }], null);
    expect(page['precioVigente']()).toBeNull();
    expect(page['historial']().length).toBe(1);
  });

  it('pagina el histórico de leche en el servidor y conserva el orden recibido', () => {
    const precios: PrecioLitroResponse[] = [
      { id: 'p-2', precio: 2.2, vigenteDesde: '2026-07-01' },
      { id: 'p-1', precio: 2.1, vigenteDesde: '2026-03-01' }
    ];
    flushLeche(precios, null, 45);
    http.expectOne(`${base}/admin/familias`).flush([]);
    http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`).flush(paginaCon([]));

    expect(page['historial']().map((p: PrecioLitroResponse) => p.id)).toEqual(['p-2', 'p-1']);
    expect(page['totalElementosLeche']()).toBe(45);
    expect(page['totalPaginasLeche']()).toBe(3);

    page['cambiarPaginaLeche'](1);
    const req = http.expectOne((r) => r.url === `${base}/admin/precios-litro`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('20');
    req.flush({ contenido: [], paginaActual: 1, tamanoPagina: 20, totalElementos: 45, totalPaginas: 3 });
    http.expectOne(`${base}/admin/precios-litro/vigente`).flush(null);

    page['cambiarPaginaLeche'](-5);
    page['cambiarPaginaLeche'](9);
    http.expectNone((r) => r.url === `${base}/admin/precios-litro`);

    page['cambiarTamanoLeche'](10);
    const conTamano = http.expectOne((r) => r.url === `${base}/admin/precios-litro`);
    expect(conTamano.request.params.get('size')).toBe('10');
    expect(conTamano.request.params.get('page')).toBe('0');
    conTamano.flush({ contenido: [], paginaActual: 0, tamanoPagina: 10, totalElementos: 45, totalPaginas: 5 });
    http.expectOne(`${base}/admin/precios-litro/vigente`).flush(null);
  });

  it('carga la primera página de productos al iniciar, con tamaño de página por defecto', () => {
    flushLeche([]);
    http.expectOne(`${base}/admin/familias`).flush([]);
    const req = http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.has('familiaId')).toBe(false);
    expect(req.request.params.has('busqueda')).toBe(false);
    req.flush(paginaCon([]));
  });

  it('el filtro de familia reinicia a la primera página y se envía al servidor', () => {
    flushCargaInicial([], [{ id: 'fam-1', nombre: 'Queso', activo: true }], paginaCon([]));
    page['pagina'].set(3);

    page['cambiarFamilia']('fam-1');

    expect(page['pagina']()).toBe(0);
    const req = http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`);
    expect(req.request.params.get('familiaId')).toBe('fam-1');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(paginaCon([]));
  });

  // El debounce vive en ui-buscador (buscador.spec.ts); aquí se prueba qué hace la página con el texto.
  it('la búsqueda reinicia a la primera página, viaja al servidor y cancela la consulta anterior', () => {
    flushCargaInicial([], [], paginaCon([]));
    page['pagina'].set(2);

    page['buscar']('bot');
    page['buscar']('botella'); // la anterior sigue en vuelo: se cancela

    expect(page['pagina']()).toBe(0);
    const pendientes = http.match((r) => r.url === `${base}/admin/precios-queso/presentaciones`);
    expect(pendientes).toHaveLength(2);
    expect(pendientes[0].cancelled).toBe(true);
    expect(pendientes[1].request.params.get('busqueda')).toBe('botella');
    pendientes[1].flush(paginaCon([]));
  });

  it('vaciar la búsqueda quita el parámetro', () => {
    flushCargaInicial([], [], paginaCon([]));
    page['buscar']('botella');
    http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`).flush(paginaCon([]));
    page['buscar']('');
    const req = http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`);
    expect(req.request.params.has('busqueda')).toBe(false);
    req.flush(paginaCon([]));
  });

  it('cambiar el tamaño de página reinicia a la primera página', () => {
    flushCargaInicial([], [], paginaCon([]));
    page['pagina'].set(2);

    page['cambiarTamanoPagina'](50);

    expect(page['pagina']()).toBe(0);
    const req = http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`);
    expect(req.request.params.get('size')).toBe('50');
    req.flush(paginaCon([]));
  });

  it('cambiarPaginaQueso respeta los límites (no retrocede antes de 0 ni avanza más allá del total)', () => {
    flushCargaInicial([], [], paginaCon([], { totalPaginas: 2 }));

    page['cambiarPaginaQueso'](-1);
    expect(page['pagina']()).toBe(0);
    http.expectNone((r) => r.url === `${base}/admin/precios-queso/presentaciones`);

    page['cambiarPaginaQueso'](1);
    expect(page['pagina']()).toBe(1);
    http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`).flush(paginaCon([], { totalPaginas: 2, paginaActual: 1 }));

    page['cambiarPaginaQueso'](2);
    expect(page['pagina']()).toBe(1); // no existe la página 3
  });

  it('un producto activo sin presentaciones llega representado por una fila con presentacionId null', () => {
    const filaSinPresentaciones = fila({ productoId: 'p-2', productoNombre: 'Nuevo producto' });
    flushCargaInicial([], [], paginaCon([filaSinPresentaciones]));

    expect(page['filas']()).toEqual([filaSinPresentaciones]);
    expect(page['identificarFilaPresentacion'](filaSinPresentaciones)).toBe('sin-presentacion:p-2');
  });

  it('formatearFecha muestra dd/mm/aaaa a partir de una fecha ISO', () => {
    flushCargaInicial([], [], paginaCon([]));
    expect(page['formatearFecha']('2026-09-18')).toBe('18/09/2026');
  });

  it('un error de servidor en la tabla principal se distingue de una página vacía sin resultados', () => {
    flushLeche([]);
    http.expectOne(`${base}/admin/familias`).flush([]);
    http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`).flush(
      { mensaje: 'Error de servidor' },
      { status: 500, statusText: 'Server Error' }
    );

    expect(page['errorQueso']()).toBeTruthy();
    expect(page['filas']()).toEqual([]);

    page['cargarQueso']();
    http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`).flush(paginaCon([]));
    expect(page['errorQueso']()).toBeNull();
    expect(page['filas']()).toEqual([]); // ahora es "sin resultados", no un error
  });

  it('después de registrar un precio, recarga la página actual conservando familia/búsqueda/página', () => {
    {
      flushCargaInicial([], [{ id: 'fam-1', nombre: 'Queso', activo: true }], paginaCon([]));
      page['cambiarFamilia']('fam-1');
      http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`).flush(paginaCon([]));
      page['buscar']('botella');
      http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`).flush(paginaCon([]));

      const dialog = TestBed.inject(Dialog);
      let cerrado!: (resultado: unknown) => void;
      const abrirSpy = vi
        .spyOn(dialog, 'open')
        .mockImplementation(() => ({ closed: { subscribe: (fn: (r: unknown) => void) => (cerrado = fn) } }) as never);

      const filaConPresentacion = fila({
        productoId: 'p-1', productoNombre: 'Yogurt', presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L'
      });
      page['registrarPrecioPresentacion'](filaConPresentacion);
      expect(abrirSpy).toHaveBeenCalledTimes(1);

      cerrado({
        id: 'pq-1', presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoId: 'p-1',
        productoNombre: 'Yogurt', modalidad: 'PUBLICO', precio: 12, vigenteDesde: '2026-09-18'
      });

      const req = http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`); // recarga tras registrar
      expect(req.request.params.get('familiaId')).toBe('fam-1');
      expect(req.request.params.get('busqueda')).toBe('botella');
      req.flush(paginaCon([]));
    }
  });

  it('un error al cargar familias no bloquea la tabla principal', () => {
    flushLeche([]);
    http.expectOne(`${base}/admin/familias`).flush({}, { status: 500, statusText: 'Server Error' });
    http.expectOne((r) => r.url === `${base}/admin/precios-queso/presentaciones`).flush(paginaCon([]));

    expect(page['errorFamilias']()).toBe(true);
    expect(page['errorQueso']()).toBeNull();
  });

  it('etiquetaModalidad traduce las tres modalidades', () => {
    flushCargaInicial([], [], paginaCon([]));
    expect(page['etiquetaModalidad']('PUBLICO')).toBe('Público');
    expect(page['etiquetaModalidad']('MAYORISTA')).toBe('Mayorista');
    expect(page['etiquetaModalidad']('PROVEEDOR')).toBe('Proveedor');
  });
});
