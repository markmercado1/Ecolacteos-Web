import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { ProductoFormDialog, ProductoFormDialogData } from './producto-form-dialog';
import { ProductoResponse } from '../../data-access/producto.models';

const base = environment.apiBaseUrl;

function crear(data: ProductoFormDialogData = {}) {
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
  const f = TestBed.createComponent(ProductoFormDialog);
  const c = f.componentInstance;
  http.expectOne(`${base}/admin/familias`).flush([{ id: 'f-1', nombre: 'Queso', activo: true }]);
  return { f, http, c, dialogRef };
}

function productoConId(id: string): ProductoResponse {
  return {
    id, nombre: 'Yogurt de fresa', familiaId: 'f-1', familiaNombre: 'Queso',
    rendimientoEsperadoPct: null, cicloCapital: null, activo: true, presentaciones: []
  };
}

function llenarFormularioValido(c: ProductoFormDialog) {
  c['form'].controls.nombre.setValue('Yogurt de fresa');
  c['form'].controls.familiaId.setValue('f-1');
}

describe('ProductoFormDialog', () => {
  it('título y botón dicen "Nuevo producto"/"Crear y continuar" cuando no hay producto en los datos', () => {
    const { c } = crear();
    expect(c['esEdicion']).toBe(false);
  });

  it('título y botón dicen "Editar producto"/"Guardar cambios" cuando hay un producto en los datos', () => {
    const { c } = crear({ producto: productoConId('p-1') });
    expect(c['esEdicion']).toBe(true);
    expect(c['form'].getRawValue().nombre).toBe('Yogurt de fresa');
  });

  it('crear() hace POST y cierra el diálogo con { producto, esNuevo: true }', () => {
    const { c, http, dialogRef } = crear();
    llenarFormularioValido(c);

    c['guardar']();
    expect(c['enviando']()).toBe(true); // deshabilita el envío mientras se guarda

    const req = http.expectOne(`${base}/admin/productos`);
    expect(req.request.method).toBe('POST');
    req.flush(productoConId('p-nuevo'));

    expect(dialogRef.close).toHaveBeenCalledWith({ producto: productoConId('p-nuevo'), esNuevo: true });
  });

  it('editar() hace PUT y cierra el diálogo con { producto, esNuevo: false }, sin volver a crear nada', () => {
    const { c, http, dialogRef } = crear({ producto: productoConId('p-1') });

    c['guardar']();
    const req = http.expectOne(`${base}/admin/productos/p-1`);
    expect(req.request.method).toBe('PUT');
    req.flush(productoConId('p-1'));

    expect(dialogRef.close).toHaveBeenCalledWith({ producto: productoConId('p-1'), esNuevo: false });
  });

  it('si falla la creación, conserva los datos del formulario, muestra el error y NO cierra el diálogo', () => {
    const { c, http, dialogRef } = crear();
    llenarFormularioValido(c);

    c['guardar']();
    http.expectOne(`${base}/admin/productos`).flush({ mensaje: 'Ya existe un producto con ese nombre' }, { status: 409, statusText: 'Conflict' });

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(c['enviando']()).toBe(false);
    expect(c['errorServidor']()).toBeTruthy();
    expect(c['form'].getRawValue().nombre).toBe('Yogurt de fresa'); // datos conservados para reintentar
  });

  it('cerrar() cierra el diálogo sin resultado (cancelar)', () => {
    const { c, dialogRef } = crear();
    c['cerrar']();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it('un error al cargar familias no bloquea el formulario y permite reintentar', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: {} },
        { provide: DialogRef, useValue: { close: vi.fn() } }
      ]
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(ProductoFormDialog);
    const c = f.componentInstance;
    http.expectOne(`${base}/admin/familias`).flush({}, { status: 500, statusText: 'Server Error' });

    expect(c['errorFamilias']()).toBeTruthy();
    expect(c['cargandoFamilias']()).toBe(false);

    c['cargarFamilias']();
    http.expectOne(`${base}/admin/familias`).flush([{ id: 'f-1', nombre: 'Queso', activo: true }]);
    expect(c['familias']().length).toBe(1);
  });
});

describe('ProductoFormDialog: rango preventivo', () => {
  let http: HttpTestingController;
  let dialogo: ProductoFormDialog;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: {} },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ] });
    http = TestBed.inject(HttpTestingController);
    dialogo = TestBed.createComponent(ProductoFormDialog).componentInstance;
    http.expectOne(`${environment.apiBaseUrl}/admin/familias`).flush([{ id: 'f', nombre: 'Yogurt', activo: true }]);
    dialogo['form'].patchValue({ nombre: 'Natural', familiaId: 'f' });
  });
  afterEach(() => http.verify());

  it('no inventa límites cuando no se habilita el rango', () => {
    dialogo['guardar']();
    const req = http.expectOne(`${environment.apiBaseUrl}/admin/productos`);
    expect(req.request.body.rangoRendimiento).toBeNull();
    req.flush({ id: 'p' });
  });

  it('rechaza límites invertidos y envía el rango válido en la unidad elegida', () => {
    dialogo['form'].patchValue({ usarRango: true, rangoMinimo: 20, rangoMaximo: 10, rangoUnidad: 'L' });
    dialogo['guardar']();
    expect(dialogo['errorRango']()).toBeTruthy();
    http.expectNone(`${environment.apiBaseUrl}/admin/productos`);
    dialogo['form'].controls.rangoMaximo.setValue(30);
    dialogo['guardar']();
    const req = http.expectOne(`${environment.apiBaseUrl}/admin/productos`);
    expect(req.request.body.rangoRendimiento).toEqual({ minimo: 20, maximo: 30, unidad: 'L' });
    req.flush({ id: 'p' });
  });
});

describe('ProductoFormDialog: validaciones alineadas con el backend', () => {
  let http: HttpTestingController;
  let dialogo: ProductoFormDialog;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: {} },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ] });
    http = TestBed.inject(HttpTestingController);
    dialogo = TestBed.createComponent(ProductoFormDialog).componentInstance;
    http.expectOne(`${environment.apiBaseUrl}/admin/familias`).flush([{ id: 'f', nombre: 'Yogurt', activo: true }]);
  });
  afterEach(() => http.verify());

  it('rechaza un nombre en blanco o de más de 60 caracteres', () => {
    dialogo['form'].patchValue({ familiaId: 'f', nombre: '   ' });
    expect(dialogo['form'].controls.nombre.invalid).toBe(true);
    dialogo['form'].patchValue({ nombre: 'a'.repeat(61) });
    expect(dialogo['form'].controls.nombre.invalid).toBe(true);
    dialogo['form'].patchValue({ nombre: 'a'.repeat(60) });
    expect(dialogo['form'].valid).toBe(true);
  });

  it('el rendimiento esperado debe estar entre 0 y 999,99', () => {
    dialogo['form'].patchValue({ familiaId: 'f', nombre: 'Natural' });
    dialogo['form'].controls.rendimientoEsperadoPct.setValue(-1);
    expect(dialogo['form'].invalid).toBe(true);
    dialogo['form'].controls.rendimientoEsperadoPct.setValue(1000);
    expect(dialogo['form'].invalid).toBe(true);
    dialogo['form'].controls.rendimientoEsperadoPct.setValue(999.99);
    expect(dialogo['form'].valid).toBe(true);
  });

  it('envía el nombre sin espacios sobrantes', () => {
    dialogo['form'].patchValue({ familiaId: 'f', nombre: '  Natural  ' });
    dialogo['guardar']();
    const req = http.expectOne(`${environment.apiBaseUrl}/admin/productos`);
    expect(req.request.body.nombre).toBe('Natural');
    req.flush({ id: 'p' });
  });
});

describe('ProductoFormDialog: foto', () => {
  let http: HttpTestingController;
  let dialogo: ProductoFormDialog;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  const foto = () => new File([new Uint8Array(3)], 'foto.jpg', { type: 'image/jpeg' });
  const url = (ruta: string) => `${environment.apiBaseUrl}${ruta}`;

  function abrir(producto?: ProductoResponse) {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: producto ? { producto } : {} },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ] });
    http = TestBed.inject(HttpTestingController);
    dialogRef = TestBed.inject(DialogRef) as unknown as { close: ReturnType<typeof vi.fn> };
    dialogo = TestBed.createComponent(ProductoFormDialog).componentInstance;
    http.expectOne(url('/admin/familias')).flush([{ id: 'f', nombre: 'Yogurt', activo: true }]);
    dialogo['form'].patchValue({ nombre: 'Natural', familiaId: 'f' });
  }
  afterEach(() => http.verify());

  it('sin foto elegida no hace ninguna llamada de foto', () => {
    abrir();
    dialogo['guardar']();
    http.expectOne(url('/admin/productos')).flush({ id: 'p-1', nombre: 'Natural' });

    expect(dialogRef.close).toHaveBeenCalledWith({ producto: { id: 'p-1', nombre: 'Natural' }, esNuevo: true, errorFoto: undefined });
  });

  it('al crear con foto: primero POST del producto y después PUT de la foto; cierra con el producto ya con foto', () => {
    abrir();
    const elegida = foto();
    dialogo['fotoCambio'] = { archivo: elegida, quitar: false };

    dialogo['guardar']();
    http.expectOne(url('/admin/productos')).flush({ id: 'p-1', nombre: 'Natural', fotoUrl: null });
    const subida = http.expectOne(url('/admin/productos/p-1/foto'));
    expect(subida.request.method).toBe('PUT');
    expect((subida.request.body as FormData).get('file')).toBeInstanceOf(File);
    subida.flush({ id: 'p-1', nombre: 'Natural', fotoUrl: '/api/catalogo/fotos/x.jpg' });

    expect(dialogRef.close).toHaveBeenCalledWith({
      producto: { id: 'p-1', nombre: 'Natural', fotoUrl: '/api/catalogo/fotos/x.jpg' },
      esNuevo: true,
      errorFoto: undefined
    });
  });

  it('si la foto falla, el producto YA creado no se revierte ni se vuelve a crear: se cierra con el aviso', () => {
    abrir();
    dialogo['fotoCambio'] = { archivo: foto(), quitar: false };

    dialogo['guardar']();
    http.expectOne(url('/admin/productos')).flush({ id: 'p-1', nombre: 'Natural' });
    http.expectOne(url('/admin/productos/p-1/foto')).flush(
      { mensaje: 'Formato no permitido' }, { status: 400, statusText: 'Bad Request' });

    expect(dialogRef.close).toHaveBeenCalledWith({
      producto: { id: 'p-1', nombre: 'Natural' }, esNuevo: true, errorFoto: 'Formato no permitido'
    });
  });

  it('al editar y pedir quitar la foto guardada: PUT del producto y después DELETE de la foto', () => {
    abrir({ ...productoConId('p-1'), fotoUrl: '/api/catalogo/fotos/x.jpg' });
    dialogo['fotoCambio'] = { archivo: null, quitar: true };

    dialogo['guardar']();
    http.expectOne(url('/admin/productos/p-1')).flush({ ...productoConId('p-1'), fotoUrl: '/api/catalogo/fotos/x.jpg' });
    const baja = http.expectOne(url('/admin/productos/p-1/foto'));
    expect(baja.request.method).toBe('DELETE');
    baja.flush({ ...productoConId('p-1'), fotoUrl: null });

    expect(dialogRef.close).toHaveBeenCalledWith({ producto: { ...productoConId('p-1'), fotoUrl: null }, esNuevo: false, errorFoto: undefined });
  });

  it('pedir quitar la foto de un producto que no tenía no hace ninguna llamada de foto', () => {
    abrir(productoConId('p-1'));
    dialogo['fotoCambio'] = { archivo: null, quitar: true };

    dialogo['guardar']();
    http.expectOne(url('/admin/productos/p-1')).flush(productoConId('p-1'));

    expect(dialogRef.close).toHaveBeenCalled();
  });
});
