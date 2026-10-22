import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { Subject } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { CatalogosPage } from './catalogos-page';
import { ProductoFormDialog } from '../../ui/producto-form-dialog/producto-form-dialog';
import { PresentacionesDialog } from '../../ui/presentaciones-dialog/presentaciones-dialog';
import { ControlVencimientoDialog } from '../../../vencimiento/ui/control-vencimiento-dialog/control-vencimiento-dialog';
import { ProductoResponse } from '../../data-access/producto.models';
import { RecetaResponse } from '../../data-access/receta.models';
import { RecetaFormDialog } from '../../ui/receta-form-dialog/receta-form-dialog';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

const base = environment.apiBaseUrl;

function productoConId(id: string): ProductoResponse {
  return {
    id, nombre: 'Yogurt de fresa', familiaId: 'f-1', familiaNombre: 'Yogurt',
    rendimientoEsperadoPct: null, cicloCapital: null, activo: true, presentaciones: []
  };
}

/** Sustituto de Dialog: registra cada apertura (componente + data) y expone cerrarUltima() para simular
 *  el cierre del último diálogo abierto -- así se puede verificar que un segundo diálogo solo se abre
 *  DESPUÉS de que el primero cerró (nunca simultáneamente apilados). */
class DialogFalso {
  readonly aperturas: Array<{ componente: unknown; data: unknown }> = [];
  private cierres: Array<Subject<unknown>> = [];

  open(componente: unknown, config: { data?: unknown }) {
    this.aperturas.push({ componente, data: config?.data });
    const cierre$ = new Subject<unknown>();
    this.cierres.push(cierre$);
    return { closed: cierre$.asObservable() } as ReturnType<Dialog['open']>;
  }

  cerrarUltima(resultado: unknown): void {
    this.cierres[this.cierres.length - 1].next(resultado);
  }
}

function crear(queryParams: Record<string, string> = {}, recetas: RecetaResponse[] = []) {
  const dialogFalso = new DialogFalso();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: Dialog, useValue: dialogFalso },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const page = TestBed.createComponent(CatalogosPage).componentInstance;
  http.expectOne(`${base}/admin/zonas`).flush([]);
  http.expectOne(`${base}/admin/motivos-observacion`).flush([]);
  http.expectOne(`${base}/admin/familias`).flush([]);
  http.expectOne(`${base}/admin/productos`).flush([]);
  http.expectOne(`${base}/admin/insumos`).flush([]);
  http.expectOne((r) => r.url === `${base}/recetas` && r.params.get('incluirInactivas') === 'true').flush(recetas);
  http.expectOne(`${base}/admin/configuracion`).flush([]);
  return { page, http, dialogFalso };
}

function receta(activo = true): RecetaResponse {
  return {
    id: 'r-1', nombre: 'Receta estándar', productoId: 'p-1', productoNombre: 'Queso Andino',
    presentacionId: 'pr-1', presentacionNombre: 'Pieza', unidadConteo: 'pieza', litrosBase: 100,
    rendimientoBase: 1, activo,
    insumos: [{ insumoId: 'i-1', insumoNombre: 'Cuajo', unidadMedida: 'g', cantidad: 1, insumoActivo: true }]
  };
}

describe('CatalogosPage', () => {
  it('nuevoProducto() abre solo ProductoFormDialog -- sin producto en los datos (modo creación)', () => {
    const { page, dialogFalso } = crear();
    page['nuevoProducto']();
    expect(dialogFalso.aperturas.length).toBe(1);
    expect(dialogFalso.aperturas[0].componente).toBe(ProductoFormDialog);
    expect(dialogFalso.aperturas[0].data).toEqual({});
  });

  it('al crear un producto, abre PresentacionesDialog DESPUÉS de que ProductoFormDialog cerró -- nunca apilados', () => {
    const { page, http, dialogFalso } = crear();
    page['nuevoProducto']();
    expect(dialogFalso.aperturas.length).toBe(1); // todavía no se abrió el segundo

    dialogFalso.cerrarUltima({ producto: productoConId('p-1'), esNuevo: true });
    http.expectOne(`${base}/admin/productos`).flush([productoConId('p-1')]); // recarga tras crear

    expect(dialogFalso.aperturas.length).toBe(2); // el segundo se abrió recién ahora, no antes
    expect(dialogFalso.aperturas[1].componente).toBe(PresentacionesDialog);
    expect(dialogFalso.aperturas[1].data).toEqual({ producto: productoConId('p-1'), recienCreado: true });
  });

  it('si el usuario cancela ProductoFormDialog (sin resultado), no abre PresentacionesDialog ni recarga', () => {
    const { page, dialogFalso } = crear();
    page['nuevoProducto']();
    dialogFalso.cerrarUltima(undefined);
    expect(dialogFalso.aperturas.length).toBe(1); // no se abrió un segundo diálogo
  });

  it('editarProducto() NO abre PresentacionesDialog al terminar -- editar y gestionar presentaciones son acciones separadas', () => {
    const { page, http, dialogFalso } = crear();
    page['editarProducto'](productoConId('p-1'));
    dialogFalso.cerrarUltima({ producto: productoConId('p-1'), esNuevo: false });
    http.expectOne(`${base}/admin/productos`).flush([productoConId('p-1')]);

    expect(dialogFalso.aperturas.length).toBe(1); // solo el diálogo de edición, ninguno más
  });

  it('abrirPresentaciones() desde la acción "Presentaciones" del catálogo abre PresentacionesDialog directamente, sin recienCreado', () => {
    const { page, dialogFalso } = crear();
    page['abrirPresentaciones'](productoConId('p-1'));
    expect(dialogFalso.aperturas[0].componente).toBe(PresentacionesDialog);
    expect(dialogFalso.aperturas[0].data).toEqual({ producto: productoConId('p-1'), recienCreado: false });
  });

  it('Fase 2: abrirControlVencimiento() abre ControlVencimientoDialog solo para ese producto, sin pedir nada al servidor desde la página', () => {
    const { page, http, dialogFalso } = crear();
    page['abrirControlVencimiento'](productoConId('p-1'));
    expect(dialogFalso.aperturas.length).toBe(1);
    expect(dialogFalso.aperturas[0].componente).toBe(ControlVencimientoDialog);
    expect(dialogFalso.aperturas[0].data).toEqual({ productoId: 'p-1', productoNombre: productoConId('p-1').nombre });
    http.verify();
  });

  it('al cerrar PresentacionesDialog con cambios, recarga el catálogo de productos', () => {
    const { page, http, dialogFalso } = crear();
    page['abrirPresentaciones'](productoConId('p-1'));
    dialogFalso.cerrarUltima(true);
    http.expectOne(`${base}/admin/productos`).flush([productoConId('p-1')]);
  });

  it('al cerrar PresentacionesDialog sin cambios, no vuelve a pedir el catálogo', () => {
    const { page, http, dialogFalso } = crear();
    page['abrirPresentaciones'](productoConId('p-1'));
    dialogFalso.cerrarUltima(false);
    http.verify(); // ninguna petición nueva pendiente
  });

  // --- Recetas (V18) ---

  it('?pestana=recetas abre directamente la pestaña de recetas; un valor desconocido cae en zonas', () => {
    expect(crear({ pestana: 'recetas' }).page['pestana']()).toBe('recetas');
    TestBed.resetTestingModule();
    expect(crear({ pestana: 'inventada' }).page['pestana']()).toBe('zonas');
  });

  it('lista recetas activas e inactivas (la API sí permite reactivarlas) y resume sus insumos', () => {
    const { page } = crear({}, [receta(true), receta(false)]);
    expect(page['recetas']().length).toBe(2);
    expect(page['resumenInsumos'](receta())).toBe('1 g Cuajo');
    expect(page['resumenInsumos']({ ...receta(), insumos: [] })).toBe('Solo leche');
  });

  it('nuevaReceta() abre RecetaFormDialog con productos e insumos ya cargados y recarga al crear', () => {
    const { page, http, dialogFalso } = crear();
    page['nuevaReceta']();
    expect(dialogFalso.aperturas[0].componente).toBe(RecetaFormDialog);
    expect(dialogFalso.aperturas[0].data).toEqual({ productos: [], insumos: [] });
    dialogFalso.cerrarUltima(receta());
    http.expectOne((r) => r.url === `${base}/recetas`).flush([receta()]);
  });

  it('cada catálogo se busca sobre todos sus registros, sin distinguir mayúsculas ni acentos', () => {
    const { page, http } = crear();
    page['cargarProductos']();
    http.expectOne(`${base}/admin/productos`).flush([
      { ...productoConId('p-1'), nombre: 'Queso Andino', familiaNombre: 'Quesos' },
      { ...productoConId('p-2'), nombre: 'Yogurt de fresa', familiaNombre: 'Yogurt' },
      { ...productoConId('p-3'), nombre: 'Mantequilla', familiaNombre: 'Lácteos' }
    ]);
    page['listaProductos'].cambiarTamano(1);
    page['listaProductos'].buscar('LACTEOS');
    expect(page['listaProductos'].filtradas().map((p: ProductoResponse) => p.id)).toEqual(['p-3']);
    expect(page['listaProductos'].totalElementos()).toBe(1);
    page['listaProductos'].buscar('');
    expect(page['listaProductos'].totalPaginas()).toBe(3);
  });

  it('el producto recién creado se muestra (en su página) y se resalta tras recargar', () => {
    const { page, http, dialogFalso } = crear();
    page['cargarProductos']();
    http.expectOne(`${base}/admin/productos`).flush([productoConId('p-1'), productoConId('p-2')]);
    page['listaProductos'].cambiarTamano(1);

    page['nuevoProducto']();
    dialogFalso.cerrarUltima({ producto: { ...productoConId('p-2'), nombre: 'Nuevo' }, esNuevo: false });
    http.expectOne(`${base}/admin/productos`).flush([productoConId('p-1'), productoConId('p-2')]);

    expect(page['listaProductos'].paginaActual()).toBe(1);
    expect(page['listaProductos'].esResaltada(productoConId('p-2'))).toBe(true);
    expect(page['listaProductos'].esResaltada(productoConId('p-1'))).toBe(false);
  });

  it('reactivarReceta() usa PATCH /recetas/{id}/reactivar y recarga', () => {
    const { page, http } = crear({}, [receta(false)]);
    page['reactivarReceta'](receta(false));
    const req = http.expectOne(`${base}/recetas/r-1/reactivar`);
    expect(req.request.method).toBe('PATCH');
    req.flush(receta(true));
    http.expectOne((r) => r.url === `${base}/recetas`).flush([receta(true)]);
  });

  it('desactivarReceta() pide confirmación antes de llamar a DELETE', () => {
    const { page, http, dialogFalso } = crear({}, [receta()]);
    page['desactivarReceta'](receta());
    http.expectNone(`${base}/recetas/r-1`);
    dialogFalso.cerrarUltima(true);
    const req = http.expectOne(`${base}/recetas/r-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    http.expectOne((r) => r.url === `${base}/recetas`).flush([]);
  });

  it('tras un error de carga, un reintento exitoso limpia el error (la tabla vuelve a mostrar los datos)', () => {
    const { page, http } = crear();
    page['cargarProductos']();
    http.expectOne(`${base}/admin/productos`).flush({ mensaje: 'caído' }, { status: 500, statusText: 'Server Error' });
    expect(page['errorProductos']()).not.toBeNull();

    page['cargarProductos']();
    expect(page['errorProductos']()).toBeNull(); // se limpia al empezar a recargar
    http.expectOne(`${base}/admin/productos`).flush([productoConId('p-1')]);

    expect(page['errorProductos']()).toBeNull();
    expect(page['productos']().length).toBe(1);
  });

  it('si el producto se guardó pero la foto falló, avisa con un toast de error y recarga igualmente', () => {
    const { page, http, dialogFalso } = crear();
    const espia = vi.spyOn(TestBed.inject(ToastService), 'error');

    page['nuevoProducto']();
    dialogFalso.cerrarUltima({ producto: productoConId('p-1'), esNuevo: false, errorFoto: 'Formato no permitido' });

    expect(espia).toHaveBeenCalledWith(expect.stringContaining('Formato no permitido'));
    http.expectOne(`${base}/admin/productos`).flush([]);
  });
});
