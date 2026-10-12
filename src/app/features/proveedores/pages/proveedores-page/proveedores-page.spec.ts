import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { ProveedoresPage } from './proveedores-page';
import { PaginaResponse } from '../../../../shared/models/pagina-response';
import { ProveedorAdminResponse } from '../../data-access/proveedor.models';
import { ProveedorFormDialog } from '../../ui/proveedor-form-dialog/proveedor-form-dialog';

const base = environment.apiBaseUrl;

const pagina0: PaginaResponse<ProveedorAdminResponse> = {
  contenido: [
    { id: 'p-1', nombre: 'Máximo Quispe', dni: '111', telefono: '987654321', zonaActualId: 'z-1', zonaActualNombre: 'Huancayo Norte', codigoQr: 'QR-1', activo: true },
    { id: 'p-2', nombre: 'Rosa Huamán', dni: '222', telefono: null, zonaActualId: 'z-2', zonaActualNombre: 'El Tambo', codigoQr: 'QR-2', activo: false }
  ],
  paginaActual: 0,
  tamanoPagina: 20,
  totalElementos: 2,
  totalPaginas: 1
};

describe('ProveedoresPage', () => {
  let http: HttpTestingController;
  let page: ProveedoresPage;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    page = TestBed.createComponent(ProveedoresPage).componentInstance;
    http.expectOne(`${base}/admin/zonas`).flush([
      { id: 'z-1', nombre: 'Huancayo Norte', activa: true },
      { id: 'z-2', nombre: 'El Tambo', activa: true }
    ]);
    http.expectOne((r) => r.url === `${base}/proveedores`).flush(pagina0);
  });

  afterEach(() => http.verify());

  it('busca en todo el padrón desde el servidor (con debounce), combinando filtros y reiniciando la página', async () => {
    vi.useFakeTimers();
    try {
      page['cambiarFiltroZona']('z-1');
      http.expectOne((r) => r.url === `${base}/proveedores`).flush(pagina0);
      page['pagina'].set(2);

      page['onBusquedaInput']('ro');
      page['onBusquedaInput']('rosa');
      await vi.advanceTimersByTimeAsync(349);
      http.expectNone((r) => r.url === `${base}/proveedores`);
      await vi.advanceTimersByTimeAsync(1);

      const req = http.expectOne((r) => r.url === `${base}/proveedores`);
      expect(req.request.params.get('busqueda')).toBe('rosa');
      expect(req.request.params.get('zonaId')).toBe('z-1');
      expect(req.request.params.get('page')).toBe('0');
      req.flush({ ...pagina0, contenido: [pagina0.contenido[1]], totalElementos: 1 });

      // La tabla muestra exactamente lo que devolvió el servidor: no se vuelve a filtrar en el cliente.
      expect(page['proveedores']().map((p: ProveedorAdminResponse) => p.id)).toEqual(['p-2']);
      expect(page['totalElementos']()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('una búsqueda vacía no envía el parámetro', async () => {
    vi.useFakeTimers();
    try {
      page['onBusquedaInput']('x');
      await vi.advanceTimersByTimeAsync(350);
      http.expectOne((r) => r.url === `${base}/proveedores`).flush(pagina0);
      page['onBusquedaInput']('   ');
      await vi.advanceTimersByTimeAsync(350);
      const req = http.expectOne((r) => r.url === `${base}/proveedores`);
      expect(req.request.params.has('busqueda')).toBe(false);
      req.flush(pagina0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('corrige una página que quedó fuera de rango (p. ej. tras desactivar con filtro de activos)', () => {
    page['pagina'].set(1);
    page['cargar']();
    http.expectOne((r) => r.url === `${base}/proveedores`)
      .flush({ contenido: [], paginaActual: 1, tamanoPagina: 20, totalElementos: 20, totalPaginas: 1 });
    const reintento = http.expectOne((r) => r.url === `${base}/proveedores`);
    expect(reintento.request.params.get('page')).toBe('0');
    reintento.flush(pagina0);
    expect(page['pagina']()).toBe(0);
  });

  it('cambiar el filtro de zona reinicia la página a 0 y vuelve a pedir', () => {
    page['pagina'].set(3);
    page['cambiarFiltroZona']('z-1');

    const req = http.expectOne((r) => r.url === `${base}/proveedores`);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('zonaId')).toBe('z-1');
    req.flush({ ...pagina0, paginaActual: 0 });

    expect(page['pagina']()).toBe(0);
  });

  it('irAPagina no pide una página fuera de rango', () => {
    expect(page['totalPaginas']()).toBe(1);
    page['irAPagina'](1);
    http.expectNone((r) => r.url === `${base}/proveedores` && r.params.get('page') === '1');
  });
});

describe('ProveedoresPage (regresión: contenido real de cada columna en el DOM)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ProveedoresPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProveedoresPage);
    http.expectOne(`${base}/admin/zonas`).flush([
      { id: 'z-1', nombre: 'Huancayo Norte', activa: true },
      { id: 'z-2', nombre: 'El Tambo', activa: true }
    ]);
    http.expectOne((r) => r.url === `${base}/proveedores`).flush(pagina0);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('cada fila muestra su propia zona, teléfono y estado, incluido el teléfono nulo', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const filas = raiz.querySelectorAll('tbody tr');
    expect(filas.length).toBe(2);
    const celdas = (fila: Element) => Array.from(fila.querySelectorAll('td')).map((td) => td.textContent?.trim());

    const [c1, c2] = [celdas(filas[0]), celdas(filas[1])];
    // columnas: Proveedor, DNI, Zona actual, Teléfono, Estado, Acciones
    expect(c1[0]).toBe('Máximo Quispe');
    expect(c1[1]).toBe('111');
    expect(c1[2]).toBe('Huancayo Norte');
    expect(c1[3]).toBe('987654321');
    expect(c1[4]).toBe('Activo');

    expect(c2[0]).toContain('Rosa Huamán');
    expect(c2[2]).toBe('El Tambo');
    expect(c2[3]).toBe('No registrado');
    expect(c2[4]).toBe('Inactivo');
  });

  it('el botón "Editar" de una fila abre el diálogo con el proveedor correcto, no el de otra fila', () => {
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);

    const raiz = fixture.nativeElement as HTMLElement;
    const filas = raiz.querySelectorAll('tbody tr');
    const botonEditarFila2 = Array.from(filas[1].querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Editar'
    )!;
    botonEditarFila2.click();

    expect(abrirSpy).toHaveBeenCalledTimes(1);
    const [componente, config] = abrirSpy.mock.calls[0];
    expect(componente).toBe(ProveedorFormDialog);
    expect((config?.data as { proveedor: ProveedorAdminResponse }).proveedor.id).toBe('p-2');
    expect((config?.data as { proveedor: ProveedorAdminResponse }).proveedor.nombre).toBe('Rosa Huamán');
  });
});
