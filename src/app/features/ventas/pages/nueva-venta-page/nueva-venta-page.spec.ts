import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { ComprobanteVentaService } from '../../data-access/comprobante-venta.service';
import { PresentacionVentaResultado, VentaResumenResponse } from '../../data-access/venta.models';
import { Dialog } from '@angular/cdk/dialog';
import { EnviarWhatsappDialog } from '../../ui/enviar-whatsapp-dialog/enviar-whatsapp-dialog';
import { NuevaVentaPage } from './nueva-venta-page';

const base = environment.apiBaseUrl;

const TIPOS = (['MAYORISTA', 'PROVEEDOR', 'PUBLICO'] as const).map((codigo) => ({
  codigo,
  nombre: { MAYORISTA: 'Mayorista', PROVEEDOR: 'Proveedor', PUBLICO: 'Público' }[codigo],
  descripcion: '', activo: true, protegido: false, ultimoCambio: null,
  reglaComprador: ({ MAYORISTA: 'CLIENTE_HABILITADO', PROVEEDOR: 'PROVEEDOR_PADRON', PUBLICO: 'CUALQUIERA' } as const)[codigo]
}));

function resultado(id: string, producto: string, extra: Partial<PresentacionVentaResultado> = {}): PresentacionVentaResultado {
  return {
    presentacionId: id, productoId: `p-${id}`, productoNombre: producto, presentacionNombre: 'Botella 1 L', codigo: `PRD-00${id}`,
    stockVendible: 10, precio: 4.5, disponible: true, motivo: null, ...extra
  };
}

const LECHE = resultado('1', 'Leche entera');
const YOGURT = resultado('2', 'Yogurt de fresa', { precio: 6.2, stockVendible: 5 });

function ventaRegistrada(extra: Partial<VentaResumenResponse> = {}): VentaResumenResponse {
  return {
    id: 'venta-1', fecha: '2026-10-30', tipoCliente: 'PUBLICO', total: 9, detalles: [], comprador: null,
    tipoComprobante: 'NOTA_VENTA', comprobante: 'NV01-00000041', vendedorNombre: 'Vendedor', creadoEn: '2026-10-30T12:34:48', ...extra
  };
}

describe('NuevaVentaPage', () => {
  let fixture: ComponentFixture<NuevaVentaPage>;
  let http: HttpTestingController;
  let toast: ToastService;
  const comprobantes = { imprimir: vi.fn(() => of(undefined)), descargar: vi.fn(() => of(undefined)) };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pagina = () => fixture.componentInstance as any;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = (testid: string) => el().querySelector(`[data-testid="${testid}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
  const boton = (testid: string) => el().querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`)!;
  const lineas = () => Array.from(el().querySelectorAll('[data-testid="linea"]'));

  function crear(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ComprobanteVentaService, useValue: comprobantes }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(NuevaVentaPage);
    http.expectOne((r) => r.url.endsWith('/tipos-precio')).flush(TIPOS);
    fixture.detectChanges();
  }

  const agregar = (r: PresentacionVentaResultado, cantidad = 1) => {
    pagina().agregarProducto({ resultado: r, cantidad });
    fixture.detectChanges();
  };

  beforeEach(() => {
    comprobantes.imprimir.mockClear();
    comprobantes.descargar.mockClear();
    crear();
  });

  afterEach(() => http.verify());

  it('empieza con el canal Público, el carrito vacío y el botón de registrar deshabilitado diciendo qué falta', () => {
    expect(pagina().canal()).toBe('PUBLICO');
    expect(el().querySelector('[data-testid="carrito-vacio"]')).not.toBeNull();
    expect(texto('items')).toBe('0 ítems');
    expect(boton('registrar').disabled).toBe(true);
    expect(texto('pendientes')).toContain('agrega al menos un producto');
    expect(texto('numero-prevision')).toContain('Serie NV01');
  });

  it('agregar un producto lo pone en el carrito con su precio y suma el total y los artículos', () => {
    agregar(LECHE, 2);
    agregar(YOGURT, 1);

    expect(lineas()).toHaveLength(2);
    expect(texto('items')).toBe('2 ítems');
    expect(texto('articulos')).toBe('3');
    expect(texto('total')).toBe('S/ 15.20'); // 2 x 4.50 + 6.20
    expect(boton('registrar').disabled).toBe(false);
    expect(el().querySelector('[data-testid="pendientes"]')).toBeNull();
  });

  it('elegir otra vez el mismo producto suma a su línea y nunca pasa del stock vendible', () => {
    const toastError = vi.spyOn(toast, 'error');
    agregar(YOGURT, 3);
    agregar(YOGURT, 1);
    expect(lineas()).toHaveLength(1);
    expect(pagina().lineas()[0].cantidad).toBe(4);

    agregar(YOGURT, 3); // 4 + 3 = 7, pero solo hay 5
    expect(pagina().lineas()[0].cantidad).toBe(5);
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Solo hay 5 de Yogurt de fresa'));
  });

  it('la cantidad se cambia con los botones o escribiéndola, entre 1 y el stock; el total sigue a la cantidad', () => {
    agregar(LECHE, 2);
    const linea = () => pagina().lineas()[0];

    pagina().sumar(linea(), 1);
    expect(linea().cantidad).toBe(3);
    pagina().sumar(linea(), -1);
    pagina().sumar(linea(), -1);
    pagina().sumar(linea(), -1); // no baja de 1
    expect(linea().cantidad).toBe(1);

    pagina().cambiarCantidad(linea(), '7');
    expect(linea().cantidad).toBe(7);
    pagina().cambiarCantidad(linea(), '99'); // más que el stock: se ajusta
    expect(linea().cantidad).toBe(10);
    pagina().cambiarCantidad(linea(), 'abc');
    expect(linea().cantidad).toBe(1);
    fixture.detectChanges();
    expect(texto('total')).toBe('S/ 4.50');
  });

  it('quitar un producto lo saca del carrito', () => {
    agregar(LECHE);
    agregar(YOGURT);
    pagina().quitar(pagina().lineas()[0]);
    fixture.detectChanges();
    expect(lineas()).toHaveLength(1);
    expect(texto('total')).toBe('S/ 6.20');
  });

  it('cambiar el canal vuelve a consultar el precio de cada línea; sin precio para ese canal la línea bloquea el registro', () => {
    agregar(LECHE, 2);
    agregar(YOGURT, 1);

    pagina().cambiarCanal('PROVEEDOR');
    fixture.detectChanges();
    expect(texto('pendientes')).toContain('espera a que se consulte el precio');
    const pedidos = http.match((r) => r.url === `${base}/ventas/precio-vigente`);
    expect(pedidos).toHaveLength(2);
    expect(pedidos[0].request.params.get('tipoCliente')).toBe('PROVEEDOR');
    expect(pedidos[0].request.params.get('fecha')).toBe(pagina().fecha());
    pedidos.find((p) => p.request.params.get('presentacionId') === '1')!.flush({ precio: 3.5 });
    pedidos.find((p) => p.request.params.get('presentacionId') === '2')!.flush({ mensaje: 'Sin precio' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(texto('total')).toBe('S/ 7.00'); // la línea sin precio no suma
    expect(boton('registrar').disabled).toBe(true);
    expect(texto('pendientes')).toContain('hay productos sin precio para este canal y fecha');
  });

  it('una respuesta de precio tardía de un canal ya reemplazado nunca pisa el actual', () => {
    agregar(LECHE, 1);
    pagina().cambiarCanal('PROVEEDOR');
    const vieja = http.expectOne((r) => r.url === `${base}/ventas/precio-vigente`);
    pagina().cambiarCanal('PUBLICO');
    expect(vieja.cancelled).toBe(true);
    http.expectOne((r) => r.url === `${base}/ventas/precio-vigente` && r.params.get('tipoCliente') === 'PUBLICO').flush({ precio: 4.9 });
    expect(pagina().lineas()[0].precio).toBe(4.9);
  });

  it('un proveedor propone el canal para proveedores; un canal que exige un cliente habilitado no se puede elegir sin él', () => {
    expect(pagina().canalPermitido('MAYORISTA')).toBe(false);
    expect(pagina().motivoCanal('MAYORISTA')).toContain('cliente habilitado');

    pagina().elegirComprador({ tipo: 'PROVEEDOR', id: 'pv-1', nombre: 'Acopios Andinos', mayorista: false });
    expect(pagina().canal()).toBe('PROVEEDOR');

    pagina().elegirComprador({ tipo: 'CLIENTE', id: 'c-1', nombre: 'Rosa', mayorista: true, tiposHabilitados: ['MAYORISTA'], canalHabitual: 'MAYORISTA' });
    expect(pagina().canal()).toBe('MAYORISTA');

    pagina().elegirComprador(null); // sin comprador vuelve a Público
    expect(pagina().canal()).toBe('PUBLICO');
  });

  it('registrar envía la venta con su identificador, el canal, la fecha, las líneas, el comprador y el tipo de comprobante', () => {
    agregar(LECHE, 2);
    pagina().cambiarTipoComprobante('BOLETA');
    pagina().elegirComprador({ tipo: 'CLIENTE', id: 'c-1', nombre: 'Rosa Quispe', mayorista: false, canalHabitual: 'PUBLICO' });
    fixture.detectChanges();

    boton('registrar').click();
    const req = http.expectOne(`${base}/ventas/carrito`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      uuidCliente: expect.stringMatching(/^[0-9a-f-]{36}$/),
      fecha: pagina().fecha(),
      tipoCliente: 'PUBLICO',
      detalles: [{ presentacionId: '1', cantidad: 2 }],
      comprador: { tipo: 'CLIENTE', id: 'c-1' },
      tipoComprobante: 'BOLETA'
    });
    // sin precio ni stock en el cuerpo: los resuelve el servidor
    expect(JSON.stringify(req.request.body)).not.toContain('precio');
    req.flush(ventaRegistrada({ tipoComprobante: 'BOLETA', comprobante: 'B001-00000213', total: 9 }));
    fixture.detectChanges();

    expect(texto('comprobante-numero')).toBe('B001-00000213');
    expect(el().textContent).toContain('Venta registrada');
    expect(el().textContent).toContain('Boleta de venta electrónica');
    expect(el().querySelector('.layout')).toBeNull();
  });

  it('con una nota de venta por defecto y sin comprador manda comprador null', () => {
    agregar(LECHE, 1);
    boton('registrar').click();
    const req = http.expectOne(`${base}/ventas/carrito`);
    expect(req.request.body.tipoComprobante).toBe('NOTA_VENTA');
    expect(req.request.body.comprador).toBeNull();
    req.flush(ventaRegistrada());
  });

  it('un fallo de red reenvía EXACTAMENTE la misma venta (mismo identificador) y no la duplica', () => {
    agregar(LECHE, 2);
    boton('registrar').click();
    const primero = http.expectOne(`${base}/ventas/carrito`);
    const cuerpo = structuredClone(primero.request.body);
    primero.error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(texto('error-envio')).toContain('conserva su identificador');
    expect(boton('registrar').textContent).toContain('Reintentar');

    // aunque se toque el carrito, el reintento reenvía lo primero que se mandó
    agregar(YOGURT, 1);
    boton('registrar').click();
    const segundo = http.expectOne(`${base}/ventas/carrito`);
    expect(segundo.request.body).toEqual(cuerpo);
    segundo.flush(ventaRegistrada());
    fixture.detectChanges();
    expect(texto('comprobante-numero')).toBe('NV01-00000041');
  });

  it('un error del servidor se muestra y el siguiente intento arma la venta de nuevo', () => {
    agregar(LECHE, 2);
    boton('registrar').click();
    http.expectOne(`${base}/ventas/carrito`).flush({ mensaje: 'No hay stock suficiente' }, { status: 422, statusText: 'Unprocessable' });
    fixture.detectChanges();
    expect(texto('error-envio')).toBeTruthy();
    expect(boton('registrar').disabled).toBe(false);

    pagina().cambiarCantidad(pagina().lineas()[0], '1');
    fixture.detectChanges();
    boton('registrar').click();
    const req = http.expectOne(`${base}/ventas/carrito`);
    expect(req.request.body.detalles).toEqual([{ presentacionId: '1', cantidad: 1 }]);
    req.flush(ventaRegistrada());
  });

  it('F9 registra la venta igual que el botón, y solo si está lista', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F9', cancelable: true }));
    http.expectNone(`${base}/ventas/carrito`);

    agregar(LECHE, 1);
    const evento = new KeyboardEvent('keydown', { key: 'F9', cancelable: true });
    document.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(true);
    http.expectOne(`${base}/ventas/carrito`).flush(ventaRegistrada());
  });

  it('tras registrar se puede imprimir y descargar el comprobante, y empezar otra venta con un identificador nuevo', () => {
    agregar(LECHE, 1);
    boton('registrar').click();
    const primera = http.expectOne(`${base}/ventas/carrito`);
    const uuid1 = primera.request.body.uuidCliente;
    primera.flush(ventaRegistrada({ id: 'venta-9', comprobante: 'NV01-00000009' }));
    fixture.detectChanges();

    boton('imprimir').click();
    expect(comprobantes.imprimir).toHaveBeenCalledWith('venta-9');
    boton('descargar').click();
    expect(comprobantes.descargar).toHaveBeenCalledWith('venta-9', 'NV01-00000009');

    boton('nueva-venta').click();
    fixture.detectChanges();
    expect(el().querySelector('.layout')).not.toBeNull();
    expect(pagina().lineas()).toEqual([]);
    expect(pagina().canal()).toBe('PUBLICO');
    expect(pagina().tipoComprobante()).toBe('NOTA_VENTA');

    agregar(YOGURT, 1);
    boton('registrar').click();
    const segunda = http.expectOne(`${base}/ventas/carrito`);
    expect(segunda.request.body.uuidCliente).not.toBe(uuid1);
    segunda.flush(ventaRegistrada());
  });

  it('tras registrar se puede enviar el comprobante por WhatsApp (diálogo con la venta registrada)', () => {
    agregar(LECHE, 1);
    boton('registrar').click();
    const venta = ventaRegistrada({ id: 'venta-7', comprobante: 'NV01-00000007' });
    http.expectOne(`${base}/ventas/carrito`).flush(venta);
    fixture.detectChanges();

    const abrir = vi.spyOn(TestBed.inject(Dialog), 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    boton('whatsapp').click();

    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir.mock.calls[0][0]).toBe(EnviarWhatsappDialog);
    expect((abrir.mock.calls[0][1]?.data as { venta: VentaResumenResponse }).venta.comprobante).toBe('NV01-00000007');
  });

  it('el canal y la fecha son obligatorios para registrar', () => {
    agregar(LECHE, 1);
    pagina().cambiarFecha('');
    fixture.detectChanges();
    expect(texto('pendientes')).toContain('indica la fecha');
    expect(boton('registrar').disabled).toBe(true);
    pagina().cambiarFecha('2026-10-30'); // al volver a tener fecha se reconsulta el precio
    http.expectOne((r) => r.url === `${base}/ventas/precio-vigente` && r.params.get('fecha') === '2026-10-30').flush({ precio: 4.5 });

    pagina().cambiarCanal('');
    fixture.detectChanges();
    expect(texto('pendientes')).toContain('elige el canal');
  });
});
