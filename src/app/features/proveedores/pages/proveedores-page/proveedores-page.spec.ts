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
    { id: 'p-1', nombre: 'Máximo Quispe', dni: '111', telefono: '987654321', zonaActualId: 'z-1', zonaActualNombre: 'Huancayo Norte', codigoQr: 'QR-1', activo: true, tipoPersona: 'NATURAL', ruc: null, razonSocial: null },
    { id: 'p-2', nombre: 'Rosa Huamán', dni: '222', telefono: null, zonaActualId: 'z-2', zonaActualNombre: 'El Tambo', codigoQr: 'QR-2', activo: false, tipoPersona: 'NATURAL', ruc: null, razonSocial: null }
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

  // El debounce, Enter y «×» viven en ui-buscador (buscador.spec.ts); aquí se prueba qué hace la página con el texto.
  it('busca en todo el padrón desde el servidor, combinando filtros y reiniciando la página', () => {
    page['cambiarFiltroZona']('z-1');
    http.expectOne((r) => r.url === `${base}/proveedores`).flush(pagina0);
    page['pagina'].set(2);

    page['buscar']('rosa');

    const req = http.expectOne((r) => r.url === `${base}/proveedores`);
    expect(req.request.params.get('busqueda')).toBe('rosa');
    expect(req.request.params.get('zonaId')).toBe('z-1');
    expect(req.request.params.get('page')).toBe('0');
    req.flush({ ...pagina0, contenido: [pagina0.contenido[1]], totalElementos: 1 });

    // La tabla muestra exactamente lo que devolvió el servidor: no se vuelve a filtrar en el cliente.
    expect(page['proveedores']().map((p: ProveedorAdminResponse) => p.id)).toEqual(['p-2']);
    expect(page['totalElementos']()).toBe(1);
  });

  it('una búsqueda vacía no envía el parámetro', () => {
    page['buscar']('x');
    http.expectOne((r) => r.url === `${base}/proveedores`).flush(pagina0);
    page['buscar']('');
    const req = http.expectOne((r) => r.url === `${base}/proveedores`);
    expect(req.request.params.has('busqueda')).toBe(false);
    req.flush(pagina0);
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

  it('cambiarPagina no pide una página fuera de rango', () => {
    expect(page['totalPaginas']()).toBe(1);
    page['cambiarPagina'](1);
    page['cambiarPagina'](-1);
    http.expectNone((r) => r.url === `${base}/proveedores`);
  });

  it('cambiarTamano pide la primera página con el nuevo tamaño', () => {
    page['cambiarTamano'](50);
    const req = http.expectOne((r) => r.url === `${base}/proveedores`);
    expect(req.request.params.get('size')).toBe('50');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(pagina0);
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
    // columnas: Proveedor, DNI / RUC, Zona actual, Teléfono, Estado, Acciones
    expect(c1[0]).toBe('Máximo Quispe');
    expect(c1[1]).toBe('DNI 111');
    expect(c1[2]).toBe('Huancayo Norte');
    expect(c1[3]).toBe('987654321');
    expect(c1[4]).toBe('Activo');

    expect(c2[0]).toContain('Rosa Huamán');
    expect(c2[2]).toBe('El Tambo');
    expect(c2[3]).toBe('No registrado');
    expect(c2[4]).toBe('Inactivo');
  });

  it('Fase G: una empresa muestra su RUC, la etiqueta «Empresa» y su razón social; una persona con RUC muestra ambos documentos', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const componente = fixture.componentInstance as unknown as { proveedores: { set(v: ProveedorAdminResponse[]): void } };
    componente.proveedores.set([
      { ...pagina0.contenido[0], dni: '04567890', ruc: '10045678909' },
      { ...pagina0.contenido[1], tipoPersona: 'EMPRESA', dni: null, ruc: '20601234565', nombre: 'Fundo El Valle', razonSocial: 'Agropecuaria El Valle S.R.L.' }
    ]);
    fixture.detectChanges();
    const filas = raiz.querySelectorAll('tbody tr');
    expect(filas[0].textContent).toContain('DNI 04567890 · RUC 10045678909');
    expect(filas[0].querySelector('[data-testid="badge-empresa"]')).toBeNull();
    expect(filas[1].textContent).toContain('RUC 20601234565');
    expect(filas[1].textContent).not.toContain('DNI');
    expect(filas[1].querySelector('[data-testid="badge-empresa"]')?.textContent).toContain('Empresa');
    expect(filas[1].textContent).toContain('Agropecuaria El Valle S.R.L.');
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

describe('ProveedoresPage — acciones por fila', () => {
  let http: HttpTestingController;
  let f: ComponentFixture<ProveedoresPage>;
  const el = () => f.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    f = TestBed.createComponent(ProveedoresPage);
    http.expectOne(`${base}/admin/zonas`).flush([]);
    http.expectOne((r) => r.url === `${base}/proveedores`).flush(pagina0);
    f.detectChanges();
  });

  afterEach(() => {
    http.verify();
    document.querySelectorAll('.cdk-overlay-container .ui-menu').forEach((m) => m.remove());
  });

  const filas = () => Array.from(el().querySelectorAll<HTMLElement>('tbody tr'));
  const visibles = (fila: HTMLElement) => Array.from(fila.querySelectorAll('.acciones > button')).map((b) => b.textContent?.trim());
  const abrirMas = (fila: HTMLElement) => {
    fila.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click();
    f.detectChanges();
    return Array.from(document.querySelectorAll<HTMLButtonElement>('.ui-menu [cdkMenuItem]'));
  };

  it('deja a la vista Ver perfil y Editar, y agrupa Cambiar zona y Desactivar en «Más» con nombre accesible', () => {
    const [primera] = filas();
    expect(visibles(primera)).toEqual(['Ver perfil', 'Editar', 'Más ▾']);
    expect(primera.querySelector('button[aria-haspopup="menu"]')?.getAttribute('aria-label')).toBe('Más acciones de Máximo Quispe');
    expect(abrirMas(primera).map((i) => i.textContent?.trim())).toEqual(['Cambiar zona', 'Desactivar']);
  });

  it('Desactivar se distingue como acción destructiva y Reactivar (proveedor inactivo) no', () => {
    const [activo, inactivo] = filas();
    expect(abrirMas(activo).find((i) => i.textContent?.trim() === 'Desactivar')?.classList).toContain('peligro');
    document.querySelectorAll('.ui-menu').forEach((m) => m.remove());
    const items = abrirMas(inactivo);
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Cambiar zona', 'Reactivar']);
    expect(items.find((i) => i.textContent?.trim() === 'Reactivar')?.classList).not.toContain('peligro');
  });

  it('elegir «Cambiar zona» del menú ejecuta la misma acción que antes tenía el enlace', () => {
    const cambiar = vi.spyOn(f.componentInstance as unknown as { cambiarZona: (p: unknown) => void }, 'cambiarZona').mockImplementation(() => undefined);
    abrirMas(filas()[0]).find((i) => i.textContent?.trim() === 'Cambiar zona')!.click();
    expect(cambiar).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-1' }));
  });
});
