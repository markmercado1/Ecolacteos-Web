import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { PresentacionVentaResultado } from '../../data-access/venta.models';
import { BuscadorProductosComponent, ProductoElegido } from './buscador-productos';

const base = environment.apiBaseUrl;

function resultado(id: string, producto: string, extra: Partial<PresentacionVentaResultado> = {}): PresentacionVentaResultado {
  return {
    presentacionId: id, productoId: `p-${id}`, productoNombre: producto, presentacionNombre: 'Botella 1 L', codigo: `PRD-00${id}`,
    stockVendible: 10, precio: 4.5, disponible: true, motivo: null, ...extra
  };
}

const LECHE = resultado('1', 'Leche entera');
const AGOTADA = resultado('2', 'Leche light', { stockVendible: 0, precio: 5, disponible: false, motivo: 'SIN_STOCK' });
const SIN_PRECIO = resultado('3', 'Leche de soya', { precio: null, disponible: false, motivo: 'SIN_PRECIO' });
const YOGURT = resultado('4', 'Yogurt de leche', { precio: 6.2 });

describe('BuscadorProductosComponent', () => {
  let fixture: ComponentFixture<BuscadorProductosComponent>;
  let http: HttpTestingController;
  let elegidos: ProductoElegido[];

  const el = () => fixture.nativeElement as HTMLElement;
  const entrada = () => el().querySelector<HTMLInputElement>('input[role="combobox"]')!;
  const cantidad = () => el().querySelector<HTMLInputElement>('.cantidad input')!;
  const opciones = () => Array.from(el().querySelectorAll<HTMLElement>('[role="option"]'));

  function escribir(texto: string): void {
    entrada().value = texto;
    entrada().dispatchEvent(new Event('input'));
  }

  function buscar(texto: string, respuesta: PresentacionVentaResultado[]): void {
    escribir(texto);
    vi.advanceTimersByTime(150);
    http.expectOne((r) => r.url === `${base}/ventas/presentaciones` && r.params.get('q') === texto).flush(respuesta);
    fixture.detectChanges();
  }

  function tecla(key: string): void {
    entrada().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BuscadorProductosComponent);
    fixture.componentRef.setInput('canal', 'PUBLICO');
    fixture.componentRef.setInput('fecha', '2026-10-30');
    elegidos = [];
    fixture.componentInstance.agregar.subscribe((e) => elegidos.push(e));
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('busca con el canal y la fecha de la venta, espera a que se deje de escribir y resalta lo escrito', () => {
    escribir('l');
    escribir('le');
    escribir('lec');
    vi.advanceTimersByTime(149);
    http.expectNone(`${base}/ventas/presentaciones`);
    vi.advanceTimersByTime(1);

    const req = http.expectOne((r) => r.url === `${base}/ventas/presentaciones`);
    expect(req.request.params.get('q')).toBe('lec');
    expect(req.request.params.get('tipoCliente')).toBe('PUBLICO');
    expect(req.request.params.get('fecha')).toBe('2026-10-30');
    expect(req.request.params.get('limite')).toBe('10');
    req.flush([LECHE]);
    fixture.detectChanges();

    expect(opciones()).toHaveLength(1);
    expect(opciones()[0].textContent).toContain('Leche entera');
    expect(opciones()[0].textContent).toContain('PRD-001');
    expect(opciones()[0].textContent).toContain('Stock 10');
    expect(opciones()[0].textContent).toContain('S/ 4.50');
    expect(opciones()[0].querySelector('mark')?.textContent).toBe('Lec');
    expect(entrada().getAttribute('aria-expanded')).toBe('true');
  });

  it('un producto sin stock o sin precio se ve con su motivo y no se puede agregar', () => {
    buscar('leche', [AGOTADA, SIN_PRECIO, LECHE]);

    expect(opciones()[0].textContent).toContain('Agotado');
    expect(opciones()[1].textContent).toContain('Sin precio para este canal');
    expect(opciones()[0].getAttribute('aria-disabled')).toBe('true');

    opciones()[0].click();
    opciones()[1].click();
    expect(elegidos).toEqual([]);

    opciones()[2].click();
    expect(elegidos).toHaveLength(1);
    expect(elegidos[0].resultado.presentacionId).toBe('1');
  });

  it('Enter agrega el resaltado con la cantidad escrita y deja el buscador listo para el siguiente producto', () => {
    buscar('lec', [LECHE, YOGURT]);
    cantidad().value = '3';
    cantidad().dispatchEvent(new Event('input'));

    tecla('Enter');

    expect(elegidos).toEqual([{ resultado: LECHE, cantidad: 3 }]);
    fixture.detectChanges();
    expect(entrada().value).toBe('');
    expect(cantidad().value).toBe('1');
    expect(opciones()).toHaveLength(0);
    expect(document.activeElement).toBe(entrada());
  });

  it('las flechas se saltan lo que no se puede agregar y dan la vuelta; Esc cierra la lista', () => {
    buscar('lec', [AGOTADA, LECHE, SIN_PRECIO, YOGURT]);
    expect(opciones()[1].classList).toContain('activa'); // empieza en el primero disponible

    tecla('ArrowDown');
    expect(opciones()[3].classList).toContain('activa'); // salta el «sin precio»
    tecla('ArrowDown');
    expect(opciones()[1].classList).toContain('activa'); // da la vuelta y salta el «agotado»
    tecla('ArrowUp');
    expect(opciones()[3].classList).toContain('activa');

    tecla('Escape');
    expect(opciones()).toHaveLength(0);
    expect(entrada().getAttribute('aria-expanded')).toBe('false');
  });

  it('sin resultados lo dice, y un error de la búsqueda se muestra sin romper la pantalla', () => {
    buscar('zzz', []);
    expect(el().querySelector('[role="listbox"]')?.textContent).toContain('No hay productos que empiecen con «zzz» ni lo contengan.');

    escribir('abc');
    vi.advanceTimersByTime(150);
    http.expectOne((r) => r.params.get('q') === 'abc').flush({ mensaje: 'x' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el().querySelector('[role="listbox"] .error')?.textContent).toBeTruthy();
  });

  it('una respuesta tardía de una búsqueda anterior nunca pisa a la actual', () => {
    escribir('le');
    vi.advanceTimersByTime(150);
    const vieja = http.expectOne((r) => r.params.get('q') === 'le');

    escribir('lec');
    vi.advanceTimersByTime(150);
    expect(vieja.cancelled).toBe(true);
    http.expectOne((r) => r.params.get('q') === 'lec').flush([LECHE]);
    fixture.detectChanges();

    expect(opciones()).toHaveLength(1);
  });

  it('al cambiar el canal o la fecha vuelve a buscar con el mismo texto (el precio cambia)', () => {
    buscar('lec', [LECHE]);

    fixture.componentRef.setInput('canal', 'MAYORISTA');
    fixture.detectChanges();
    vi.advanceTimersByTime(150);
    const req = http.expectOne((r) => r.url === `${base}/ventas/presentaciones`);
    expect(req.request.params.get('q')).toBe('lec');
    expect(req.request.params.get('tipoCliente')).toBe('MAYORISTA');
    req.flush([{ ...LECHE, precio: 3.9 }]);
    fixture.detectChanges();
    expect(opciones()[0].textContent).toContain('S/ 3.90');
  });

  it('con el texto borrado no consulta nada y cierra la lista', () => {
    buscar('lec', [LECHE]);
    escribir('');
    vi.advanceTimersByTime(150);
    http.expectNone(`${base}/ventas/presentaciones`);
    fixture.detectChanges();
    expect(opciones()).toHaveLength(0);
  });

  it('está deshabilitado si la pantalla aún no tiene canal', () => {
    fixture.componentRef.setInput('deshabilitado', true);
    fixture.detectChanges();
    expect(entrada().disabled).toBe(true);
    expect(cantidad().disabled).toBe(true);
  });
});
