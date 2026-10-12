import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { presentacion, producto, reserva } from '../../testing/datos';
import { CarritoStore } from '../../core/state/carrito.store';
import { ReservarPage } from './reservar';

const REGLAS = { fechasDisponibles: ['2026-10-12', '2026-10-13', '2026-10-14'], maxUnidades: 20, horasPendiente: 24 };

const CATALOGO = {
  productos: [
    producto({
      presentaciones: [
        presentacion({ id: 'pr-1', precio: 8.5 }),
        presentacion({ id: 'pr-2', nombre: 'Botella 500 ml', precio: null, precioAConfirmar: true }),
        presentacion({ id: 'pr-3', nombre: 'Agotada', disponibilidad: 'AGOTADO' })
      ]
    })
  ]
};

describe('ReservarPage', () => {
  let http: HttpTestingController;

  function crear(lineas: Array<[string, number]> = [['pr-1', 2]], reglas: unknown = REGLAS) {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const carrito = TestBed.inject(CarritoStore);
    for (const [id, cantidad] of lineas) carrito.agregar(id, cantidad);
    const fixture = TestBed.createComponent(ReservarPage);
    http.expectOne('/api/catalogo/productos').flush(CATALOGO);
    if (reglas) http.expectOne('/api/catalogo/reservas/reglas').flush(reglas);
    fixture.detectChanges();
    return { fixture, carrito, page: fixture.componentInstance as unknown as Record<string, any> };
  }

  afterEach(() => http.verify());

  const texto = (f: ComponentFixture<unknown>) => ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
  const llenar = (page: Record<string, any>, parcial: Record<string, string> = {}) =>
    page['form'].setValue({ fecha: '2026-10-13', nombre: 'Rosa Quispe', telefono: '987 654 321', correo: '', nota: '', ...parcial });
  const peticionReserva = (): TestRequest => http.expectOne((r) => r.url === '/api/catalogo/reservas' && r.method === 'POST');

  it('muestra las líneas con precio y disponibilidad reales y las fechas que informa el servidor (sin reglas propias)', () => {
    const { fixture } = crear([['pr-1', 2], ['pr-2', 1]]);
    const t = texto(fixture);
    expect(t).toContain('S/ 8.50 c/u');
    expect(t).toContain('Precio a confirmar');
    expect(t).toContain('Máximo 20 unidades por reserva');
    const fechas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.chip span')).map((e) => e.textContent?.trim());
    expect(fechas).toEqual(['Lunes 12 de octubre', 'Martes 13 de octubre', 'Miércoles 14 de octubre']);
    expect(t).toContain('Total: por confirmar'); // hay una línea sin precio: no se inventa un importe
  });

  it('con todos los precios publicados muestra un total ESTIMADO (orientativo)', () => {
    const { fixture } = crear([['pr-1', 3]]);
    expect(texto(fixture)).toContain('Total estimado: S/ 25.50');
  });

  it('el formulario vacío no se envía y marca los campos obligatorios', () => {
    const { fixture, page } = crear();
    page['enviar']();
    fixture.detectChanges();
    http.expectNone((r) => r.method === 'POST');
    const t = texto(fixture);
    expect(t).toContain('Elige una fecha de retiro.');
    expect(t).toContain('Indica tu nombre.');
    expect(t).toContain('Escribe un celular de 9 dígitos');
    expect(t).toContain('Revisa los campos marcados');
  });

  it('valida el teléfono peruano (9 dígitos que empiezan con 9, con o sin +51)', () => {
    const { page } = crear();
    const valido = (v: string) => { llenar(page, { telefono: v }); return page['form'].controls.telefono.valid; };
    for (const ok of ['987654321', '987 654 321', '+51 987654321', '51987654321', '987-654-321']) expect(valido(ok)).toBe(true);
    for (const mal of ['887654321', '98765432', '9876543210', 'abc', '+52987654321', '']) expect(valido(mal)).toBe(false);
  });

  it('muestra cuántas quedan, limita el + y bloquea el envío si se pidió más de lo que queda (con opción de usar el máximo)', () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(CarritoStore).agregar('pr-9', 3);
    const fixture = TestBed.createComponent(ReservarPage);
    const page = fixture.componentInstance as unknown as Record<string, any>;
    http.expectOne('/api/catalogo/productos').flush({
      productos: [producto({ presentaciones: [presentacion({ id: 'pr-9', nombre: 'Unidad', disponibilidad: 'POCAS_UNIDADES', unidadesDisponibles: 2 })] })]
    });
    http.expectOne('/api/catalogo/reservas/reglas').flush(REGLAS);
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Quedan 2 unidades');
    expect(texto(fixture)).toContain('Pediste 3 y solo quedan 2');
    llenar(page);
    page['enviar']();
    http.expectNone((r) => r.method === 'POST'); // no se envía algo que ya se sabe que será rechazado

    const usar = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.link-btn')).find((b) => b.textContent?.includes('Usar 2')) as HTMLButtonElement;
    usar.click();
    fixture.detectChanges();
    expect(texto(fixture)).not.toContain('Pediste');
    const mas = (fixture.nativeElement as HTMLElement).querySelector('button[aria-label="Agregar una unidad"]') as HTMLButtonElement;
    expect(mas.disabled).toBe(true); // ya está en el máximo
    page['enviar']();
    peticionReserva().flush(reserva());
  });

  it('sin productos no se puede enviar y se invita a ver el catálogo', () => {
    const { fixture, page } = crear([]);
    expect(texto(fixture)).toContain('Todavía no agregaste productos');
    llenar(page);
    page['enviar']();
    http.expectNone((r) => r.method === 'POST');
  });

  it('un producto que ya no está disponible bloquea el envío hasta quitarlo', () => {
    const { fixture, page, carrito } = crear([['pr-1', 1], ['pr-3', 1]]);
    expect(texto(fixture)).toContain('Este producto ya no está disponible');
    llenar(page);
    page['enviar']();
    http.expectNone((r) => r.method === 'POST');
    carrito.quitar('pr-3');
    page['enviar']();
    peticionReserva().flush(reserva());
  });

  it('envía exactamente lo que el usuario eligió y muestra el código y el estado REAL que devuelve el servidor', () => {
    const { fixture, page, carrito } = crear([['pr-1', 2], ['pr-2', 1]]);
    llenar(page, { nombre: '  Rosa Quispe ', correo: 'rosa@correo.pe', nota: 'Paso por la tarde' });
    page['enviar']();

    const req = peticionReserva();
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.body).toMatchObject({
      nombreCliente: 'Rosa Quispe', telefono: '987 654 321', correo: 'rosa@correo.pe', fechaRetiro: '2026-10-13', nota: 'Paso por la tarde',
      lineas: [{ presentacionId: 'pr-1', cantidad: 2 }, { presentacionId: 'pr-2', cantidad: 1 }]
    });
    expect(req.request.body.uuidCliente).toMatch(/^[0-9a-f-]{36}$/);
    req.flush(reserva({ codigo: 'ZX9KQ2MNB4', estado: 'PENDIENTE', precioAConfirmar: true, total: null }));
    fixture.detectChanges();

    const t = texto(fixture);
    expect(t).toContain('ZX9KQ2MNB4');
    expect(t).toContain('Pendiente de confirmación');
    expect(t).toContain('Todavía no está confirmada');
    expect(t).toContain('precio a confirmar');
    expect(t).toContain('Total: por confirmar');
    expect(carrito.lineas()).toEqual([]); // el borrador se vacía tras registrar la reserva
  });

  it('nunca presenta como confirmada una reserva que el servidor no confirmó', () => {
    const { fixture, page } = crear();
    llenar(page);
    page['enviar']();
    peticionReserva().flush(reserva({ estado: 'PENDIENTE' }));
    fixture.detectChanges();
    expect(texto(fixture)).not.toContain('Estado: Confirmada');
    expect(texto(fixture)).toContain('Estado: Pendiente de confirmación');
  });

  it('clics repetidos mientras se envía generan UNA sola solicitud', () => {
    const { fixture, page } = crear();
    llenar(page);
    page['enviar']();
    page['enviar']();
    page['enviar']();
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Enviando tu solicitud…');
    expect(((fixture.nativeElement as HTMLElement).querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true);
    const req = peticionReserva(); // expectOne falla si hubiera más de una
    req.flush(reserva());
  });

  it('tras un fallo de red el reintento reutiliza la misma clave de idempotencia (no duplica la reserva)', () => {
    const { page, fixture } = crear();
    llenar(page);
    page['enviar']();
    const primera = peticionReserva();
    const uuid = primera.request.body.uuidCliente;
    primera.error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(texto(fixture)).toContain('no se duplicará tu reserva');

    page['enviar']();
    const segunda = peticionReserva();
    expect(segunda.request.body.uuidCliente).toBe(uuid);
    segunda.flush(reserva());
  });

  it('tras un rechazo definitivo (400) y un cambio de datos, se usa una clave nueva', () => {
    const { page, fixture } = crear();
    llenar(page);
    page['enviar']();
    const primera = peticionReserva();
    const uuid = primera.request.body.uuidCliente;
    primera.flush({ mensaje: 'Ya no se aceptan retiros para hoy.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Ya no se aceptan retiros para hoy.');

    llenar(page, { fecha: '2026-10-14' });
    page['enviar']();
    const segunda = peticionReserva();
    expect(segunda.request.body.uuidCliente).not.toBe(uuid);
    segunda.flush(reserva());
  });

  it('muestra el mensaje del servidor ante un conflicto (409) y conserva lo que el usuario escribió', () => {
    const { page, fixture, carrito } = crear();
    llenar(page);
    page['enviar']();
    peticionReserva().flush({ mensaje: 'Este teléfono ya tiene 2 reservas pendientes.' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Este teléfono ya tiene 2 reservas pendientes.');
    expect(page['form'].controls.nombre.value).toBe('Rosa Quispe');
    expect(carrito.lineas()).toHaveLength(1);
  });

  it('si no se pueden cargar las fechas muestra el error con reintento y bloquea el envío', () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(CarritoStore).agregar('pr-1', 1);
    const fixture = TestBed.createComponent(ReservarPage);
    const page = fixture.componentInstance as unknown as Record<string, any>;
    http.expectOne('/api/catalogo/productos').flush(CATALOGO);
    http.expectOne('/api/catalogo/reservas/reglas').error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(texto(fixture)).toContain('No pudimos conectar');
    llenar(page);
    page['enviar']();
    http.expectNone((r) => r.method === 'POST');

    page['cargarReglas']();
    http.expectOne('/api/catalogo/reservas/reglas').flush(REGLAS);
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Lunes 12 de octubre');
  });

  it('sin fechas disponibles lo dice y no permite reservar', () => {
    const { fixture } = crear([['pr-1', 1]], { fechasDisponibles: [], maxUnidades: 20, horasPendiente: 24 });
    expect(texto(fixture)).toContain('no hay fechas de retiro disponibles');
  });
});
