import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { TokenStoreService } from '../../../../core/auth/token-store.service';
import { UsuarioMeResponse } from '../../../../core/auth/auth.models';
import { VentaFormDialog } from './venta-form-dialog';

const base = environment.apiBaseUrl;

function usuarioCon(rolNombre: UsuarioMeResponse['rolNombre']): UsuarioMeResponse {
  return { id: 'u-1', nombre: 'Vendedor', email: 'v@ecolacteos.pe', rolNombre, activo: true, unidadesResponsable: [] };
}

function crear(rol: UsuarioMeResponse['rolNombre'] = 'VENTAS') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const tokenStore = TestBed.inject(TokenStoreService);
  tokenStore.establecer({
    token: 't',
    refreshToken: 'r',
    expiraEn: Date.now() + 100000,
    refreshExpiraEn: Date.now() + 100000,
    usuario: usuarioCon(rol)
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(VentaFormDialog);
  const dialog = fixture.componentInstance;
  return { fixture, dialog, http };
}

const PRODUCTO_YOGURT = {
  id: 'prod-1', nombre: 'Yogurt de fresa', familiaId: 'fam-1', familiaNombre: 'Yogurt',
  rendimientoEsperadoPct: null, cicloCapital: null, activo: true,
  presentaciones: [
    { id: 'pres-1', productoId: 'prod-1', nombre: 'Botella 1 L', contenidoCantidad: 1, contenidoUnidad: 'L', unidadConteo: 'botella', activo: true },
    { id: 'pres-2', productoId: 'prod-1', nombre: 'Botella 2 L', contenidoCantidad: 2, contenidoUnidad: 'L', unidadConteo: 'botella', activo: true }
  ]
};
const PRODUCTO_QUESO = {
  id: 'prod-2', nombre: 'Queso fresco', familiaId: 'fam-2', familiaNombre: 'Queso',
  rendimientoEsperadoPct: 12.5, cicloCapital: 'RAPIDO', activo: true,
  presentaciones: [
    { id: 'pres-3', productoId: 'prod-2', nombre: 'Unidad', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'unidad', activo: true }
  ]
};
const CATALOGO = [PRODUCTO_YOGURT, PRODUCTO_QUESO];

const CAMBIOS_RESPUESTA = {
  generadoEn: '2026-09-17T00:00:00Z',
  proveedores: [],
  precioLitroVigente: 1.5,
  comunicados: [],
  prediccionesProveedor: [],
  motivosObservacion: [],
  productos: CATALOGO,
  unidades: []
};

function flushCatalogo(http: HttpTestingController, rol: UsuarioMeResponse['rolNombre']): void {
  const url = rol === 'ADMIN' ? `${base}/admin/productos` : `${base}/sync/cambios`;
  const flushBody = rol === 'ADMIN' ? CATALOGO : CAMBIOS_RESPUESTA;
  http.expectOne(url).flush(flushBody);
}

function crearConCatalogoListo(rol: UsuarioMeResponse['rolNombre'] = 'VENTAS') {
  const c = crear(rol);
  flushCatalogo(c.http, rol);
  return c;
}

function existencias(presentacionId: string, vendible: number, noVendible = 0) {
  return {
    presentacionId, controlaVencimiento: noVendible > 0, stockFisico: vendible + noVendible, stockVendible: vendible,
    stockVencido: noVendible, stockSinTrazabilidad: 0, fechaReferencia: '2026-10-11', lotes: []
  };
}

/** Selecciona producto + presentación + cantidad en una línea, y resuelve sus peticiones de precio y stock. */
function llenarLinea(
  dialog: VentaFormDialog,
  http: HttpTestingController,
  id: string,
  opciones: { productoId: string; presentacionId: string; cantidad: number; precio?: number; stock?: number }
): void {
  dialog['cambiarProducto'](id, opciones.productoId);
  dialog['cambiarPresentacion'](id, opciones.presentacionId);
  dialog['cambiarCantidad'](id, String(opciones.cantidad));

  http.expectOne((r) => r.url === `${base}/ventas/precio-vigente` && r.params.get('presentacionId') === opciones.presentacionId).flush({
    id: 'pq-1', presentacionId: opciones.presentacionId, presentacionNombre: 'x', productoId: opciones.productoId, productoNombre: 'x',
    modalidad: 'MAYORISTA', precio: opciones.precio ?? 10, vigenteDesde: '2026-09-01'
  });
  http.expectOne(`${base}/inventario/presentaciones/${opciones.presentacionId}/existencias`).flush(
    existencias(opciones.presentacionId, opciones.stock ?? 100));
}

function primerId(dialog: VentaFormDialog): string {
  return dialog['filas']()[0].id;
}

describe('VentaFormDialog — catálogo de productos según rol', () => {
  afterEach(() => localStorage.clear());

  it('ADMIN consulta GET /admin/productos', () => {
    const { http } = crear('ADMIN');
    http.expectOne(`${base}/admin/productos`).flush(CATALOGO);
    http.verify();
  });

  it('VENTAS consulta GET /sync/cambios (sin acceso a /admin)', () => {
    const { http } = crear('VENTAS');
    http.expectOne(`${base}/sync/cambios`).flush(CAMBIOS_RESPUESTA);
    http.verify();
  });
});

describe('VentaFormDialog — carrito: agregar, quitar y evitar presentaciones duplicadas', () => {
  afterEach(() => localStorage.clear());

  it('empieza con una línea vacía y permite agregar más', () => {
    const { dialog } = crearConCatalogoListo();
    expect(dialog['filas']().length).toBe(1);
    dialog['agregarLinea']();
    expect(dialog['filas']().length).toBe(2);
  });

  it('quitarLinea() elimina solo esa línea', () => {
    const { dialog } = crearConCatalogoListo();
    dialog['agregarLinea']();
    const [primera, segunda] = dialog['filas']();
    dialog['quitarLinea'](primera.id);
    expect(dialog['filas']().length).toBe(1);
    expect(dialog['filas']()[0].id).toBe(segunda.id);
  });

  it('las opciones de presentación de una fila excluyen las ya elegidas en OTRAS filas del mismo producto', () => {
    const { dialog, http } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('PUBLICO');
    const idA = primerId(dialog);
    llenarLinea(dialog, http, idA, { productoId: 'prod-1', presentacionId: 'pres-1', cantidad: 1 });

    dialog['agregarLinea']();
    const idB = dialog['filas']()[1].id;
    dialog['cambiarProducto'](idB, 'prod-1');

    const opciones = dialog['presentacionesDeFila'](dialog['filas']()[1]);
    expect(opciones.map((p) => p.id)).toEqual(['pres-2']); // pres-1 ya está en la fila A
  });

  it('cambiar el producto de una fila resetea su presentación, precio y stock', () => {
    const { dialog, http } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('PUBLICO');
    const id = primerId(dialog);
    llenarLinea(dialog, http, id, { productoId: 'prod-1', presentacionId: 'pres-1', cantidad: 2, precio: 10 });

    dialog['cambiarProducto'](id, 'prod-2');

    const fila = dialog['filas']()[0];
    expect(fila.presentacionId).toBe('');
    expect(fila.precioVigente).toBeNull();
    expect(fila.stockDisponible).toBeNull();
    http.verify();
  });
});

describe('VentaFormDialog — precio y stock por línea', () => {
  afterEach(() => localStorage.clear());

  it('al elegir presentación, consulta precio-vigente y stock de ESA presentación', () => {
    const { dialog, http } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('MAYORISTA');
    dialog['form'].controls.fecha.setValue('2026-09-17');
    const id = primerId(dialog);

    dialog['cambiarProducto'](id, 'prod-1');
    dialog['cambiarPresentacion'](id, 'pres-1');

    const reqPrecio = http.expectOne((r) => r.url === `${base}/ventas/precio-vigente`);
    expect(reqPrecio.request.params.get('presentacionId')).toBe('pres-1');
    expect(reqPrecio.request.params.get('tipoCliente')).toBe('MAYORISTA');
    expect(reqPrecio.request.params.get('fecha')).toBe('2026-09-17');
    reqPrecio.flush({ id: 'pq-1', presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoId: 'prod-1', productoNombre: 'Yogurt', modalidad: 'MAYORISTA', precio: 13.5, vigenteDesde: '2026-09-01' });

    http.expectOne(`${base}/inventario/presentaciones/pres-1/existencias`).flush(existencias('pres-1', 40));

    const fila = dialog['filas']()[0];
    expect(fila.precioVigente).toBe(13.5);
    expect(fila.stockDisponible).toBe(40);
    http.verify();
  });

  it('Fase 2: el stock de la línea es el VENDIBLE; lo vencido o sin trazabilidad se muestra aparte y no permite excederlo', () => {
    const { dialog, http, fixture } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('MAYORISTA');
    const id = primerId(dialog);
    dialog['cambiarProducto'](id, 'prod-1');
    dialog['cambiarPresentacion'](id, 'pres-1');
    dialog['cambiarCantidad'](id, '9');
    http.expectOne((r) => r.url === `${base}/ventas/precio-vigente`).flush({
      id: 'pq-1', presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoId: 'prod-1', productoNombre: 'Yogurt',
      modalidad: 'MAYORISTA', precio: 10, vigenteDesde: '2026-09-01'
    });
    // 100 en inventario pero solo 8 vendibles (el resto: 12 vencidas y 80 sin trazabilidad).
    http.expectOne(`${base}/inventario/presentaciones/pres-1/existencias`).flush({
      presentacionId: 'pres-1', controlaVencimiento: true, stockFisico: 100, stockVendible: 8, stockVencido: 12,
      stockSinTrazabilidad: 80, fechaReferencia: '2026-10-11', lotes: []
    });
    fixture.detectChanges();

    const fila = dialog['filas']()[0];
    expect(fila.stockDisponible).toBe(8);
    expect(fila.stockNoVendible).toBe(92);
    expect(dialog['cantidadExcedeStock'](fila)).toBe(true);
    expect(dialog['puedeContinuar']()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('92 más en inventario no se pueden vender');
    http.verify();
  });

  it('sin precio configurado, la fila muestra el error del backend y no permite continuar', () => {
    const { dialog, http } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('MAYORISTA');
    const id = primerId(dialog);
    dialog['cambiarProducto'](id, 'prod-1');
    dialog['cambiarPresentacion'](id, 'pres-1');

    http.expectOne((r) => r.url === `${base}/ventas/precio-vigente`).flush(
      { mensaje: 'No hay un precio configurado para Botella 1 L en modalidad MAYORISTA.' },
      { status: 400, statusText: 'Bad Request' }
    );
    http.expectOne(`${base}/inventario/presentaciones/pres-1/existencias`).flush(existencias('pres-1', 40));

    const fila = dialog['filas']()[0];
    expect(fila.precioVigente).toBeNull();
    expect(fila.errorPrecio).toContain('No hay un precio configurado');
    expect(dialog['puedeContinuar']()).toBe(false);
    http.verify();
  });

  it('cambiar la presentación de una fila cancela su consulta de precio anterior (sin pisar el precio con una respuesta tardía)', () => {
    const { dialog, http } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('PUBLICO');
    const id = primerId(dialog);
    dialog['cambiarProducto'](id, 'prod-1');
    dialog['cambiarPresentacion'](id, 'pres-1');
    const primeraPeticion = http.expectOne((r) => r.url === `${base}/ventas/precio-vigente`);
    http.expectOne(`${base}/inventario/presentaciones/pres-1/existencias`).flush(existencias('pres-1', 5));

    dialog['cambiarPresentacion'](id, 'pres-2');
    const segundaPeticion = http.expectOne((r) => r.url === `${base}/ventas/precio-vigente`);
    http.expectOne(`${base}/inventario/presentaciones/pres-2/existencias`).flush(existencias('pres-2', 8));

    expect(primeraPeticion.cancelled).toBe(true);
    segundaPeticion.flush({ id: 'pq-2', presentacionId: 'pres-2', presentacionNombre: 'Botella 2 L', productoId: 'prod-1', productoNombre: 'Yogurt', modalidad: 'PUBLICO', precio: 20, vigenteDesde: '2026-09-01' });

    expect(dialog['filas']()[0].precioVigente).toBe(20);
    http.verify();
  });

  it('cambiar la fecha o el canal vuelve a consultar el precio de TODAS las líneas ya seleccionadas', () => {
    const { dialog, http } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('PUBLICO');
    const idA = primerId(dialog);
    llenarLinea(dialog, http, idA, { productoId: 'prod-1', presentacionId: 'pres-1', cantidad: 2, precio: 10 });
    dialog['agregarLinea']();
    const idB = dialog['filas']()[1].id;
    llenarLinea(dialog, http, idB, { productoId: 'prod-2', presentacionId: 'pres-3', cantidad: 1, precio: 15 });

    dialog['form'].controls.fecha.setValue('2026-01-01');

    const reqA = http.expectOne((r) => r.url === `${base}/ventas/precio-vigente` && r.params.get('presentacionId') === 'pres-1');
    const reqB = http.expectOne((r) => r.url === `${base}/ventas/precio-vigente` && r.params.get('presentacionId') === 'pres-3');
    expect(reqA.request.params.get('fecha')).toBe('2026-01-01');
    expect(reqB.request.params.get('fecha')).toBe('2026-01-01');
    reqA.flush({ id: 'pq-1', presentacionId: 'pres-1', presentacionNombre: 'x', productoId: 'prod-1', productoNombre: 'x', modalidad: 'PUBLICO', precio: 9, vigenteDesde: '2025-01-01' });
    reqB.flush({ id: 'pq-2', presentacionId: 'pres-3', presentacionNombre: 'x', productoId: 'prod-2', productoNombre: 'x', modalidad: 'PUBLICO', precio: 14, vigenteDesde: '2025-01-01' });
    http.verify();
  });

  it('cantidad mayor al stock disponible de esa línea bloquea continuar', () => {
    const { dialog, http } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('PUBLICO');
    const id = primerId(dialog);
    llenarLinea(dialog, http, id, { productoId: 'prod-1', presentacionId: 'pres-1', cantidad: 3, precio: 10, stock: 10 });
    expect(dialog['puedeContinuar']()).toBe(true);

    dialog['cambiarCantidad'](id, '60');
    expect(dialog['cantidadExcedeStock'](dialog['filas']()[0])).toBe(true);
    expect(dialog['puedeContinuar']()).toBe(false);
    http.verify();
  });
});

describe('VentaFormDialog — resumen, envío y UUID estable', () => {
  afterEach(() => localStorage.clear());

  it('no avanza al resumen sin ninguna línea completa', () => {
    const { dialog } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('PUBLICO');
    dialog['continuarARevision']();
    expect(dialog['paso']()).toBe('formulario');
  });

  it('avanza al resumen con datos válidos y calcula el total estimado sumando todas las líneas', () => {
    const { dialog, http } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('MAYORISTA');
    const idA = primerId(dialog);
    llenarLinea(dialog, http, idA, { productoId: 'prod-1', presentacionId: 'pres-1', cantidad: 3, precio: 10 }); // 30
    dialog['agregarLinea']();
    const idB = dialog['filas']()[1].id;
    llenarLinea(dialog, http, idB, { productoId: 'prod-2', presentacionId: 'pres-3', cantidad: 2, precio: 12.5 }); // 25

    dialog['continuarARevision']();
    expect(dialog['paso']()).toBe('resumen');
    expect(dialog['totalEstimado']()).toBe(55);
  });

  it('confirmar() envía uuidCliente, fecha, tipoCliente y una línea por cada presentación del carrito', () => {
    const { dialog, http } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('MAYORISTA');
    const idA = primerId(dialog);
    llenarLinea(dialog, http, idA, { productoId: 'prod-1', presentacionId: 'pres-1', cantidad: 3, precio: 10 });
    dialog['agregarLinea']();
    const idB = dialog['filas']()[1].id;
    llenarLinea(dialog, http, idB, { productoId: 'prod-2', presentacionId: 'pres-3', cantidad: 2, precio: 12.5 });

    dialog['continuarARevision']();
    dialog['confirmar']();

    const req = http.expectOne(`${base}/ventas/carrito`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      uuidCliente: dialog['uuidCliente'],
      fecha: dialog['form'].getRawValue().fecha,
      tipoCliente: 'MAYORISTA',
      detalles: [
        { presentacionId: 'pres-1', cantidad: 3 },
        { presentacionId: 'pres-3', cantidad: 2 }
      ]
    });
    req.flush({
      id: 'v-1', fecha: dialog['form'].getRawValue().fecha, tipoCliente: 'MAYORISTA',
      detalles: [
        { presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoNombre: 'Yogurt', cantidad: 3, precioUnitario: 10, subtotal: 30 },
        { presentacionId: 'pres-3', presentacionNombre: 'Unidad', productoNombre: 'Queso fresco', cantidad: 2, precioUnitario: 12.5, subtotal: 25 }
      ],
      total: 55
    });
    http.verify();
  });

  it('doble clic en confirmar mientras está en curso no duplica la petición', () => {
    const { dialog, http } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('PUBLICO');
    const id = primerId(dialog);
    llenarLinea(dialog, http, id, { productoId: 'prod-1', presentacionId: 'pres-1', cantidad: 1, precio: 10 });
    dialog['continuarARevision']();
    dialog['confirmar']();
    dialog['confirmar']();

    http.expectOne(`${base}/ventas/carrito`);
    http.verify();
  });

  it('al confirmar, muestra la venta con el total y las líneas confirmadas por el servidor (boleta)', () => {
    const { dialog, http } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('PUBLICO');
    const id = primerId(dialog);
    llenarLinea(dialog, http, id, { productoId: 'prod-1', presentacionId: 'pres-1', cantidad: 1, precio: 10 });
    dialog['continuarARevision']();
    dialog['confirmar']();

    http.expectOne(`${base}/ventas/carrito`).flush({
      id: 'v-1', fecha: dialog['form'].getRawValue().fecha, tipoCliente: 'PUBLICO',
      detalles: [{ presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoNombre: 'Yogurt', cantidad: 1, precioUnitario: 10, subtotal: 10 }],
      total: 40 // total real del servidor, distinto del estimado en cliente
    });

    expect(dialog['paso']()).toBe('resultado');
    expect(dialog['resultado']()?.total).toBe(40);
  });

  it('imprimir() invoca window.print() (boleta interactiva, sin backend ni librería de PDF)', () => {
    const { dialog, http } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('PUBLICO');
    const id = primerId(dialog);
    llenarLinea(dialog, http, id, { productoId: 'prod-1', presentacionId: 'pres-1', cantidad: 1, precio: 10 });
    dialog['continuarARevision']();
    dialog['confirmar']();
    http.expectOne(`${base}/ventas/carrito`).flush({
      id: 'v-1', fecha: dialog['form'].getRawValue().fecha, tipoCliente: 'PUBLICO',
      detalles: [{ presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoNombre: 'Yogurt', cantidad: 1, precioUnitario: 10, subtotal: 10 }],
      total: 10
    });

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    dialog['imprimir']();
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('fallo de red: el reintento reenvía exactamente el mismo carrito (mismo uuid, sin cambios)', () => {
    const { dialog, http } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('PUBLICO');
    const id = primerId(dialog);
    llenarLinea(dialog, http, id, { productoId: 'prod-1', presentacionId: 'pres-1', cantidad: 3, precio: 10 });
    dialog['continuarARevision']();
    dialog['confirmar']();

    const primerIntento = http.expectOne(`${base}/ventas/carrito`);
    const cuerpoOriginal = primerIntento.request.body;
    primerIntento.error(new ProgressEvent('network error'), { status: 0, statusText: 'Unknown Error' });

    expect(dialog['incierto']()).toBe(true);

    // Aunque el carrito siguiera editable en memoria y cambiara, el reintento no debe tomarlo:
    dialog['cambiarCantidad'](id, '999');
    dialog['confirmar']();

    const segundoIntento = http.expectOne(`${base}/ventas/carrito`);
    expect(segundoIntento.request.body).toEqual(cuerpoOriginal);
    expect((segundoIntento.request.body as { uuidCliente: string }).uuidCliente).toBe(dialog['uuidCliente']);
    segundoIntento.flush({
      id: 'v-1', fecha: dialog['form'].getRawValue().fecha, tipoCliente: 'PUBLICO',
      detalles: [{ presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoNombre: 'Yogurt', cantidad: 3, precioUnitario: 10, subtotal: 30 }],
      total: 30
    });
    http.verify();
  });

  it('error de validación del servidor (no de red) permite editar y reconstruir la solicitud, sin regenerar el uuid', () => {
    const { dialog, http } = crearConCatalogoListo();
    dialog['form'].controls.tipoCliente.setValue('PUBLICO');
    const id = primerId(dialog);
    llenarLinea(dialog, http, id, { productoId: 'prod-1', presentacionId: 'pres-1', cantidad: 3, precio: 10, stock: 100 });
    dialog['continuarARevision']();
    dialog['confirmar']();

    http.expectOne(`${base}/ventas/carrito`).flush(
      { mensaje: 'La presentación está desactivada' },
      { status: 422, statusText: 'Unprocessable Entity' }
    );
    expect(dialog['incierto']()).toBe(false);
    expect(dialog['errorEnvio']()).toBe('La presentación está desactivada');

    dialog['volverAFormulario']();
    expect(dialog['paso']()).toBe('formulario');
    dialog['cambiarCantidad'](id, '5');
    dialog['continuarARevision']();
    dialog['confirmar']();

    const segundoIntento = http.expectOne(`${base}/ventas/carrito`);
    expect(segundoIntento.request.body).toEqual({
      uuidCliente: dialog['uuidCliente'],
      fecha: dialog['form'].getRawValue().fecha,
      tipoCliente: 'PUBLICO',
      detalles: [{ presentacionId: 'pres-1', cantidad: 5 }]
    });
    http.verify();
  });

  it('verDetalle() cierra el diálogo señalando que se debe abrir el detalle', () => {
    const { dialog, http } = crearConCatalogoListo();
    const cerrarSpy = TestBed.inject(DialogRef).close as unknown as ReturnType<typeof vi.fn>;
    dialog['form'].controls.tipoCliente.setValue('PUBLICO');
    const id = primerId(dialog);
    llenarLinea(dialog, http, id, { productoId: 'prod-1', presentacionId: 'pres-1', cantidad: 1, precio: 10 });
    dialog['continuarARevision']();
    dialog['confirmar']();
    const venta = {
      id: 'v-1', fecha: dialog['form'].getRawValue().fecha, tipoCliente: 'PUBLICO' as const,
      detalles: [{ presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoNombre: 'Yogurt', cantidad: 1, precioUnitario: 10, subtotal: 10 }],
      total: 10
    };
    http.expectOne(`${base}/ventas/carrito`).flush(venta);

    dialog['verDetalle']();
    expect(cerrarSpy).toHaveBeenCalledWith({ venta, verDetalle: true });
    http.verify();
  });
});
