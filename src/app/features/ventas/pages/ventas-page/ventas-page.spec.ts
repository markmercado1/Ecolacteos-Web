import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { Subject, of, throwError } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { VentasPage } from './ventas-page';
import { PaginaResponse } from '../../../../shared/models/pagina-response';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { ComprobanteVentaService } from '../../data-access/comprobante-venta.service';
import { VentaResumenResponse } from '../../data-access/venta.models';
import { EnviarWhatsappDialog } from '../../ui/enviar-whatsapp-dialog/enviar-whatsapp-dialog';
import { VentaDetalleDialog } from '../../ui/venta-detalle-dialog/venta-detalle-dialog';

const base = environment.apiBaseUrl;

const TIPOS = [
  { codigo: 'MAYORISTA', nombre: 'Mayorista', descripcion: '', activo: true, protegido: false, reglaComprador: 'CLIENTE_HABILITADO', ultimoCambio: null },
  { codigo: 'PROVEEDOR', nombre: 'Proveedor', descripcion: '', activo: true, protegido: false, reglaComprador: 'PROVEEDOR_PADRON', ultimoCambio: null },
  { codigo: 'PUBLICO', nombre: 'Público', descripcion: '', activo: true, protegido: false, reglaComprador: 'CUALQUIERA', ultimoCambio: null }
];

const pagina0: PaginaResponse<VentaResumenResponse> = {
  contenido: [
    {
      id: 'v-1', fecha: '2026-09-17', tipoCliente: 'MAYORISTA',
      detalles: [{ presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoNombre: 'Fresco', cantidad: 10, precioUnitario: 12.5, subtotal: 125 }],
      total: 125, tipoComprobante: 'BOLETA', comprobante: 'B001-00000213', vendedorNombre: 'Ana Pérez', creadoEn: '2026-09-17T16:27:05',
      comprador: { tipo: 'CLIENTE', id: 'c-1', nombre: 'Rosa Quispe', ruc: null }
    },
    {
      id: 'v-2', fecha: '2026-09-16', tipoCliente: 'PUBLICO',
      detalles: [
        { presentacionId: 'pres-2', presentacionNombre: 'Unidad', productoNombre: 'Andino', cantidad: 2, precioUnitario: 8, subtotal: 16 },
        { presentacionId: 'pres-3', presentacionNombre: 'Botella 2 L', productoNombre: 'Yogurt', cantidad: 1, precioUnitario: 20, subtotal: 20 }
      ],
      total: 36, tipoComprobante: 'NOTA_VENTA', comprobante: 'NV01-00000041', vendedorNombre: 'Luis Gómez', creadoEn: '2026-09-16T09:05:00', comprador: null
    }
  ],
  paginaActual: 0,
  tamanoPagina: 20,
  totalElementos: 2,
  totalPaginas: 1
};

const RESUMEN = { cantidad: 2, total: 161 };

describe('VentasPage', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<VentasPage>;
  let toast: ToastService;
  const comprobantes = { imprimir: vi.fn(() => of(undefined)), descargar: vi.fn(() => of(undefined)) };

  const page = () => fixture.componentInstance;
  const el = () => fixture.nativeElement as HTMLElement;
  const lista = () => http.expectOne((r) => r.url === `${base}/ventas`);
  const resumen = () => http.expectOne((r) => r.url === `${base}/ventas/resumen`);
  const texto = (testid: string) => el().querySelector(`[data-testid="${testid}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
  const filas = () => Array.from(el().querySelectorAll('tbody tr'));
  const celdas = (fila: Element) => Array.from(fila.querySelectorAll('td')).map((td) => td.textContent?.replace(/\s+/g, ' ').trim());

  beforeEach(() => {
    comprobantes.imprimir.mockReset().mockReturnValue(of(undefined));
    comprobantes.descargar.mockReset().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ComprobanteVentaService, useValue: comprobantes }]
    });
    http = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(VentasPage);
    http.expectOne((r) => r.url.endsWith('/tipos-precio')).flush(TIPOS);
    lista().flush(pagina0);
    resumen().flush(RESUMEN);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('carga la primera página y los totales sin filtros', () => {
    expect(page()['ventas']().length).toBe(2);
    expect(page()['totalElementos']()).toBe(2);
    expect(texto('kpi-cantidad')).toContain('2');
    expect(texto('kpi-total')).toContain('S/ 161.00');
    expect(texto('kpi-promedio')).toContain('S/ 80.50');
  });

  it('cada fila muestra su comprobante, fecha y hora, comprador, vendedor, canal, productos y total', () => {
    expect(filas()).toHaveLength(2);
    // columnas: Comprobante, Fecha, Comprador, Vendedor, Canal, Productos, Total, Acciones
    const [c1, c2] = [celdas(filas()[0]), celdas(filas()[1])];
    expect(c1.slice(0, 7)).toEqual(['B001-00000213', '17/09/2026 16:27', 'Rosa Quispe', 'Ana Pérez', 'Mayorista', '10 × Botella 1 L', 'S/ 125.00']);
    expect(c2.slice(0, 7)).toEqual(['NV01-00000041', '16/09/2026 09:05', 'Cliente varios', 'Luis Gómez', 'Público', '2 líneas', 'S/ 36.00']);
    expect(filas()[0].querySelector('.comprobante')?.classList).toContain('boleta');
    expect(filas()[1].querySelector('.comprobante')?.classList).not.toContain('boleta');
  });

  it('una venta de un backend anterior (sin comprobante, vendedor ni hora) se sigue viendo', () => {
    page()['ventas'].set([{ id: 'v-viejo', fecha: '2026-01-02', tipoCliente: 'PUBLICO', detalles: [], total: 5 }]);
    fixture.detectChanges();
    expect(celdas(filas()[0]).slice(0, 4)).toEqual(['—', '02/01/2026', 'Cliente varios', '—']);
  });

  it('cambiar un filtro reinicia la página a 0 y vuelve a pedir la lista Y los totales con el mismo filtro', () => {
    page()['pagina'].set(3);
    page()['cambiarFiltroDesde']('2026-09-01');

    const req = lista();
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('desde')).toBe('2026-09-01');
    expect(req.request.params.has('hasta')).toBe(false);
    expect(req.request.params.has('tipoCliente')).toBe(false);
    req.flush(pagina0);
    const r = resumen();
    expect(r.request.params.get('desde')).toBe('2026-09-01');
    r.flush({ cantidad: 1, total: 125 });
    fixture.detectChanges();
    expect(page()['pagina']()).toBe(0);
    expect(texto('kpi-total')).toContain('S/ 125.00');
    expect(texto('kpi-promedio')).toContain('S/ 125.00');
  });

  it('el rango, el canal y la búsqueda se combinan, se mandan al servidor y llegan también al Excel', () => {
    page()['cambiarFiltroDesde']('2026-09-01');
    lista().flush(pagina0); resumen().flush(RESUMEN);
    page()['cambiarFiltroHasta']('2026-09-30');
    lista().flush(pagina0); resumen().flush(RESUMEN);
    page()['cambiarFiltroTipoCliente']('MAYORISTA');
    lista().flush(pagina0); resumen().flush(RESUMEN);
    page()['buscar']('B001-00000213');
    const req = lista();
    for (const [clave, valor] of Object.entries({ desde: '2026-09-01', hasta: '2026-09-30', tipoCliente: 'MAYORISTA', busqueda: 'B001-00000213', page: '0' })) {
      expect(req.request.params.get(clave)).toBe(valor);
    }
    req.flush(pagina0);
    const r = resumen();
    expect(r.request.params.get('busqueda')).toBe('B001-00000213');
    expect(r.request.params.get('desde')).toBe('2026-09-01');
    expect(r.request.params.has('page')).toBe(false);
    r.flush(RESUMEN);

    expect(page()['filtroExportacion']()).toEqual({ desde: '2026-09-01', hasta: '2026-09-30', tipoCliente: 'MAYORISTA', busqueda: 'B001-00000213' });
  });

  it('«Limpiar filtros» quita todo y vuelve a pedir lista y totales sin filtros', () => {
    page()['cambiarFiltroTipoCliente']('PUBLICO');
    lista().flush(pagina0); resumen().flush(RESUMEN);
    fixture.detectChanges();
    expect(page()['hayFiltros']()).toBe(true);

    (el().querySelector('[data-testid="limpiar"]') as HTMLButtonElement).click();
    const req = lista();
    expect(req.request.params.has('tipoCliente')).toBe(false);
    expect(req.request.params.has('busqueda')).toBe(false);
    req.flush(pagina0);
    resumen().flush(RESUMEN);
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="limpiar"]')).toBeNull();
  });

  it('un rango al revés no se manda al servidor y se avisa junto a los campos', () => {
    page()['cambiarFiltroDesde']('2026-09-30');
    lista().flush(pagina0); resumen().flush(RESUMEN);
    page()['cambiarFiltroHasta']('2026-09-01');
    http.expectNone((r) => r.url === `${base}/ventas`);
    http.expectNone((r) => r.url === `${base}/ventas/resumen`);
    fixture.detectChanges();
    expect(texto('rango-invalido')).toContain('«Desde» no puede ser posterior a «Hasta»');
  });

  it('pasar de página o cambiar el tamaño no vuelve a pedir los totales (dependen solo del filtro)', () => {
    page()['totalPaginas'].set(3);
    page()['cambiarPagina'](1);
    lista().flush({ ...pagina0, paginaActual: 1, totalPaginas: 3 });
    page()['cambiarTamano'](10);
    const req = lista();
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(pagina0);
    http.expectNone((r) => r.url === `${base}/ventas/resumen`);
  });

  it('cambiarPagina no pide una página fuera de rango', () => {
    expect(page()['totalPaginas']()).toBe(1);
    page()['cambiarPagina'](1);
    page()['cambiarPagina'](-1);
    http.expectNone((r) => r.url === `${base}/ventas`);
  });

  it('sin ventas en el filtro los totales muestran cero y el promedio un guion; si fallan, guiones', () => {
    page()['cambiarFiltroTipoCliente']('PROVEEDOR');
    lista().flush({ ...pagina0, contenido: [], totalElementos: 0, totalPaginas: 0 });
    resumen().flush({ cantidad: 0, total: 0 });
    fixture.detectChanges();
    expect(texto('kpi-cantidad')).toContain('0');
    expect(texto('kpi-total')).toContain('S/ 0.00');
    expect(texto('kpi-promedio')).toContain('—');

    page()['cambiarFiltroTipoCliente']('MAYORISTA');
    lista().flush(pagina0);
    resumen().flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(texto('kpi-total')).toContain('—');
  });

  it('«Ver» abre el detalle con el id de esa fila y el nombre del canal del catálogo', () => {
    const abrir = vi.spyOn(TestBed.inject(Dialog), 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    (filas()[1].querySelector('[data-testid="ver"]') as HTMLButtonElement).click();

    expect(abrir).toHaveBeenCalledTimes(1);
    const [componente, config] = abrir.mock.calls[0];
    expect(componente).toBe(VentaDetalleDialog);
    expect(config?.data).toEqual({ id: 'v-2', etiquetaCanal: 'Público' });
  });

  it('«Imprimir» y «PDF» actúan sobre el comprobante de ESA fila, directo, sin abrir ningún diálogo', () => {
    const abrir = vi.spyOn(TestBed.inject(Dialog), 'open');
    (filas()[1].querySelector('[data-testid="imprimir"]') as HTMLButtonElement).click();
    expect(comprobantes.imprimir).toHaveBeenCalledWith('v-2');

    (filas()[0].querySelector('[data-testid="descargar"]') as HTMLButtonElement).click();
    expect(comprobantes.descargar).toHaveBeenCalledWith('v-1', 'B001-00000213');
    expect(abrir).not.toHaveBeenCalled();
  });

  it('«WhatsApp» abre el diálogo de envío con la venta de ESA fila', () => {
    const abrir = vi.spyOn(TestBed.inject(Dialog), 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    (filas()[1].querySelector('[data-testid="whatsapp"]') as HTMLButtonElement).click();

    expect(abrir).toHaveBeenCalledTimes(1);
    const [componente, config] = abrir.mock.calls[0];
    expect(componente).toBe(EnviarWhatsappDialog);
    expect((config?.data as { venta: VentaResumenResponse }).venta.id).toBe('v-2');
  });

  it('mientras prepara un comprobante deshabilita los botones de las filas y al terminar los habilita', () => {
    const pendiente = new Subject<void>();
    comprobantes.imprimir.mockReturnValue(pendiente as never);
    (filas()[0].querySelector('[data-testid="imprimir"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect((filas()[0].querySelector('[data-testid="imprimir"]') as HTMLButtonElement).textContent).toContain('Preparando');
    expect((filas()[1].querySelector('[data-testid="descargar"]') as HTMLButtonElement).disabled).toBe(true);
    (filas()[1].querySelector('[data-testid="descargar"]') as HTMLButtonElement).click(); // ignorado
    expect(comprobantes.descargar).not.toHaveBeenCalled();

    pendiente.next();
    pendiente.complete();
    fixture.detectChanges();
    expect((filas()[1].querySelector('[data-testid="descargar"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('si el comprobante no se puede obtener avisa con el mensaje del servidor y libera los botones', () => {
    const avisar = vi.spyOn(toast, 'error');
    comprobantes.descargar.mockReturnValue(throwError(() => ({ status: 404, error: { mensaje: 'Venta no encontrada' } })));
    (filas()[0].querySelector('[data-testid="descargar"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(avisar).toHaveBeenCalledTimes(1);
    expect((filas()[0].querySelector('[data-testid="imprimir"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('«+ Nueva venta» lleva a la pantalla de registro (ya no hay ventana de registro aquí)', () => {
    const enlace = el().querySelector<HTMLAnchorElement>('[data-testid="nueva-venta"]')!;
    expect(enlace.getAttribute('href')).toBe('/ventas/nueva');
    expect(Array.from(el().querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Registrar venta')).toBe(false);
  });
});
