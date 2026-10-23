import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { TokenStoreService } from '../../../../core/auth/token-store.service';
import { UsuarioMeResponse } from '../../../../core/auth/auth.models';
import { LotesPage } from './lotes-page';
import { LoteDetalleDialog } from '../../ui/lote-detalle-dialog/lote-detalle-dialog';
import { RegistrarLoteDialog } from '../../ui/registrar-lote-dialog/registrar-lote-dialog';
import { ProduccionMultipleDialog, ProduccionMultipleResultado } from '../../ui/produccion-multiple-dialog/produccion-multiple-dialog';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { PaginaResponse } from '../../../../shared/models/pagina-response';
import { LoteProduccion } from '../../data-access/lote-produccion.models';

const base = environment.apiBaseUrl;

function usuarioCon(rolNombre: UsuarioMeResponse['rolNombre']): UsuarioMeResponse {
  return { id: 'u-1', nombre: 'Ana', email: 'ana@ecolacteos.pe', rolNombre, activo: true, unidadesResponsable: [] };
}

const lote1: LoteProduccion = {
  id: 'l1',
  fecha: '2026-09-17',
  productoId: 't1', productoNombre: 'Fresco',
  litrosUsados: 100,
  detalles: [{ presentacionId: 'pr1', presentacionNombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza', cantidadObtenida: 12 }],
  rendimientoPct: 12,
  rendimientoEsperadoPct: 15,
  registroAcopioIds: [],
  unidadesEsperadas: 15,
  rendimientoEsperadoPctSnapshot: 15,
  recepcionesConsumidas: [{ recepcionPlantaId: 'rp1', litrosConsumidos: 100 }],
};

const pagina0: PaginaResponse<LoteProduccion> = {
  contenido: [lote1],
  paginaActual: 0,
  tamanoPagina: 20,
  totalElementos: 1,
  totalPaginas: 1
};

/** El saldo de leche se pide en el constructor, independiente del listado/catálogo -- se resuelve aparte en
 *  cada test para no acoplar el orden de las tres peticiones iniciales. */
function flushSaldoLeche(http: HttpTestingController, litros = 200) {
  http.expectOne(`${base}/inventario/leche/saldo`).flush({ litrosDisponibles: litros });
}

describe('LotesPage', () => {
  let http: HttpTestingController;
  let tokenStore: TokenStoreService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    tokenStore = TestBed.inject(TokenStoreService);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('ADMIN carga el catálogo de tipos de queso desde /admin/productos', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(LotesPage);
    http.expectOne(`${base}/admin/productos`).flush([{ id: 't1', nombre: 'Fresco', rendimientoEsperadoPct: 15, cicloCapital: 'RAPIDO', activo: true }]);
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
    flushSaldoLeche(http);
    f.detectChanges();
    expect(f.componentInstance['productos']().length).toBe(1);
  });

  it('PRODUCCION carga el catálogo desde /sync/cambios, no desde /admin', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('PRODUCCION') });
    TestBed.createComponent(LotesPage);
    http.expectOne(`${base}/sync/cambios`).flush({ productos: [{ id: 't1', nombre: 'Fresco', rendimientoEsperadoPct: 15, cicloCapital: 'RAPIDO', activo: true }] });
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
    flushSaldoLeche(http);
  });

  it('carga la primera página sin filtros', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(LotesPage);
    http.expectOne(`${base}/admin/productos`).flush([]);
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
    flushSaldoLeche(http);
    expect(f.componentInstance['lotes']().length).toBe(1);
    expect(f.componentInstance['totalElementos']()).toBe(1);
  });

  it('muestra la leche disponible consultada al entrar a la página', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(LotesPage);
    http.expectOne(`${base}/admin/productos`).flush([]);
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
    flushSaldoLeche(http, 275.5);
    expect(f.componentInstance['saldoLecheDisponible']()).toBe(275.5);
    expect(f.componentInstance['cargandoSaldoLeche']()).toBe(false);
  });

  it('un error al consultar la leche disponible no rompe el resto de la página', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(LotesPage);
    http.expectOne(`${base}/admin/productos`).flush([]);
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
    http.expectOne(`${base}/inventario/leche/saldo`).flush({}, { status: 500, statusText: 'Server Error' });
    expect(f.componentInstance['saldoLecheDisponible']()).toBeNull();
    expect(f.componentInstance['cargandoSaldoLeche']()).toBe(false);
  });

  it('cambiar fecha o tipo de queso reinicia la página a 0', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(LotesPage);
    http.expectOne(`${base}/admin/productos`).flush([]);
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
    flushSaldoLeche(http);

    f.componentInstance['pagina'].set(3);
    f.componentInstance['cambiarFiltroProducto']('t1');
    const req = http.expectOne((r) => r.url === `${base}/lotes-produccion`);
    expect(req.request.params.get('productoId')).toBe('t1');
    expect(req.request.params.get('page')).toBe('0');
    req.flush({ ...pagina0, paginaActual: 0 });
    expect(f.componentInstance['pagina']()).toBe(0);
  });

  it('buscar manda el texto al servidor junto a los filtros y vuelve a la página 0; vaciar lo quita', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(LotesPage);
    http.expectOne(`${base}/admin/productos`).flush([]);
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
    flushSaldoLeche(http);

    f.componentInstance['cambiarFiltroProducto']('t1');
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush({ ...pagina0, paginaActual: 0 });
    f.componentInstance['pagina'].set(2);
    f.componentInstance['buscar']('paín');
    const req = http.expectOne((r) => r.url === `${base}/lotes-produccion`);
    expect(req.request.params.get('busqueda')).toBe('paín');
    expect(req.request.params.get('productoId')).toBe('t1');
    expect(req.request.params.get('page')).toBe('0');
    req.flush({ ...pagina0, paginaActual: 0 });

    f.componentInstance['buscar']('');
    const sin = http.expectOne((r) => r.url === `${base}/lotes-produccion`);
    expect(sin.request.params.has('busqueda')).toBe(false);
    sin.flush({ ...pagina0, paginaActual: 0 });
  });

  it('cambiarTamano y cambiarPagina piden lo indicado y no salen del rango', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(LotesPage);
    http.expectOne(`${base}/admin/productos`).flush([]);
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
    flushSaldoLeche(http);

    f.componentInstance['cambiarPagina'](9);
    f.componentInstance['cambiarPagina'](-1);
    http.expectNone((r) => r.url === `${base}/lotes-produccion`);
    f.componentInstance['cambiarTamano'](10);
    const req = http.expectOne((r) => r.url === `${base}/lotes-produccion`);
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('page')).toBe('0');
    req.flush({ ...pagina0, paginaActual: 0 });
  });

  it('conserva el error 403 en vez de una lista vacía', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(LotesPage);
    http.expectOne(`${base}/admin/productos`).flush([]);
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush({}, { status: 403, statusText: 'Forbidden' });
    flushSaldoLeche(http);
    expect(f.componentInstance['error']()?.status).toBe(403);
  });

  it('"Ver detalle" abre LoteDetalleDialog con el id de la fila', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(LotesPage);
    http.expectOne(`${base}/admin/productos`).flush([]);
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
    flushSaldoLeche(http);

    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    f.componentInstance['abrirDetalle'](lote1);
    expect(abrirSpy.mock.calls[0][0]).toBe(LoteDetalleDialog);
    expect((abrirSpy.mock.calls[0][1] as { data: { id: string } }).data).toEqual({ id: 'l1' });
  });

  it('PRODUCCION también puede abrir "Registrar producción" (backend permite PRODUCCION y ADMIN por igual)', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('PRODUCCION') });
    const f = TestBed.createComponent(LotesPage);
    http.expectOne(`${base}/sync/cambios`).flush({ productos: [] });
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
    flushSaldoLeche(http);

    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    f.componentInstance['registrarProduccion']();
    expect(abrirSpy.mock.calls[0][0]).toBe(RegistrarLoteDialog);
  });

  it('"Registrar producción" con éxito recarga la primera página, refresca el saldo de leche y, si se pide, abre el detalle del lote creado', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(LotesPage);
    http.expectOne(`${base}/admin/productos`).flush([]);
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
    flushSaldoLeche(http, 200);
    f.componentInstance['pagina'].set(3);

    const dialog = TestBed.inject(Dialog);
    const loteCreado: LoteProduccion = { ...lote1, id: 'l2' };
    let cerrado!: (valor: { lote: LoteProduccion; verDetalle: boolean } | undefined) => void;
    const abrirSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValueOnce({ closed: { subscribe: (fn: typeof cerrado) => (cerrado = fn) } } as never)
      .mockReturnValue({ closed: { subscribe: () => undefined } } as never);

    f.componentInstance['registrarProduccion']();
    cerrado({ lote: loteCreado, verDetalle: true });

    expect(f.componentInstance['pagina']()).toBe(0);
    http.expectOne((r) => r.url === `${base}/lotes-produccion` && r.params.get('page') === '0').flush(pagina0);
    flushSaldoLeche(http, 120); // se consumió leche -- el indicador se refresca con el nuevo saldo
    expect(f.componentInstance['saldoLecheDisponible']()).toBe(120);
    expect(abrirSpy.mock.calls[1][0]).toBe(LoteDetalleDialog);
    expect((abrirSpy.mock.calls[1][1] as { data: { id: string } }).data).toEqual({ id: 'l2' });
  });

  // --- V18: producción desde receta ---

  function paginaInicialAdmin() {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(LotesPage);
    http.expectOne(`${base}/admin/productos`).flush([]);
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
    flushSaldoLeche(http);
    return f;
  }

  it('el filtro de estado se envía al backend y reinicia la página', () => {
    const f = paginaInicialAdmin();
    f.componentInstance['pagina'].set(2);
    f.componentInstance['cambiarFiltroEstado']('EN_PRODUCCION');
    const req = http.expectOne((r) => r.url === `${base}/lotes-produccion`);
    expect(req.request.params.get('estado')).toBe('EN_PRODUCCION');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(pagina0);
  });

  describe('"Nueva producción" (varias recetas)', () => {
    /** Abre el diálogo y devuelve una función para cerrarlo con el resultado que se indique. */
    function abrirNuevaProduccion() {
      const f = paginaInicialAdmin();
      const dialog = TestBed.inject(Dialog);
      const toast = TestBed.inject(ToastService);
      const exito = vi.spyOn(toast, 'exito');
      const error = vi.spyOn(toast, 'error');
      let cerrado!: (valor: ProduccionMultipleResultado | undefined) => void;
      const abrirSpy = vi
        .spyOn(dialog, 'open')
        .mockReturnValueOnce({ closed: { subscribe: (fn: typeof cerrado) => (cerrado = fn) } } as never)
        .mockReturnValue({ closed: { subscribe: () => undefined } } as never);

      f.componentInstance['nuevaProduccion']();
      expect(abrirSpy.mock.calls[0][0]).toBe(ProduccionMultipleDialog);
      return { f, cerrar: (r: ProduccionMultipleResultado | undefined) => cerrado(r), abrirSpy, exito, error };
    }

    const planificada = { ...lote1, id: 'l9', estado: 'PLANIFICADA' as const };

    it('si se cancela sin guardar nada, no avisa ni recarga el historial ni la leche', () => {
      const { cerrar, abrirSpy, exito, error } = abrirNuevaProduccion();

      cerrar(undefined);

      http.expectNone((r) => r.url === `${base}/lotes-produccion`);
      expect(exito).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(abrirSpy).toHaveBeenCalledTimes(1);
    });

    it('con una receta iniciada avisa, recarga historial y leche, y abre el detalle del lote', () => {
      const { cerrar, abrirSpy, exito } = abrirNuevaProduccion();

      cerrar({ lotes: [planificada], iniciar: true, completo: true });

      expect(exito).toHaveBeenCalledWith(`Producción de "${planificada.productoNombre}" iniciada: se descontaron leche e insumos.`);
      http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
      flushSaldoLeche(http);
      expect(abrirSpy).toHaveBeenCalledTimes(2);
      expect(abrirSpy.mock.calls[1][0]).toBe(LoteDetalleDialog);
      expect((abrirSpy.mock.calls[1][1] as { data: { id: string } }).data).toEqual({ id: 'l9' });
    });

    it('con una receta solo planificada lo dice así', () => {
      const { cerrar, exito } = abrirNuevaProduccion();

      cerrar({ lotes: [planificada], iniciar: false, completo: true });

      expect(exito).toHaveBeenCalledWith(`Producción de "${planificada.productoNombre}" guardada como planificada.`);
      http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
      flushSaldoLeche(http);
    });

    it('con varias recetas avisa con el total y no abre ningún detalle', () => {
      const { cerrar, abrirSpy, exito } = abrirNuevaProduccion();

      cerrar({ lotes: [planificada, { ...planificada, id: 'l10' }], iniciar: true, completo: true });

      expect(exito).toHaveBeenCalledWith('2 producciones iniciadas: se descontaron leche e insumos.');
      http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
      flushSaldoLeche(http);
      expect(abrirSpy).toHaveBeenCalledTimes(1);
    });

    it('si el proceso quedó incompleto avisa del error, actualiza lo guardado y no abre el detalle', () => {
      const { cerrar, abrirSpy, exito, error } = abrirNuevaProduccion();

      cerrar({ lotes: [planificada], iniciar: true, completo: false });

      expect(exito).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Quedaron guardados 1 lote, pero el proceso no terminó'));
      http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
      flushSaldoLeche(http);
      expect(abrirSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('si el detalle cambió el estado del lote (iniciar/finalizar/cancelar), recarga la lista y la leche', () => {
    const f = paginaInicialAdmin();
    const dialog = TestBed.inject(Dialog);
    let cerrado!: (valor: boolean) => void;
    vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: (fn: typeof cerrado) => (cerrado = fn) } } as never);

    f.componentInstance['abrirDetalle'](lote1);
    cerrado(true);
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush(pagina0);
    flushSaldoLeche(http, 50);
    expect(f.componentInstance['saldoLecheDisponible']()).toBe(50);
  });

  it('muestra esperado vs. obtenido y el estado; un lote en curso aparece como "Pendiente"', () => {
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(LotesPage);
    http.expectOne(`${base}/admin/productos`).flush([]);
    const enCurso: LoteProduccion = { ...lote1, id: 'l3', detalles: [], estado: 'EN_PRODUCCION', recetaNombre: 'Receta estándar', cantidadEsperada: 10 };
    http.expectOne((r) => r.url === `${base}/lotes-produccion`).flush({ ...pagina0, contenido: [lote1, enCurso], totalElementos: 2 });
    flushSaldoLeche(http);
    f.detectChanges();
    const texto = f.nativeElement.textContent;
    expect(texto).toContain('En producción');
    expect(texto).toContain('Pendiente');
    expect(texto).toContain('Finalizada'); // lote1 sin campo estado = lote de un solo paso
    expect(texto).toContain('Receta estándar');
  });
});

