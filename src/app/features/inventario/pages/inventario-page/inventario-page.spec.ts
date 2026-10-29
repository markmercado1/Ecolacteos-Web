import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { TokenStoreService } from '../../../../core/auth/token-store.service';
import { UsuarioMeResponse } from '../../../../core/auth/auth.models';
import { InventarioPage } from './inventario-page';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { KardexDialog } from '../../ui/kardex-dialog/kardex-dialog';
import { IngresoDocumentoDialog } from '../../ui/ingreso-documento-dialog/ingreso-documento-dialog';

const url = `${environment.apiBaseUrl}/inventario/stock/presentaciones`;
const fila = { familiaId: 'f', familiaNombre: 'Yogurt', productoId: 'p', productoNombre: 'Natural', productoActivo: true, presentacionId: 'pr', presentacionNombre: 'Botella 1 L', unidadConteo: 'botella', presentacionActivo: true, stock: 12, controlaVencimiento: false, stockVendible: 12, stockComprometido: 0, stockLibre: 12 };
const respuesta = (paginaActual = 0, totalElementos = 1) => ({ contenido: [fila], paginaActual, tamanoPagina: 20, totalElementos, totalPaginas: Math.ceil(totalElementos / 20) });

function usuarioCon(rolNombre: UsuarioMeResponse['rolNombre']): UsuarioMeResponse {
  return { id: 'u-1', nombre: 'Ana', email: 'ana@ecolacteos.pe', rolNombre, activo: true, unidadesResponsable: [] };
}

/** Cada carga de insumos dispara tambien la consulta de alertas de vencimiento (sin alertas por defecto). */
function flushInsumos(h: HttpTestingController, datos: unknown, alertas: unknown = { diasAlerta: 15, porVencer: 0, vencidos: 0, lotes: [] }): void {
  h.expectOne(`${environment.apiBaseUrl}/inventario/insumos`).flush(datos as never);
  h.expectOne(`${environment.apiBaseUrl}/inventario/insumos/lotes/alertas`).flush(alertas as never);
}

describe('InventarioPage', () => {
  let http: HttpTestingController;
  let page: InventarioPage;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    page = TestBed.createComponent(InventarioPage).componentInstance;
    http.expectOne(`${environment.apiBaseUrl}/inventario/familias`).flush([
      { id: 'f', nombre: 'Yogurt', activo: true },
      { id: 'inactiva', nombre: 'Queso', activo: false }
    ]);
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
  });
  const peticion = () => http.expectOne(r => r.url === url);

  it('usa el contrato paginado por presentación y muestra el stock del servidor', () => {
    const req = peticion();
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    req.flush(respuesta());
    expect(page['stock']()).toEqual([fila]);
    expect(page['total']()).toBe(1);
    expect(page['cargando']()).toBe(false);
  });
  it('consulta otra página en el servidor y reinicia al cambiar tamaño', () => {
    peticion().flush(respuesta(0, 41));
    page['cambiarPagina'](1);
    const segunda = peticion();
    expect(segunda.request.params.get('page')).toBe('1');
    segunda.flush(respuesta(1, 41));
    page['cambiarTamano'](10);
    const nueva = peticion();
    expect(nueva.request.params.get('page')).toBe('0');
    expect(nueva.request.params.get('size')).toBe('10');
    nueva.flush({ ...respuesta(), tamanoPagina: 10 });
  });
  it('distingue errores de resultados vacíos y permite reintentar', () => {
    peticion().flush({ mensaje: 'Error interno inesperado' }, { status: 500, statusText: 'Internal Server Error' });
    expect(page['error']()?.mensaje).toBe('Error interno inesperado');
    expect(page['cargando']()).toBe(false);
    page['cargar']();
    peticion().flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
    expect(page['error']()).toBeNull();
    expect(page['total']()).toBe(0);
  });

  it('buscar manda el texto al servidor junto a la familia y vuelve a la página 0; vaciar lo quita', () => {
    peticion().flush(respuesta(0, 41));
    page['cambiarFamilia']('f');
    peticion().flush(respuesta(0, 41));
    page['cambiarPagina'](1);
    peticion().flush(respuesta(1, 41));

    page['buscar']('botella');
    const req = peticion();
    expect(req.request.params.get('busqueda')).toBe('botella');
    expect(req.request.params.get('familiaId')).toBe('f');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(respuesta());

    page['buscar']('');
    const sin = peticion();
    expect(sin.request.params.has('busqueda')).toBe(false);
    sin.flush(respuesta());
  });
  it('cancela consultas anteriores', () => {
    const anterior = peticion();
    page['cargar']();
    expect(anterior.cancelled).toBe(true);
    peticion().flush(respuesta());
  });
  it('renderiza producto, presentación y unidad sin mezclar sus saldos', () => {
    peticion().flush(respuesta());
    const fixture = TestBed.createComponent(InventarioPage);
    http.expectOne(`${environment.apiBaseUrl}/inventario/familias`).flush([]);
    peticion().flush({ ...respuesta(), contenido: [{ ...fila, presentacionActivo: false }] });
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Botella 1 L');
    expect(texto).toContain('Unidad de conteo: botella');
    expect(texto).toContain('Presentación inactiva');
  });

  it('filtra en servidor, reinicia la página y conserva la familia al cambiar tamaño', () => {
    peticion().flush(respuesta(0, 41));
    page['cambiarPagina'](1);
    peticion().flush(respuesta(1, 41));
    page['cambiarFamilia']('f');
    const filtrada = peticion();
    expect(filtrada.request.params.get('familiaId')).toBe('f');
    expect(filtrada.request.params.get('page')).toBe('0');
    filtrada.flush(respuesta());
    page['cambiarTamano'](10);
    const pequena = peticion();
    expect(pequena.request.params.get('familiaId')).toBe('f');
    pequena.flush({ ...respuesta(), tamanoPagina: 10 });
    page['cambiarFamilia']('');
    const todas = peticion();
    expect(todas.request.params.has('familiaId')).toBe(false);
    todas.flush(respuesta());
  });

  it('el fallo de familias permite consultar stock y reintentar el catálogo', () => {
    peticion().flush(respuesta());
    page['cargarFamilias']();
    http.expectOne(`${environment.apiBaseUrl}/inventario/familias`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    expect(page['errorFamilias']()).not.toBeNull();
    expect(page['stock']()).toEqual([fila]);
    page['cargarFamilias']();
    http.expectOne(`${environment.apiBaseUrl}/inventario/familias`).flush([]);
    expect(page['errorFamilias']()).toBeNull();
  });

  it('sin rol ADMIN la columna de acciones solo ofrece el kardex (V19), sin ajustes', () => {
    peticion().flush(respuesta());
    const f = TestBed.createComponent(InventarioPage);
    http.expectOne(`${environment.apiBaseUrl}/inventario/familias`).flush([]);
    http.expectOne((r) => r.url === url).flush(respuesta());
    f.detectChanges();
    expect(page['esAdmin']()).toBe(false);
    expect(page['columnas']().some((c) => c.clave === 'acciones')).toBe(true);
    const textos = Array.from(f.nativeElement.querySelectorAll('button')).map((b) => (b as HTMLElement).textContent?.trim());
    expect(textos).toContain('Kardex');
    expect(textos).not.toContain('Ajustar stock');
  });

  it('para ADMIN aparece la columna de acciones con "Ver ajustes" y "Ajustar stock"', () => {
    peticion().flush(respuesta());
    const tokenStore = TestBed.inject(TokenStoreService);
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });

    expect(page['esAdmin']()).toBe(true);
    expect(page['columnas']().some((c) => c.clave === 'acciones')).toBe(true);
  });

  it('ajustarStock() abre el diálogo con la fila seleccionada y recarga tras un ajuste exitoso', () => {
    peticion().flush(respuesta());
    const dialog = TestBed.inject(Dialog);
    let cerrado!: (resultado: unknown) => void;
    const abrirSpy = vi
      .spyOn(dialog, 'open')
      .mockImplementation(() => ({ closed: { subscribe: (fn: (r: unknown) => void) => (cerrado = fn) } }) as never);

    page['ajustarStock'](fila);

    expect(abrirSpy).toHaveBeenCalledTimes(1);
    expect(abrirSpy.mock.calls[0][1]?.data).toEqual({
      presentacionId: 'pr', presentacionNombre: 'Botella 1 L', productoNombre: 'Natural', stockActual: 12
    });

    cerrado({ id: 'aj-1', presentacionId: 'pr', cantidadAnterior: 12, cantidadCorregida: 10, delta: -2 });

    peticion().flush(respuesta()); // recarga la página actual tras el ajuste
  });

  it('ajustarStock() no recarga si el diálogo se cierra sin registrar nada', () => {
    peticion().flush(respuesta());
    const dialog = TestBed.inject(Dialog);
    let cerrado!: (resultado: unknown) => void;
    vi.spyOn(dialog, 'open').mockImplementation(() => ({ closed: { subscribe: (fn: (r: unknown) => void) => (cerrado = fn) } }) as never);

    page['ajustarStock'](fila);
    cerrado(undefined);

    http.expectNone(url);
  });

  it('Fase 2: una fila sin control de vencimiento no ofrece "Lotes y vencimientos" ni muestra stock vendible aparte', () => {
    peticion().flush(respuesta());
    const f = TestBed.createComponent(InventarioPage);
    http.expectOne(`${environment.apiBaseUrl}/inventario/familias`).flush([]);
    http.expectOne((r) => r.url === url).flush(respuesta());
    f.detectChanges();
    const textos = Array.from(f.nativeElement.querySelectorAll('button')).map((b) => (b as HTMLElement).textContent?.trim());
    expect(textos).not.toContain('Lotes y vencimientos');
    expect(f.nativeElement.textContent).not.toContain('Vendible');
    expect(f.nativeElement.textContent).not.toContain('Reservado');
    expect(f.nativeElement.textContent).not.toContain('Libre para vender');
  });

  it('Fase 2: una fila con control muestra lo vendible frente a lo físico y ofrece "Lotes y vencimientos"', () => {
    peticion().flush(respuesta());
    const controlada = { ...fila, stock: 100, controlaVencimiento: true, stockVendible: 70 };
    const f = TestBed.createComponent(InventarioPage);
    http.expectOne(`${environment.apiBaseUrl}/inventario/familias`).flush([]);
    http.expectOne((r) => r.url === url).flush({ ...respuesta(), contenido: [controlada] });
    f.detectChanges();
    const texto = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Vendible: 70');
    expect(texto).toContain('no vendible: 30');
    const textos = Array.from(f.nativeElement.querySelectorAll('button')).map((b) => (b as HTMLElement).textContent?.trim());
    expect(textos).toContain('Lotes y vencimientos');
  });

  it('Fase 5: distingue físico, vendible, reservado y libre para vender con los valores que informa el servidor', () => {
    peticion().flush(respuesta());
    const conReservas = { ...fila, stock: 100, controlaVencimiento: true, stockVendible: 70, stockComprometido: 60, stockLibre: 10 };
    const f = TestBed.createComponent(InventarioPage);
    http.expectOne(`${environment.apiBaseUrl}/inventario/familias`).flush([]);
    http.expectOne((r) => r.url === url).flush({ ...respuesta(), contenido: [conReservas] });
    f.detectChanges();
    const texto = ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
    expect(texto).toContain('Físico · Unidad de conteo: botella');
    expect(texto).toContain('Vendible: 70');
    expect(texto).toContain('Reservado: 60');
    expect(texto).toContain('Libre para vender: 10');
    // El libre NO se deriva en el cliente (70 - 60 sería 10 aquí, pero el servidor puede informar otro valor por los lotes).
    expect((f.nativeElement as HTMLElement).querySelector('.libre')?.classList.contains('sin-libre')).toBe(false);
  });

  it('Fase 5: sin unidades libres lo marca en rojo y con reservas resalta lo reservado', () => {
    peticion().flush(respuesta());
    const sinLibre = { ...fila, stock: 8, controlaVencimiento: true, stockVendible: 2, stockComprometido: 8, stockLibre: 0 };
    const f = TestBed.createComponent(InventarioPage);
    http.expectOne(`${environment.apiBaseUrl}/inventario/familias`).flush([]);
    http.expectOne((r) => r.url === url).flush({ ...respuesta(), contenido: [sinLibre] });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.libre')?.classList.contains('sin-libre')).toBe(true);
    expect(el.querySelector('.reservado')?.classList.contains('con-reservas')).toBe(true);
  });

  it('Fase 2: verLotes() abre el diálogo de la presentación (solo ADMIN puede regularizar) y recarga solo si hubo cambios', () => {
    peticion().flush(respuesta());
    const dialog = TestBed.inject(Dialog);
    let cerrado!: (resultado: unknown) => void;
    const abrirSpy = vi
      .spyOn(dialog, 'open')
      .mockImplementation(() => ({ closed: { subscribe: (fn: (r: unknown) => void) => (cerrado = fn) } }) as never);

    page['verLotes'](fila);

    expect(abrirSpy.mock.calls[0][1]?.data).toEqual({
      presentacionId: 'pr', presentacionNombre: 'Botella 1 L', productoNombre: 'Natural', puedeRegularizar: false
    });
    cerrado(false);
    http.expectNone(url);
    cerrado(true);
    peticion().flush(respuesta()); // tras una regularizacion recarga la tabla
  });

  it('verAjustes() abre el historial de solo esa presentación', () => {
    peticion().flush(respuesta());
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi
      .spyOn(dialog, 'open')
      .mockImplementation(() => ({ closed: { subscribe: () => {} } }) as never);

    page['verAjustes'](fila);

    expect(abrirSpy).toHaveBeenCalledTimes(1);
    expect(abrirSpy.mock.calls[0][1]?.data).toEqual({
      presentacionId: 'pr', presentacionNombre: 'Botella 1 L', productoNombre: 'Natural'
    });
  });
});

// ---- V19: kardex e insumos por rol ----

const insumoSal = { id: 'i-sal', nombre: 'Sal', unidadMedida: 'kg', activo: true, stock: 6 };

describe('InventarioPage — kardex e insumos', () => {
  let http: HttpTestingController;

  function crear(rol: UsuarioMeResponse['rolNombre'], queryParams: Record<string, string> = {}) {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } }
      ]
    });
    TestBed.inject(TokenStoreService).establecer({
      token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon(rol)
    });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(InventarioPage);
    http.expectOne(`${environment.apiBaseUrl}/inventario/familias`).flush([]);
    http.expectOne((r) => r.url === url).flush(respuesta());
    return f;
  }

  const textoBotones = (f: { nativeElement: HTMLElement }) =>
    Array.from(f.nativeElement.querySelectorAll('button')).map((b) => b.textContent?.trim());

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('VENTAS solo ve producto terminado: sin pestañas de insumos ni leche, pero con kardex del producto', () => {
    const f = crear('VENTAS', { seccion: 'insumos' });
    f.detectChanges();
    expect(f.componentInstance['veMateriasPrimas']()).toBe(false);
    expect(f.componentInstance['seccion']()).toBe('productos'); // ignora ?seccion=insumos
    const botones = textoBotones(f);
    expect(botones).not.toContain('Insumos');
    expect(botones).not.toContain('Leche');
    expect(botones).toContain('Kardex');
  });

  it('PRODUCCION ve insumos (cargados al entrar a la pestaña), registra ingresos y no ve "Conteo físico"', () => {
    const f = crear('PRODUCCION');
    f.componentInstance['cambiarSeccion']('insumos');
    flushInsumos(http, [insumoSal]);
    f.detectChanges();
    const botones = textoBotones(f);
    expect(botones).toContain('Registrar ingreso');
    expect(botones).toContain('Kardex y lotes');
    expect(botones).not.toContain('Conteo físico');
    for (const accion of ['Nuevo insumo', 'Editar', 'Desactivar', 'Registrar salida', 'Importar desde Excel']) expect(botones).not.toContain(accion);
  });

  /** Abre el menú «Más» de la primera fila y devuelve los elementos del menú (viven en el overlay, fuera de la tabla). */
  const abrirMenuMas = (f: { nativeElement: HTMLElement; detectChanges(): void }) => {
    const disparador = f.nativeElement.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
    disparador.click();
    f.detectChanges();
    return Array.from(document.querySelectorAll<HTMLButtonElement>('.ui-menu [cdkMenuItem]'));
  };

  it('ADMIN también puede hacer el conteo físico de insumos', () => {
    const f = crear('ADMIN', { seccion: 'insumos' });
    flushInsumos(http, [insumoSal]);
    f.detectChanges();
    // a la vista: las acciones principales; el resto, en el menú «Más»
    for (const accion of ['Kardex y lotes', 'Registrar ingreso', 'Nuevo insumo', 'Importar desde Excel']) expect(textoBotones(f)).toContain(accion);
    for (const accion of ['Conteo físico', 'Editar', 'Desactivar', 'Registrar salida']) expect(textoBotones(f)).not.toContain(accion);
    expect(abrirMenuMas(f).map((i) => i.textContent?.trim())).toEqual(['Registrar salida', 'Conteo físico', 'Editar', 'Desactivar']);
  });

  it('el menú «Más» de un insumo es accesible: tiene nombre propio, roles de menú, distingue Desactivar y se cierra con Escape', () => {
    const f = crear('ADMIN', { seccion: 'insumos' });
    flushInsumos(http, [insumoSal]);
    f.detectChanges();
    const disparador = (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
    expect(disparador.getAttribute('aria-label')).toBe(`Más acciones de ${insumoSal.nombre}`);

    const items = abrirMenuMas(f);
    expect(document.querySelector('.ui-menu')?.getAttribute('role')).toBe('menu');
    expect(items.every((i) => i.getAttribute('role') === 'menuitem')).toBe(true);
    expect(items.find((i) => i.textContent?.trim() === 'Desactivar')?.classList).toContain('peligro');
    expect(items.find((i) => i.textContent?.trim() === 'Editar')?.classList).not.toContain('peligro');
    expect(document.querySelector('.ui-menu [role="separator"]')).not.toBeNull();

    document.querySelector('.ui-menu')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    f.detectChanges();
    expect(document.querySelector('.ui-menu')).toBeNull();
  });

  it('elegir una acción del menú hace lo mismo que antes el botón (Editar abre el diálogo del insumo)', () => {
    const f = crear('ADMIN', { seccion: 'insumos' });
    flushInsumos(http, [insumoSal]);
    f.detectChanges();
    const editar = vi.spyOn(f.componentInstance as unknown as { editarInsumo: (i: unknown) => void }, 'editarInsumo').mockImplementation(() => undefined);
    abrirMenuMas(f).find((i) => i.textContent?.trim() === 'Editar')!.click();
    expect(editar).toHaveBeenCalledTimes(1);
  });

  it('un rol que no es ADMIN no ve el menú «Más» en la tabla de insumos', () => {
    const f = crear('PRODUCCION');
    f.componentInstance['cambiarSeccion']('insumos');
    flushInsumos(http, [insumoSal]);
    f.detectChanges();
    expect(f.nativeElement.querySelector('button[aria-haspopup="menu"]')).toBeNull();
  });

  it('un ingreso registrado recarga el stock de insumos', () => {
    const f = crear('PRODUCCION', { seccion: 'insumos' });
    flushInsumos(http, [insumoSal]);
    const dialog = TestBed.inject(Dialog);
    let cerrar!: (v: unknown) => void;
    const spy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: (fn: typeof cerrar) => (cerrar = fn) } } as never);

    f.componentInstance['movimientoInsumo'](insumoSal, 'INGRESO');
    // El ingreso por insumo es el modal de ingreso con documento, con la primera línea ya cargada.
    expect(spy.mock.calls[0][0]).toBe(IngresoDocumentoDialog);
    expect(spy.mock.calls[0][1]?.data).toEqual({ insumos: [insumoSal], insumoInicial: insumoSal });
    cerrar({ numeroDocumento: 'F001-1', lineas: [{ loteCodigo: 'SAL-20261029-01' }] });
    flushInsumos(http, [{ ...insumoSal, stock: 20 }]);
    expect(f.componentInstance['insumos']()[0].stock).toBe(20);
  });

  it('el kardex de una presentación abre KardexDialog con esa presentación', () => {
    const f = crear('VENTAS');
    const spy = vi.spyOn(TestBed.inject(Dialog), 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    f.componentInstance['verKardexPresentacion'](fila);
    expect(spy.mock.calls[0][0]).toBe(KardexDialog);
    expect(spy.mock.calls[0][1]?.data).toEqual(expect.objectContaining({ tipo: 'PRESENTACION', itemId: 'pr' }));
  });

  it('la pestaña Leche muestra el kardex de leche', () => {
    const f = crear('PRODUCCION', { seccion: 'leche' });
    f.detectChanges();
    const req = http.expectOne((r) => r.url === `${environment.apiBaseUrl}/inventario/kardex/leche`);
    req.flush({
      tipoItem: 'LECHE', itemId: null, itemNombre: 'Leche', unidadMedida: 'L', desde: null, hasta: null,
      saldoInicial: 0, totalEntradas: 1500, totalSalidas: 1000, saldoFinal: 500,
      movimientos: { contenido: [], paginaActual: 0, tamanoPagina: 50, totalElementos: 0, totalPaginas: 0 }
    });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Kardex de leche');
    expect(f.nativeElement.textContent).toContain('Saldo final');
  });
});
