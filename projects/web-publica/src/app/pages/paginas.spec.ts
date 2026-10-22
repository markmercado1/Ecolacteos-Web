import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from '../app';
import { routes } from '../app.routes';
import { CarritoStore } from '../core/state/carrito.store';
import { presentacion, producto } from '../testing/datos';
import { CatalogoPage } from './catalogo/catalogo';
import { ContactoPage } from './contacto/contacto';
import { FaqsPage } from './faqs/faqs';
import { InicioPage } from './inicio/inicio';
import { ProductoPage } from './producto/producto';
import { QuienesSomosPage } from './quienes-somos/quienes-somos';

const CATALOGO = {
  productos: [
    producto({ id: 'p-1', nombre: 'Queso Fresco', familia: 'Quesos', fotoUrl: '/api/catalogo/fotos/q.png', presentaciones: [presentacion({ id: 'a', nombre: 'Unidad', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'unidad', precio: 15 })] }),
    producto({ id: 'p-2', nombre: 'Yogurt Natural', familia: 'Yogures', presentaciones: [presentacion({ id: 'b', nombre: 'Botella 1 L', precio: null, precioAConfirmar: true, disponibilidad: 'POCAS_UNIDADES' }), presentacion({ id: 'c', nombre: 'Botella 500 ml', contenidoCantidad: 500, contenidoUnidad: 'ML', precio: 6.5 })] }),
    producto({ id: 'p-3', nombre: 'Queso Andino', familia: 'Quesos', presentaciones: [presentacion({ id: 'd', nombre: 'Pieza', disponibilidad: 'AGOTADO', precio: 22 })] })
  ]
};

const texto = (f: ComponentFixture<unknown>) => ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

describe('páginas públicas', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  describe('Catálogo', () => {
    function crear() {
      const f = TestBed.createComponent(CatalogoPage);
      http.expectOne('/api/catalogo/productos').flush(CATALOGO);
      f.detectChanges();
      return { f, page: f.componentInstance as unknown as Record<string, any> };
    }

    it('lista los productos reales con su disponibilidad y su precio', () => {
      const { f } = crear();
      const t = texto(f);
      expect(t).toContain('3 productos');
      expect(t).toContain('Queso Fresco');
      expect(t).toContain('S/ 15.00');
      expect(t).toContain('Agotado');
      expect(t).toContain('Agregar a mi reserva'); // el queso tiene una sola presentación
    });

    it('las presentaciones se eligen con etiquetas dentro de la tarjeta y la elegida decide precio, disponibilidad y la reserva', () => {
      const f = TestBed.createComponent(CatalogoPage);
      http.expectOne('/api/catalogo/productos').flush({
        productos: [producto({
          fotoUrl: '/api/catalogo/fotos/producto.png',
          presentaciones: [
            presentacion({ id: 'x1', nombre: 'Botella 500 ml', precio: 6.5, disponibilidad: 'POCAS_UNIDADES', unidadesDisponibles: 3, fotoUrl: '/api/catalogo/fotos/500.png' }),
            presentacion({ id: 'x2', nombre: 'Botella 1 L', precio: null, precioAConfirmar: true }),
            presentacion({ id: 'x3', nombre: 'Familiar', precio: 20, disponibilidad: 'AGOTADO' })
          ]
        })]
      });
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      const etiquetas = () => Array.from(el.querySelectorAll('.etiqueta')) as HTMLButtonElement[];
      const principal = () => Array.from(el.querySelectorAll('.cuerpo button')).find((b) => /Agregar|Agregado|Ya tienes/.test(b.textContent ?? '')) as HTMLButtonElement;

      expect(etiquetas().map((b) => b.textContent?.trim())).toEqual(['Botella 500 ml', 'Botella 1 L', 'Familiar (agotada)']);
      expect(etiquetas()[0].getAttribute('aria-pressed')).toBe('true'); // la primera no agotada
      expect(texto(f)).toContain('S/ 6.50');
      expect(texto(f)).toContain('Quedan 3 unidades');
      expect(el.querySelector('.media img')?.getAttribute('src')).toBe('/api/catalogo/fotos/500.png'); // foto de la presentación

      etiquetas()[1].click();
      f.detectChanges();
      expect(texto(f)).toContain('Precio a confirmar');
      expect(texto(f)).toContain('Disponible');
      expect(el.querySelector('.media img')?.getAttribute('src')).toBe('/api/catalogo/fotos/producto.png'); // sin foto propia: la del producto
      principal().click();
      expect(TestBed.inject(CarritoStore).lineas()).toEqual([{ presentacionId: 'x2', cantidad: 1 }]);

      etiquetas()[2].click();
      f.detectChanges();
      expect(principal().disabled).toBe(true); // la agotada se puede ver pero no reservar
    });

    it('con pocas unidades la tarjeta dice cuántas quedan y no deja agregar más de las que hay', () => {
      const f = TestBed.createComponent(CatalogoPage);
      http.expectOne('/api/catalogo/productos').flush({
        productos: [producto({ presentaciones: [presentacion({ id: 'q', disponibilidad: 'POCAS_UNIDADES', unidadesDisponibles: 2 })] })]
      });
      f.detectChanges();
      expect(texto(f)).toContain('Quedan 2 unidades');
      const boton = () => Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => /Agregar|Agregado|Ya tienes/.test(b.textContent ?? '')) as HTMLButtonElement;
      boton().click();
      boton().click();
      boton().click(); // la tercera ya no cabe
      f.detectChanges();
      expect(TestBed.inject(CarritoStore).lineas()).toEqual([{ presentacionId: 'q', cantidad: 2 }]);
      expect(boton().textContent).toContain('Ya tienes todas');
    });

    it('un producto sin ningún precio publicado muestra «Precio a confirmar» (nunca un importe inventado)', () => {
      const f = TestBed.createComponent(CatalogoPage);
      http.expectOne('/api/catalogo/productos').flush({ productos: [producto({ presentaciones: [presentacion({ precio: null, precioAConfirmar: true })] })] });
      f.detectChanges();
      expect(texto(f)).toContain('Precio a confirmar');
      expect(texto(f)).not.toContain('S/');
    });

    it('un producto agotado no se puede agregar a la reserva desde la tarjeta', () => {
      const f = TestBed.createComponent(CatalogoPage);
      http.expectOne('/api/catalogo/productos').flush({ productos: [CATALOGO.productos[2]] });
      f.detectChanges();
      const b = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((x) => x.textContent?.includes('Agregar a mi reserva')) as HTMLButtonElement;
      expect(b.disabled).toBe(true);
    });

    it('busca sin distinguir tildes ni mayúsculas, filtra por categoría y por disponibles', () => {
      const { f, page } = crear();
      page['texto'].set('YOGURT');
      f.detectChanges();
      expect(texto(f)).toContain('1 producto');
      page['limpiar']();
      page['familia'].set('Quesos');
      expect(page['filtrados']().map((p: { nombre: string }) => p.nombre)).toEqual(['Queso Fresco', 'Queso Andino']);
      page['soloDisponibles'].set(true);
      expect(page['filtrados']().map((p: { nombre: string }) => p.nombre)).toEqual(['Queso Fresco']);
      page['texto'].set('zzz');
      f.detectChanges();
      expect(texto(f)).toContain('Ningún producto coincide');
    });

    it('si el servidor falla muestra el error con «Reintentar» y NO muestra productos de relleno', () => {
      const f = TestBed.createComponent(CatalogoPage);
      http.expectOne('/api/catalogo/productos').flush({}, { status: 500, statusText: 'Error' });
      f.detectChanges();
      const t = texto(f);
      expect(t).toContain('No pudimos cargar la información');
      expect(t).toContain('Reintentar');
      expect(t).not.toContain('Queso Fresco');
      const reintentar = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Reintentar')) as HTMLButtonElement;
      reintentar.click();
      http.expectOne('/api/catalogo/productos').flush(CATALOGO);
      f.detectChanges();
      expect(texto(f)).toContain('Queso Fresco');
    });

    it('un catálogo vacío lo dice claramente', () => {
      const f = TestBed.createComponent(CatalogoPage);
      http.expectOne('/api/catalogo/productos').flush({ productos: [] });
      f.detectChanges();
      expect(texto(f)).toContain('Por ahora no hay productos publicados');
    });
  });

  describe('Detalle de producto', () => {
    it('muestra cada presentación con su precio y disponibilidad y agrega a la reserva con la cantidad elegida', () => {
      const f = TestBed.createComponent(ProductoPage);
      f.componentRef.setInput('id', 'p-2');
      http.expectOne('/api/catalogo/productos').flush(CATALOGO);
      f.detectChanges();
      const t = texto(f);
      expect(t).toContain('Yogurt Natural');
      expect(t).toContain('Precio a confirmar');
      expect(t).toContain('S/ 6.50');
      expect(t).toContain('Podrás reservarla igual');

      const page = f.componentInstance as unknown as Record<string, any>;
      page['fijarCantidad']('c', '3');
      page['agregar'](CATALOGO.productos[1].presentaciones[1]);
      expect(TestBed.inject(CarritoStore).lineas()).toEqual([{ presentacionId: 'c', cantidad: 3 }]);
      f.detectChanges();
      expect(texto(f)).toContain('agregado a tu reserva');
    });

    it('con pocas unidades limita la cantidad a las que quedan y lo explica', () => {
      const f = TestBed.createComponent(ProductoPage);
      f.componentRef.setInput('id', 'p-poca');
      http.expectOne('/api/catalogo/productos').flush({
        productos: [producto({ id: 'p-poca', presentaciones: [presentacion({ id: 'z', disponibilidad: 'POCAS_UNIDADES', unidadesDisponibles: 2 })] })]
      });
      f.detectChanges();
      expect(texto(f)).toContain('Quedan 2 unidades');
      const input = (f.nativeElement as HTMLElement).querySelector('input[type=number]') as HTMLInputElement;
      expect(input.getAttribute('max')).toBe('2');
      const page = f.componentInstance as unknown as Record<string, any>;
      page['fijarCantidad']('z', '5');
      page['agregar']({ id: 'z', nombre: 'Botella 1 L', unidadesDisponibles: 2 });
      expect(TestBed.inject(CarritoStore).lineas()).toEqual([{ presentacionId: 'z', cantidad: 2 }]);
      f.detectChanges();
      expect(texto(f)).toContain('quedan 2 unidades; dejamos esa cantidad en tu reserva');
    });

    it('un producto inexistente se indica sin romper la página', () => {
      const f = TestBed.createComponent(ProductoPage);
      f.componentRef.setInput('id', 'no-existe');
      http.expectOne('/api/catalogo/productos').flush(CATALOGO);
      f.detectChanges();
      expect(texto(f)).toContain('No encontramos ese producto');
    });

    it('una presentación agotada no se puede agregar', () => {
      const f = TestBed.createComponent(ProductoPage);
      f.componentRef.setInput('id', 'p-3');
      http.expectOne('/api/catalogo/productos').flush(CATALOGO);
      f.detectChanges();
      const boton = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Agotado') as HTMLButtonElement;
      expect(boton.disabled).toBe(true);
    });
  });

  describe('Inicio', () => {
    it('el carrusel de la portada usa las mismas tarjetas con productos reales (sin los agotados) y la foto real primero', () => {
      const f = TestBed.createComponent(InicioPage);
      http.expectOne('/api/catalogo/productos').flush(CATALOGO);
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      const t = texto(f);
      expect(el.querySelector('pub-carrusel-productos')).not.toBeNull();
      expect(t).toContain('Queso Fresco');
      expect(t).toContain('Yogurt Natural');
      expect(t).not.toContain('Queso Andino'); // agotado
      const tarjetas = Array.from(el.querySelectorAll('pub-producto-card h3')).map((h) => h.textContent?.trim());
      expect(tarjetas).toEqual(['Queso Fresco', 'Yogurt Natural']); // con foto primero
      expect(el.querySelector('pub-producto-card .media img')?.getAttribute('src')).toBe('/api/catalogo/fotos/q.png');
      expect(Array.from(el.querySelectorAll('.puntos button'))).toHaveLength(2);
    });

    it('el carrusel navega con las flechas y los puntos', () => {
      const f = TestBed.createComponent(InicioPage);
      http.expectOne('/api/catalogo/productos').flush(CATALOGO);
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      const puntos = () => Array.from(el.querySelectorAll('.puntos button')) as HTMLButtonElement[];
      const activo = () => puntos().findIndex((b) => b.classList.contains('activo'));
      expect(activo()).toBe(0);
      (el.querySelector('button[aria-label="Productos siguientes"]') as HTMLButtonElement).click();
      f.detectChanges();
      expect(activo()).toBe(1);
      (el.querySelector('button[aria-label="Productos siguientes"]') as HTMLButtonElement).click(); // vuelve al inicio
      f.detectChanges();
      expect(activo()).toBe(0);
      puntos()[1].click();
      f.detectChanges();
      expect(activo()).toBe(1);
    });

    it('muestra tarjetas completas por página: si todas caben a la vez no hay controles; si no, hay una página por grupo', () => {
      const f = TestBed.createComponent(InicioPage);
      http.expectOne('/api/catalogo/productos').flush(CATALOGO);
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      const carrusel = f.debugElement.query((d) => d.name === 'pub-carrusel-productos').componentInstance as Record<string, any>;
      carrusel['porPagina'].set(2); // 2 productos reservables, caben de a 2: una sola página
      f.detectChanges();
      expect(carrusel['paginas']()).toBe(1);
      expect(el.querySelector('.controles')).toBeNull();
      carrusel['porPagina'].set(1);
      f.detectChanges();
      expect(carrusel['paginas']()).toBe(2);
      expect(el.querySelectorAll('.puntos button')).toHaveLength(2);
    });

    it('con un solo producto no hay controles de carrusel', () => {
      const f = TestBed.createComponent(InicioPage);
      http.expectOne('/api/catalogo/productos').flush({ productos: [CATALOGO.productos[0]] });
      f.detectChanges();
      expect((f.nativeElement as HTMLElement).querySelector('.controles')).toBeNull();
      expect(texto(f)).toContain('Queso Fresco');
    });

    it('sin productos reservables la portada muestra el logo en vez del carrusel', () => {
      const f = TestBed.createComponent(InicioPage);
      http.expectOne('/api/catalogo/productos').flush({ productos: [CATALOGO.productos[2]] }); // solo agotados
      f.detectChanges();
      expect((f.nativeElement as HTMLElement).querySelector('pub-carrusel-productos')).toBeNull();
      expect((f.nativeElement as HTMLElement).querySelector('.logo-grande')).not.toBeNull();
    });

    it('si el catálogo falla, la portada sigue visible y los destacados muestran el error con reintento', () => {
      const f = TestBed.createComponent(InicioPage);
      http.expectOne('/api/catalogo/productos').error(new ProgressEvent('error'));
      f.detectChanges();
      const t = texto(f);
      expect(t).toContain('Ver catálogo');
      expect(t).toContain('No pudimos cargar la información');
    });
  });

  describe('Contenido institucional', () => {
    it('Quiénes somos muestra el texto configurado', () => {
      const f = TestBed.createComponent(QuienesSomosPage);
      f.detectChanges();
      expect(texto(f)).toContain('EcoLácteos Huata es una empresa de productos lácteos');
    });

    it('Contacto, sin WhatsApp ni teléfono configurados, no los muestra y ofrece las reservas en línea', () => {
      const f = TestBed.createComponent(ContactoPage);
      f.detectChanges();
      const t = texto(f);
      expect(t).not.toContain('WhatsApp');
      expect(t).not.toContain('Teléfono');
      expect(t).toContain('Reservas en línea');
    });

    it('Contacto muestra la ubicación con el botón «Cómo llegar» y el mapa incrustado de Google Maps', () => {
      const f = TestBed.createComponent(ContactoPage);
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      expect(texto(f)).toContain('Dónde encontrarnos');
      const boton = Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.includes('Cómo llegar')) as HTMLAnchorElement;
      expect(boton.href).toContain('maps.app.goo.gl');
      expect(boton.rel).toContain('noopener');
      const iframe = el.querySelector('pub-mapa-ubicacion iframe') as HTMLIFrameElement;
      expect(iframe.src).toContain('https://www.google.com/maps');
      expect(iframe.title).toContain('EcoLácteos Huata');
      expect(iframe.getAttribute('loading')).toBe('lazy');
    });

    it('Preguntas frecuentes describe el funcionamiento real de las reservas', () => {
      const f = TestBed.createComponent(FaqsPage);
      f.detectChanges();
      const t = texto(f);
      expect(t).toContain('Esta web no cobra ni procesa pagos');
      expect(t).toContain('Pendiente de confirmación');
      expect(t).toContain('código de seguimiento');
    });
  });

  describe('Estructura', () => {
    it('no muestra el botón flotante de WhatsApp si no hay un número oficial configurado', () => {
      const f = TestBed.createComponent(App);
      f.detectChanges();
      expect((f.nativeElement as HTMLElement).querySelector('.whatsapp')).toBeNull();
      expect(texto(f)).toContain('Consultar reserva');
      expect(texto(f)).toContain('Mi reserva');
    });

    it('el contador de «Mi reserva» refleja el borrador', () => {
      TestBed.inject(CarritoStore).agregar('x');
      const f = TestBed.createComponent(App);
      f.detectChanges();
      expect((f.nativeElement as HTMLElement).querySelector('.cuenta')?.textContent?.trim()).toBe('1');
    });

    it('todas las rutas están definidas y las desconocidas caen en «no encontrada»', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
      const router = TestBed.inject(Router);
      for (const ruta of ['/', '/catalogo', '/producto/x', '/reservar', '/consultar-reserva', '/quienes-somos', '/contacto', '/preguntas-frecuentes']) {
        expect(await router.navigateByUrl(ruta), ruta).toBe(true);
      }
      await router.navigateByUrl('/no-existe');
      expect(router.url).toBe('/no-existe');
      const rutas = routes.map((r) => r.path);
      expect(rutas).toEqual(expect.arrayContaining(['catalogo', 'reservar', 'consultar-reserva', 'quienes-somos', 'contacto', 'preguntas-frecuentes', '**']));
      TestBed.inject(HttpTestingController).match(() => true).forEach((r) => r.flush({ productos: [], fechasDisponibles: [], maxUnidades: 20, horasPendiente: 24 }));
    });
  });
});
