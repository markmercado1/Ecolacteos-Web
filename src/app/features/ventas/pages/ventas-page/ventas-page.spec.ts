import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { VentasPage } from './ventas-page';
import { PaginaResponse } from '../../../../shared/models/pagina-response';
import { VentaResumenResponse } from '../../data-access/venta.models';
import { VentaDetalleDialog } from '../../ui/venta-detalle-dialog/venta-detalle-dialog';
import { VentaFormDialog } from '../../ui/venta-form-dialog/venta-form-dialog';

const base = environment.apiBaseUrl;

const pagina0: PaginaResponse<VentaResumenResponse> = {
  contenido: [
    {
      id: 'v-1', fecha: '2026-09-17', tipoCliente: 'MAYORISTA',
      detalles: [{ presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoNombre: 'Fresco', cantidad: 10, precioUnitario: 12.5, subtotal: 125 }],
      total: 125
    },
    {
      id: 'v-2', fecha: '2026-09-16', tipoCliente: 'PUBLICO',
      detalles: [
        { presentacionId: 'pres-2', presentacionNombre: 'Unidad', productoNombre: 'Andino', cantidad: 2, precioUnitario: 8, subtotal: 16 },
        { presentacionId: 'pres-3', presentacionNombre: 'Botella 2 L', productoNombre: 'Yogurt', cantidad: 1, precioUnitario: 20, subtotal: 20 }
      ],
      total: 36
    }
  ],
  paginaActual: 0,
  tamanoPagina: 20,
  totalElementos: 2,
  totalPaginas: 1
};

describe('VentasPage', () => {
  let http: HttpTestingController;
  let page: VentasPage;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    page = TestBed.createComponent(VentasPage).componentInstance;
    http.expectOne((r) => r.url === `${base}/ventas`).flush(pagina0);
  });

  afterEach(() => http.verify());

  it('carga la primera página sin filtros de fecha/tipoCliente', () => {
    expect(page['ventas']().length).toBe(2);
    expect(page['totalElementos']()).toBe(2);
  });

  it('cambiar el filtro de fecha reinicia la página a 0 y omite tipoCliente si no está activo', () => {
    page['pagina'].set(3);
    page['cambiarFiltroFecha']('2026-09-17');

    const req = http.expectOne((r) => r.url === `${base}/ventas`);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('fecha')).toBe('2026-09-17');
    expect(req.request.params.has('tipoCliente')).toBe(false);
    req.flush({ ...pagina0, paginaActual: 0 });

    expect(page['pagina']()).toBe(0);
  });

  it('cambiar el filtro de canal reinicia la página a 0', () => {
    page['pagina'].set(2);
    page['cambiarFiltroTipoCliente']('MAYORISTA');

    const req = http.expectOne((r) => r.url === `${base}/ventas`);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('tipoCliente')).toBe('MAYORISTA');
    req.flush({ ...pagina0, paginaActual: 0 });
  });

  it('irAPagina no pide una página fuera de rango', () => {
    expect(page['totalPaginas']()).toBe(1);
    page['irAPagina'](1);
    http.expectNone((r) => r.url === `${base}/ventas` && r.params.get('page') === '1');
  });

  it('no muestra la suma de la página como total de todas las ventas', () => {
    // totalElementos viene del servidor (PaginaResponse), no de sumar `contenido` en el cliente.
    expect(page['totalElementos']()).toBe(pagina0.totalElementos);
    expect(page['totalElementos']()).not.toBe(page['ventas']().length * 1000);
  });

  it('resumenLineas muestra "cantidad × presentación" para una sola línea, y "N líneas" para varias', () => {
    const [unaLinea, variasLineas] = pagina0.contenido;
    expect(page['resumenLineas'](unaLinea)).toBe('10 × Botella 1 L');
    expect(page['resumenLineas'](variasLineas)).toBe('2 líneas');
  });
});

describe('VentasPage — contenido real de cada columna y acciones sobre el ID correcto', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<VentasPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VentasPage);
    http.expectOne((r) => r.url === `${base}/ventas`).flush(pagina0);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('cada fila muestra su propia fecha, canal, resumen de líneas y total', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const filas = raiz.querySelectorAll('tbody tr');
    expect(filas.length).toBe(2);
    const celdas = (fila: Element) => Array.from(fila.querySelectorAll('td')).map((td) => td.textContent?.trim());

    const [c1, c2] = [celdas(filas[0]), celdas(filas[1])];
    // columnas: Fecha, Canal, Líneas, Total, Acciones
    expect(c1[0]).toBe('2026-09-17');
    expect(c1[1]).toBe('Mayorista');
    expect(c1[2]).toBe('10 × Botella 1 L');
    expect(c1[3]).toBe('S/ 125.00');

    expect(c2[0]).toBe('2026-09-16');
    expect(c2[1]).toBe('Público');
    expect(c2[2]).toBe('2 líneas');
    expect(c2[3]).toBe('S/ 36.00');
  });

  it('"Ver detalle" de una fila abre el diálogo con el id de esa fila, no el de otra', () => {
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);

    const raiz = fixture.nativeElement as HTMLElement;
    const filas = raiz.querySelectorAll('tbody tr');
    const botonFila2 = filas[1].querySelector<HTMLButtonElement>('button')!;
    botonFila2.click();

    expect(abrirSpy).toHaveBeenCalledTimes(1);
    const [componente, config] = abrirSpy.mock.calls[0];
    expect(componente).toBe(VentaDetalleDialog);
    expect((config?.data as { id: string }).id).toBe('v-2');
  });

  it('"Registrar venta" abre VentaFormDialog y, si el resultado pide ver detalle, abre VentaDetalleDialog con el id creado', () => {
    const dialog = TestBed.inject(Dialog);
    let cerrado!: (r: unknown) => void;
    const abrirSpy = vi.spyOn(dialog, 'open').mockImplementation(
      () => ({ closed: { subscribe: (fn: (r: unknown) => void) => (cerrado = fn) } }) as never
    );

    const raiz = fixture.nativeElement as HTMLElement;
    const botonNueva = Array.from(raiz.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Registrar venta'
    )!;
    botonNueva.click();
    expect(abrirSpy.mock.calls[0][0]).toBe(VentaFormDialog);

    const ventaCreada: VentaResumenResponse = {
      id: 'v-nueva', fecha: '2026-09-17', tipoCliente: 'PROVEEDOR',
      detalles: [{ presentacionId: 'pres-1', presentacionNombre: 'Unidad', productoNombre: 'Fresco', cantidad: 1, precioUnitario: 5, subtotal: 5 }],
      total: 5
    };
    cerrado({ venta: ventaCreada, verDetalle: true });

    http.expectOne((r) => r.url === `${base}/ventas`).flush(pagina0); // recarga tras registrar

    expect(abrirSpy).toHaveBeenCalledTimes(2);
    const [componente, config] = abrirSpy.mock.calls[1];
    expect(componente).toBe(VentaDetalleDialog);
    expect((config?.data as { id: string }).id).toBe('v-nueva');
  });
});
