import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { presentacion, producto } from '../../testing/datos';
import { CarritoStore, MAX_LINEAS } from './carrito.store';
import { CatalogoStore } from './catalogo.store';

describe('CatalogoStore', () => {
  let http: HttpTestingController;
  let store: CatalogoStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(CatalogoStore);
  });
  afterEach(() => http.verify());

  it('carga el catálogo real una sola vez mientras esté vigente', () => {
    store.cargar();
    expect(store.estado()).toBe('cargando');
    http.expectOne('/api/catalogo/productos').flush({ productos: [producto()] });
    expect(store.estado()).toBe('listo');
    expect(store.productos()).toHaveLength(1);
    store.cargar(); // vigente: no repite la petición
    http.expectNone('/api/catalogo/productos');
  });

  it('un fallo deja el estado en error SIN inventar productos y permite reintentar', () => {
    store.cargar();
    http.expectOne('/api/catalogo/productos').flush({ mensaje: 'x' }, { status: 500, statusText: 'Error' });
    expect(store.estado()).toBe('error');
    expect(store.productos()).toEqual([]);
    expect(store.error()).toContain('servidor');

    store.cargar(true);
    http.expectOne('/api/catalogo/productos').flush({ productos: [producto()] });
    expect(store.estado()).toBe('listo');
    expect(store.error()).toBeNull();
  });

  it('sin conexión informa un mensaje de red', () => {
    store.cargar();
    http.expectOne('/api/catalogo/productos').error(new ProgressEvent('error'));
    expect(store.error()).toContain('conectar');
  });

  it('indexa las presentaciones por id con su producto', () => {
    store.cargar();
    http.expectOne('/api/catalogo/productos').flush({ productos: [producto({ presentaciones: [presentacion({ id: 'a' }), presentacion({ id: 'b' })] })] });
    expect(store.presentaciones().get('b')?.producto.nombre).toBe('Yogurt Natural');
    expect(store.presentaciones().has('zzz')).toBe(false);
  });

  it('ninguna petición pública lleva credenciales aunque haya un token del panel guardado', () => {
    localStorage.setItem('ecolacteos.sesion.v1', JSON.stringify({ token: 'token-del-panel' }));
    store.cargar();
    const req = http.expectOne('/api/catalogo/productos');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.withCredentials).toBe(false);
    req.flush({ productos: [] });
    localStorage.removeItem('ecolacteos.sesion.v1');
  });
});

describe('CarritoStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('agrega, suma, cambia y quita líneas', () => {
    const c = TestBed.inject(CarritoStore);
    expect(c.agregar('a', 2)).toBe('agregada');
    expect(c.agregar('a', 3)).toBe('sumada');
    c.agregar('b');
    expect(c.lineas()).toEqual([{ presentacionId: 'a', cantidad: 5 }, { presentacionId: 'b', cantidad: 1 }]);
    c.cambiarCantidad('a', 0);
    expect(c.lineas()[0].cantidad).toBe(1); // nunca menos de 1
    c.cambiarCantidad('a', 7.9);
    expect(c.lineas()[0].cantidad).toBe(7);
    c.quitar('a');
    expect(c.lineas()).toEqual([{ presentacionId: 'b', cantidad: 1 }]);
    c.vaciar();
    expect(c.cantidadLineas()).toBe(0);
  });

  it('el tope de unidades disponibles limita lo que se agrega (ayuda de pantalla; el servidor valida al enviar)', () => {
    const c = TestBed.inject(CarritoStore);
    expect(c.agregar('a', 5, 2)).toBe('limitada');
    expect(c.lineas()).toEqual([{ presentacionId: 'a', cantidad: 2 }]);
    expect(c.agregar('a', 1, 2)).toBe('tope'); // ya tiene todas: no cambia nada
    expect(c.lineas()[0].cantidad).toBe(2);
    expect(c.agregar('b', 1, 3)).toBe('agregada');
    expect(c.agregar('b', 1, 3)).toBe('sumada');
    expect(c.agregar('b', 5, 3)).toBe('limitada');
    expect(c.lineas()[1].cantidad).toBe(3);
    expect(c.agregar('c', 4, null)).toBe('agregada'); // sin tope publicado: no se limita
  });

  it('respeta el máximo de líneas distintas', () => {
    const c = TestBed.inject(CarritoStore);
    for (let i = 0; i < MAX_LINEAS; i++) c.agregar(`p${i}`);
    expect(c.agregar('otra')).toBe('llena');
    expect(c.cantidadLineas()).toBe(MAX_LINEAS);
    expect(c.agregar('p0')).toBe('sumada');
  });

  it('el borrador sobrevive a una recarga (sessionStorage) y un valor corrupto no rompe nada', () => {
    TestBed.inject(CarritoStore).agregar('x', 4);
    TestBed.resetTestingModule();
    expect(TestBed.inject(CarritoStore).lineas()).toEqual([{ presentacionId: 'x', cantidad: 4 }]);

    sessionStorage.setItem('ecolacteos.publico.reserva.v1', '{no es json');
    TestBed.resetTestingModule();
    expect(TestBed.inject(CarritoStore).lineas()).toEqual([]);

    sessionStorage.setItem('ecolacteos.publico.reserva.v1', JSON.stringify([{ presentacionId: 1, cantidad: 'x' }, { presentacionId: 'ok', cantidad: 2 }]));
    TestBed.resetTestingModule();
    expect(TestBed.inject(CarritoStore).lineas()).toEqual([{ presentacionId: 'ok', cantidad: 2 }]);
  });

  it('no guarda datos personales', () => {
    TestBed.inject(CarritoStore).agregar('x');
    expect(sessionStorage.getItem('ecolacteos.publico.reserva.v1')).toBe(JSON.stringify([{ presentacionId: 'x', cantidad: 1 }]));
  });
});
