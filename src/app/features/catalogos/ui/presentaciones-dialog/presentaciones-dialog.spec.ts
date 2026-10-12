import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { PresentacionesDialog, PresentacionesDialogData } from './presentaciones-dialog';
import { PresentacionResponse, ProductoResponse } from '../../data-access/producto.models';

const base = environment.apiBaseUrl;

function producto(presentaciones: PresentacionResponse[] = []): ProductoResponse {
  return {
    id: 'p-1', nombre: 'Yogurt de fresa', familiaId: 'f-1', familiaNombre: 'Yogurt',
    rendimientoEsperadoPct: null, cicloCapital: null, activo: true, presentaciones
  };
}

function presentacion(id: string, nombre = 'Botella de 1 L'): PresentacionResponse {
  return { id, productoId: 'p-1', nombre, contenidoCantidad: 1, contenidoUnidad: 'L', unidadConteo: 'Botella', activo: true };
}

function crear(data: PresentacionesDialogData) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const dialogRef = TestBed.inject(DialogRef) as unknown as { close: ReturnType<typeof vi.fn> };
  const f = TestBed.createComponent(PresentacionesDialog);
  return { f, http, c: f.componentInstance, dialogRef };
}

describe('PresentacionesDialog', () => {
  it('abre en la pantalla de lista, mostrando las presentaciones ya existentes del producto', () => {
    const { c } = crear({ producto: producto([presentacion('pr-1')]) });
    expect(c['paso']()).toBe('lista');
    expect(c['producto']().presentaciones.length).toBe(1);
  });

  it('abrirAgregar() cambia a la pantalla de formulario vacío -- nunca apila un segundo diálogo', () => {
    const { c } = crear({ producto: producto() });
    c['abrirAgregar']();
    expect(c['paso']()).toBe('formulario');
    expect(c['editando']()).toBeNull();
    expect(c['form'].getRawValue().nombre).toBe('');
  });

  it('volverALista() regresa sin guardar nada', () => {
    const { c, http } = crear({ producto: producto() });
    c['abrirAgregar']();
    c['form'].controls.nombre.setValue('Botella de 1 L');
    c['volverALista']();
    expect(c['paso']()).toBe('lista');
    http.verify(); // ninguna petición pendiente: nada se envió
  });

  it('guardar una presentación nueva hace POST anidado, actualiza la lista local y regresa a la lista', () => {
    const { c, http } = crear({ producto: producto() });
    c['abrirAgregar']();
    c['form'].setValue({ nombre: 'Botella de 1 L', contenidoCantidad: 1, contenidoUnidad: 'L', unidadConteo: 'Botella' });

    c['guardarPresentacion']();
    expect(c['enviando']()).toBe(true); // deshabilita el envío mientras se guarda

    const req = http.expectOne(`${base}/admin/productos/p-1/presentaciones`);
    expect(req.request.method).toBe('POST');
    req.flush(presentacion('pr-nueva'));

    expect(c['paso']()).toBe('lista');
    expect(c['producto']().presentaciones.map((p) => p.id)).toEqual(['pr-nueva']);
  });

  it('una "Pieza" sin contenido declarado no inventa ningún valor', () => {
    const { c, http } = crear({ producto: producto() });
    c['abrirAgregar']();
    c['form'].setValue({ nombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: '', unidadConteo: 'pieza' });

    c['guardarPresentacion']();
    const req = http.expectOne(`${base}/admin/productos/p-1/presentaciones`);
    expect(req.request.body).toEqual({ nombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza' });
    req.flush({ id: 'pr-2', productoId: 'p-1', nombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza', activo: true });
  });

  it('si falla guardar, conserva el formulario y el error, y NO crea el producto de nuevo (sin POST a /admin/productos)', () => {
    const { c, http, dialogRef } = crear({ producto: producto() });
    c['abrirAgregar']();
    c['form'].setValue({ nombre: 'Botella de 1 L', contenidoCantidad: 1, contenidoUnidad: 'L', unidadConteo: 'Botella' });

    c['guardarPresentacion']();
    http.expectOne(`${base}/admin/productos/p-1/presentaciones`).flush({ mensaje: 'Ya existe' }, { status: 409, statusText: 'Conflict' });

    expect(c['paso']()).toBe('formulario'); // se queda en el formulario, no vuelve a la lista
    expect(c['errorForm']()).toBeTruthy();
    expect(c['enviando']()).toBe(false);
    expect(c['form'].getRawValue().nombre).toBe('Botella de 1 L'); // datos conservados para reintentar
    expect(dialogRef.close).not.toHaveBeenCalled();
    http.verify(); // no se disparó ninguna otra petición (en particular, ninguna a /admin/productos)
  });

  it('reintentar tras un error reenvía la misma petición, sin duplicar la presentación creada previamente', () => {
    const { c, http } = crear({ producto: producto() });
    c['abrirAgregar']();
    c['form'].setValue({ nombre: 'Botella de 1 L', contenidoCantidad: 1, contenidoUnidad: 'L', unidadConteo: 'Botella' });
    c['guardarPresentacion']();
    http.expectOne(`${base}/admin/productos/p-1/presentaciones`).flush({}, { status: 500, statusText: 'Server Error' });

    c['guardarPresentacion'](); // reintento manual
    const req = http.expectOne(`${base}/admin/productos/p-1/presentaciones`);
    req.flush(presentacion('pr-nueva'));
    expect(c['producto']().presentaciones.length).toBe(1); // una sola, no duplicada
  });

  it('abrirEditar() precarga el formulario con los datos de la presentación', () => {
    const { c } = crear({ producto: producto([presentacion('pr-1', 'Botella de 500 ml')]) });
    c['abrirEditar'](presentacion('pr-1', 'Botella de 500 ml'));
    expect(c['paso']()).toBe('formulario');
    expect(c['editando']()?.id).toBe('pr-1');
    expect(c['form'].getRawValue().nombre).toBe('Botella de 500 ml');
  });

  it('guardar una edición hace PUT y reemplaza la fila en la lista local', () => {
    const { c, http } = crear({ producto: producto([presentacion('pr-1', 'Botella de 1 L')]) });
    c['abrirEditar'](presentacion('pr-1', 'Botella de 1 L'));
    c['form'].controls.nombre.setValue('Botella de 2 L');

    c['guardarPresentacion']();
    const req = http.expectOne(`${base}/admin/productos/p-1/presentaciones/pr-1`);
    expect(req.request.method).toBe('PUT');
    req.flush(presentacion('pr-1', 'Botella de 2 L'));

    expect(c['producto']().presentaciones[0].nombre).toBe('Botella de 2 L');
  });

  it('alternarActivo() desactiva y reactiva sin salir de la lista', () => {
    const { c, http } = crear({ producto: producto([presentacion('pr-1')]) });

    c['alternarActivo'](presentacion('pr-1'));
    http.expectOne(`${base}/admin/productos/p-1/presentaciones/pr-1`).flush(null);
    expect(c['producto']().presentaciones[0].activo).toBe(false);

    c['alternarActivo'](c['producto']().presentaciones[0]);
    http.expectOne(`${base}/admin/productos/p-1/presentaciones/pr-1/reactivar`).flush(presentacion('pr-1'));
    expect(c['producto']().presentaciones[0].activo).toBe(true);
  });

  it('finalizar() cierra el diálogo con true si hubo cambios (el producto ya creado permanece siempre)', () => {
    const { c, http, dialogRef } = crear({ producto: producto() });
    c['abrirAgregar']();
    c['form'].setValue({ nombre: 'Botella de 1 L', contenidoCantidad: 1, contenidoUnidad: 'L', unidadConteo: 'Botella' });
    c['guardarPresentacion']();
    http.expectOne(`${base}/admin/productos/p-1/presentaciones`).flush(presentacion('pr-nueva'));

    c['finalizar']();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('finalizar() sin agregar ninguna presentación cierra con false -- terminar sin presentaciones es válido', () => {
    const { c, dialogRef } = crear({ producto: producto() });
    c['finalizar']();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  it('un contenido sin unidad (o una unidad sin contenido) invalida el formulario y no envía nada', () => {
    const { c, http } = crear({ producto: producto() });
    c['abrirAgregar']();

    c['form'].setValue({ nombre: 'Botella', contenidoCantidad: 5, contenidoUnidad: '', unidadConteo: 'botella' });
    expect(c['form'].hasError('contenidoSinUnidad')).toBe(true);
    c['guardarPresentacion']();
    http.expectNone(`${base}/admin/productos/p-1/presentaciones`);

    c['form'].setValue({ nombre: 'Botella', contenidoCantidad: null, contenidoUnidad: 'L', unidadConteo: 'botella' });
    expect(c['form'].hasError('contenidoSinCantidad')).toBe(true);

    c['form'].setValue({ nombre: 'Botella', contenidoCantidad: 1, contenidoUnidad: 'L', unidadConteo: 'botella' });
    expect(c['form'].valid).toBe(true);
  });

  it('rechaza nombres en blanco y recorta los espacios sobrantes al enviar', () => {
    const { c, http } = crear({ producto: producto() });
    c['abrirAgregar']();

    c['form'].setValue({ nombre: '   ', contenidoCantidad: null, contenidoUnidad: '', unidadConteo: 'pieza' });
    expect(c['form'].controls.nombre.invalid).toBe(true);

    c['form'].setValue({ nombre: '  Pieza ', contenidoCantidad: null, contenidoUnidad: '', unidadConteo: ' pieza ' });
    c['guardarPresentacion']();
    const req = http.expectOne(`${base}/admin/productos/p-1/presentaciones`);
    expect(req.request.body).toEqual({ nombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza' });
    req.flush({ id: 'pr-3', productoId: 'p-1', nombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza', activo: true });
  });

  it('al crear una presentación con foto: POST y después PUT de la foto; la lista queda con la foto', () => {
    const { c, http } = crear({ producto: producto() });
    c['abrirAgregar']();
    c['form'].setValue({ nombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: '', unidadConteo: 'pieza' });
    c['fotoCambio'] = { archivo: new File([new Uint8Array(3)], 'f.jpg', { type: 'image/jpeg' }), quitar: false };

    c['guardarPresentacion']();
    const alta = http.expectOne(`${base}/admin/productos/p-1/presentaciones`);
    alta.flush({ id: 'pr-9', productoId: 'p-1', nombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza', activo: true, fotoUrl: null });
    const subida = http.expectOne(`${base}/admin/productos/p-1/presentaciones/pr-9/foto`);
    expect(subida.request.method).toBe('PUT');
    subida.flush({ id: 'pr-9', productoId: 'p-1', nombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza', activo: true, fotoUrl: '/api/catalogo/fotos/x.jpg' });

    expect(c['producto']().presentaciones[0].fotoUrl).toBe('/api/catalogo/fotos/x.jpg');
    expect(c['paso']()).toBe('lista');
    expect(c['errorAccion']()).toBeNull();
  });

  it('si la foto falla, la presentación ya guardada permanece y se avisa en la lista (sin duplicarla)', () => {
    const { c, http } = crear({ producto: producto() });
    c['abrirAgregar']();
    c['form'].setValue({ nombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: '', unidadConteo: 'pieza' });
    c['fotoCambio'] = { archivo: new File([new Uint8Array(3)], 'f.jpg', { type: 'image/jpeg' }), quitar: false };

    c['guardarPresentacion']();
    http.expectOne(`${base}/admin/productos/p-1/presentaciones`)
      .flush({ id: 'pr-9', productoId: 'p-1', nombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza', activo: true });
    http.expectOne(`${base}/admin/productos/p-1/presentaciones/pr-9/foto`)
      .flush({ mensaje: 'La imagen está dañada' }, { status: 400, statusText: 'Bad Request' });

    expect(c['producto']().presentaciones.length).toBe(1);
    expect(c['paso']()).toBe('lista');
    expect(c['errorAccion']()).toContain('La imagen está dañada');
    expect(c['enviando']()).toBe(false);
  });

  it('al editar y pedir quitar la foto propia: PUT y después DELETE de la foto', () => {
    const existente: PresentacionResponse = { ...presentacion('pr-1'), fotoUrl: '/api/catalogo/fotos/x.jpg' };
    const { c, http } = crear({ producto: producto([existente]) });
    c['abrirEditar'](existente);
    c['fotoCambio'] = { archivo: null, quitar: true };

    c['guardarPresentacion']();
    http.expectOne(`${base}/admin/productos/p-1/presentaciones/pr-1`).flush(existente);
    const baja = http.expectOne(`${base}/admin/productos/p-1/presentaciones/pr-1/foto`);
    expect(baja.request.method).toBe('DELETE');
    baja.flush({ ...existente, fotoUrl: null });

    expect(c['producto']().presentaciones[0].fotoUrl).toBeNull();
  });
});
