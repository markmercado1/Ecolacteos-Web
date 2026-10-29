import { Dialog } from '@angular/cdk/dialog';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { InventarioPage } from '../../../features/inventario/pages/inventario-page/inventario-page';
import { TokenStoreService } from '../../../core/auth/token-store.service';
import { ProveedoresPage } from '../../../features/proveedores/pages/proveedores-page/proveedores-page';
import { ToastService } from '../toast/toast.service';
import { ImportarExcelDialog } from './importar-excel-dialog';

const base = environment.apiBaseUrl;
const vacia = { contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 };

describe('Importar desde Excel en las pantallas', () => {
  let http: HttpTestingController;
  let closed: Subject<number | undefined>;
  let abrir: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    closed = new Subject();
    abrir = vi.spyOn(TestBed.inject(Dialog), 'open').mockReturnValue({ closed } as never);
  });

  afterEach(() => { http.verify(); localStorage.clear(); });

  it('Proveedores: el botón abre el diálogo de proveedores y, si se importó algo, recarga la lista desde la primera página', () => {
    const fixture = TestBed.createComponent(ProveedoresPage);
    http.expectOne(`${base}/admin/zonas`).flush([]);
    http.expectOne((r) => r.url === `${base}/proveedores`).flush(vacia);
    fixture.detectChanges();

    const boton = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Importar desde Excel'))!;
    boton.click();

    expect(abrir).toHaveBeenCalledTimes(1);
    const [componente, config] = abrir.mock.calls[0] as [unknown, { data: unknown }];
    expect(componente).toBe(ImportarExcelDialog);
    expect(config.data).toEqual({ tipo: 'proveedores', nombre: 'proveedores' });

    closed.next(3);
    const recarga = http.expectOne((r) => r.url === `${base}/proveedores`);
    expect(recarga.request.params.get('page')).toBe('0');
    recarga.flush(vacia);
    expect(TestBed.inject(ToastService).avisos().at(-1)?.mensaje).toBe('Se importaron 3 proveedores.');
  });

  it('Proveedores: si no se importó nada (cancelado o sin filas válidas) no se recarga ni se avisa', () => {
    const fixture = TestBed.createComponent(ProveedoresPage);
    http.expectOne(`${base}/admin/zonas`).flush([]);
    http.expectOne((r) => r.url === `${base}/proveedores`).flush(vacia);
    fixture.detectChanges();
    const avisosAntes = TestBed.inject(ToastService).avisos().length;

    (Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Importar desde Excel'))!).click();
    closed.next(undefined);

    http.expectNone((r) => r.url === `${base}/proveedores`);
    expect(TestBed.inject(ToastService).avisos().length).toBe(avisosAntes);
  });

  it('Inventario: importar insumos abre el diálogo de insumos y recarga solo los insumos al terminar', () => {
    TestBed.inject(TokenStoreService).establecer({ token: 'test', refreshToken: 'test', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: { id: 'u', nombre: 'Admin', email: 'test@example.test', rolNombre: 'ADMIN', activo: true, unidadesResponsable: [] } });
    const fixture = TestBed.createComponent(InventarioPage);
    fixture.detectChanges();
    http.expectOne(`${base}/inventario/familias`).flush([]);
    http.expectOne(r => r.url === `${base}/inventario/stock/presentaciones`).flush(vacia);
    fixture.componentInstance['cambiarSeccion']('insumos');
    http.expectOne(`${base}/inventario/insumos`).flush([]);
    http.expectOne(`${base}/inventario/insumos/lotes/alertas`).flush({ diasAlerta: 15, porVencer: 0, vencidos: 0, lotes: [] });
    fixture.detectChanges();

    const boton = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Importar desde Excel'))!;
    boton.click();

    const [componente, config] = abrir.mock.calls[0] as [unknown, { data: unknown }];
    expect(componente).toBe(ImportarExcelDialog);
    expect(config.data).toEqual({ tipo: 'insumos', nombre: 'insumos' });

    closed.next(2);
    http.expectOne(`${base}/inventario/insumos`).flush([]);
    http.expectOne(`${base}/inventario/insumos/lotes/alertas`).flush({ diasAlerta: 15, porVencer: 0, vencidos: 0, lotes: [] });
    http.expectNone(`${base}/admin/zonas`);
    expect(TestBed.inject(ToastService).avisos().at(-1)?.mensaje).toBe('Se importaron 2 insumos.');
  });
});
