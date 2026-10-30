import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { ProveedoresPage } from '../../../features/proveedores/pages/proveedores-page/proveedores-page';
import { VentasPage } from '../../../features/ventas/pages/ventas-page/ventas-page';
import { DescargaArchivos } from '../../util/descarga-archivos';

const base = environment.apiBaseUrl;
const vacia = { contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 };

// El Excel de una tabla trae TODAS las filas del filtro y la búsqueda vigentes: se pide sin page/size y con los mismos
// parámetros que usa el listado de esa pantalla.
describe('Exportar a Excel en las pantallas', () => {
  let http: HttpTestingController;
  const guardar = vi.fn();

  beforeEach(() => {
    guardar.mockReset();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: DescargaArchivos, useValue: { guardar } }]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('Proveedores: el botón pide el archivo con zona, estado y búsqueda vigentes, sin paginar', () => {
    const fixture = TestBed.createComponent(ProveedoresPage);
    http.expectOne(`${base}/admin/zonas`).flush([{ id: 'z-1', nombre: 'Norte', activa: true }]);
    http.expectOne((r) => r.url === `${base}/proveedores`).flush(vacia);
    const pagina = fixture.componentInstance as unknown as Record<string, (...a: unknown[]) => void>;
    pagina['cambiarFiltroZona']('z-1');
    http.expectOne((r) => r.url === `${base}/proveedores`).flush(vacia);
    pagina['cambiarFiltroEstado']('INACTIVOS');
    http.expectOne((r) => r.url === `${base}/proveedores`).flush(vacia);
    pagina['buscar']('rosa');
    http.expectOne((r) => r.url === `${base}/proveedores`).flush(vacia);
    fixture.detectChanges();

    const boton = fixture.nativeElement.querySelector('ui-exportar-excel button') as HTMLButtonElement;
    expect(boton.textContent).toContain('Exportar a Excel');
    boton.click();

    const req = http.expectOne((r) => r.url === `${base}/exportaciones/proveedores`);
    expect(req.request.params.get('zonaId')).toBe('z-1');
    expect(req.request.params.get('activo')).toBe('false');
    expect(req.request.params.get('busqueda')).toBe('rosa');
    expect(req.request.params.has('page')).toBe(false);
    expect(req.request.params.has('size')).toBe(false);
    req.flush(new Blob(['x']), { headers: { 'Content-Disposition': 'attachment; filename="proveedores-20261022-1100.xlsx"' } });
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar.mock.calls[0][1]).toBe('proveedores-20261022-1100.xlsx');
  });

  it('Ventas: el botón pide el archivo con el rango de fechas, canal y búsqueda vigentes, sin paginar', () => {
    const fixture = TestBed.createComponent(VentasPage);
    http.expectOne((r) => r.url.endsWith('/tipos-precio')).flush([]);
    http.expectOne((r) => r.url === `${base}/ventas`).flush(vacia);
    http.expectOne((r) => r.url === `${base}/ventas/resumen`).flush({ cantidad: 0, total: 0 });
    const pagina = fixture.componentInstance as unknown as Record<string, (...a: unknown[]) => void>;
    // cada filtro vuelve a pedir la lista y los totales
    const refrescar = () => {
      http.expectOne((r) => r.url === `${base}/ventas`).flush(vacia);
      http.expectOne((r) => r.url === `${base}/ventas/resumen`).flush({ cantidad: 0, total: 0 });
    };
    pagina['cambiarFiltroDesde']('2026-09-01'); refrescar();
    pagina['cambiarFiltroHasta']('2026-09-17'); refrescar();
    pagina['cambiarFiltroTipoCliente']('MAYORISTA'); refrescar();
    pagina['buscar']('queso'); refrescar();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('ui-exportar-excel button') as HTMLButtonElement).click();

    const req = http.expectOne((r) => r.url === `${base}/exportaciones/ventas`);
    expect(req.request.params.get('desde')).toBe('2026-09-01');
    expect(req.request.params.get('hasta')).toBe('2026-09-17');
    expect(req.request.params.get('tipoCliente')).toBe('MAYORISTA');
    expect(req.request.params.get('busqueda')).toBe('queso');
    expect(req.request.params.has('page')).toBe(false);
    req.flush(new Blob(['x']));
    expect(guardar).toHaveBeenCalledTimes(1);
  });
});
