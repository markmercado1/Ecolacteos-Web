import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { PaginaResponse } from '../../../../shared/models/pagina-response';
import { ReservaResumenResponse } from '../../data-access/reserva.models';
import { ReservaDetalleDialog } from '../../ui/reserva-detalle-dialog/reserva-detalle-dialog';
import { ReservasPage } from './reservas-page';

const url = `${environment.apiBaseUrl}/reservas`;

const base: ReservaResumenResponse = {
  id: 'r-1', codigo: 'ABCD234567', estado: 'PENDIENTE', nombreCliente: 'Rosa Quispe', telefono: '987654321',
  fechaRetiro: '2026-10-13', creadoEn: '2026-10-11T09:30:00', expiraEn: '2026-10-12T09:30:00', unidades: 4, total: 60,
  precioAConfirmar: false, requiereAceptacion: false, precioAceptado: false, sinCobertura: false
};

const pagina = (contenido: ReservaResumenResponse[], totalElementos = contenido.length, paginaActual = 0): PaginaResponse<ReservaResumenResponse> => ({
  contenido, paginaActual, tamanoPagina: 20, totalElementos, totalPaginas: Math.ceil(totalElementos / 20)
});

describe('ReservasPage', () => {
  let http: HttpTestingController;

  const listado = () => http.expectOne((r) => r.url === url && r.params.get('size') === '20');
  const resumen = (estado: string) => http.expectOne((r) => r.url === url && r.params.get('size') === '1' && r.params.get('estado') === estado);

  /** Crea la página y responde la carga inicial (listado + los tres contadores). */
  function crear(filas: ReservaResumenResponse[] = [base], contadores = { PENDIENTE: 3, CONFIRMADA: 5, VENCIDA: 1 }) {
    const fixture = TestBed.createComponent(ReservasPage);
    listado().flush(pagina(filas));
    for (const [estado, total] of Object.entries(contadores)) resumen(estado).flush(pagina([], total));
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carga el listado sin filtros y los contadores por estado salen del total que informa el servidor', () => {
    const f = crear();
    const el = f.nativeElement as HTMLElement;
    const items = Array.from(el.querySelectorAll('.resumen-item')).map((b) => b.textContent?.replace(/\s+/g, ' ').trim());
    expect(items).toEqual(['3 Pendientes de atención', '5 Confirmadas por retirar', '1 Vencidas']);
    expect(el.textContent).toContain('ABCD234567');
    expect(el.textContent).toContain('Rosa Quispe');
    expect(el.textContent).toContain('S/ 60.00');
  });

  it('un contador que falla se muestra como «—» sin tumbar el listado', () => {
    const f = TestBed.createComponent(ReservasPage);
    listado().flush(pagina([base]));
    resumen('PENDIENTE').flush({ mensaje: 'x' }, { status: 500, statusText: 'Server Error' });
    resumen('CONFIRMADA').flush(pagina([], 2));
    resumen('VENCIDA').flush(pagina([], 0));
    f.detectChanges();
    const items = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.resumen-numero')).map((n) => n.textContent?.trim());
    expect(items).toEqual(['—', '2', '0']);
    expect((f.nativeElement as HTMLElement).textContent).toContain('ABCD234567');
  });

  it('los indicadores de cada fila vienen de lo que informa el servidor: sin cobertura, precio a confirmar y falta de aceptación', () => {
    const f = crear([
      { ...base, id: 'a', codigo: 'AAAAAAAAAA', sinCobertura: true, estado: 'CONFIRMADA' },
      { ...base, id: 'b', codigo: 'BBBBBBBBBB', precioAConfirmar: true, total: null, requiereAceptacion: true },
      { ...base, id: 'c', codigo: 'CCCCCCCCCC', requiereAceptacion: true, precioAceptado: false },
      { ...base, id: 'd', codigo: 'DDDDDDDDDD', estado: 'VENCIDA' }
    ]);
    const filas = Array.from((f.nativeElement as HTMLElement).querySelectorAll('tbody tr')).map((tr) => tr.textContent?.replace(/\s+/g, ' ') ?? '');
    expect(filas[0]).toContain('Sin cobertura');
    expect(filas[1]).toContain('Precio a confirmar');
    expect(filas[1]).toContain('A confirmar'); // total null: no se inventa un importe
    expect(filas[2]).toContain('Falta aceptación');
    expect(filas[3]).toContain('Vencida');
    expect(filas[3]).not.toContain('Sin cobertura');
  });

  it('cambiar el estado filtra en el servidor y reinicia la página', () => {
    const f = crear();
    const page = f.componentInstance as unknown as Record<string, (...a: unknown[]) => void> & { pagina: { set(n: number): void } };
    page['pagina'].set(3);
    page['cambiarEstado']('CONFIRMADA');
    const req = listado();
    expect(req.request.params.get('estado')).toBe('CONFIRMADA');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(pagina([{ ...base, estado: 'CONFIRMADA' }]));
  });

  it('filtra por fecha de retiro, teléfono y código (el código se normaliza a mayúsculas)', () => {
    const f = crear();
    const page = f.componentInstance as unknown as Record<string, (...a: unknown[]) => void>;
    page['cambiarFecha']('2026-10-13');
    listado().flush(pagina([]));
    page['cambiarTelefono']('987654321');
    listado().flush(pagina([]));
    page['cambiarCodigo'](' abcd234567 ');
    const req = listado();
    expect(req.request.params.get('fechaRetiro')).toBe('2026-10-13');
    expect(req.request.params.get('telefono')).toBe('987654321');
    expect(req.request.params.get('codigo')).toBe('ABCD234567');
    req.flush(pagina([base]));
  });

  it('limpiar filtros vuelve a pedir el listado sin ningún filtro', () => {
    const f = crear();
    const page = f.componentInstance as unknown as Record<string, (...a: unknown[]) => void>;
    page['cambiarEstado']('VENCIDA');
    listado().flush(pagina([]));
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('No hay reservas con los filtros seleccionados.');
    page['limpiarFiltros']();
    const req = listado();
    for (const filtro of ['estado', 'fechaRetiro', 'telefono', 'codigo']) expect(req.request.params.has(filtro)).toBe(false);
    req.flush(pagina([base]));
  });

  it('el contador es un atajo: filtra por ese estado y, al pulsarlo de nuevo, quita el filtro', () => {
    const f = crear();
    const page = f.componentInstance as unknown as Record<string, (...a: unknown[]) => void>;
    page['alternarEstado']('PENDIENTE');
    const filtrado = listado();
    expect(filtrado.request.params.get('estado')).toBe('PENDIENTE');
    filtrado.flush(pagina([base]));
    page['alternarEstado']('PENDIENTE');
    const sinFiltro = listado();
    expect(sinFiltro.request.params.has('estado')).toBe(false);
    sinFiltro.flush(pagina([base]));
  });

  it('un error del servidor se distingue de una lista vacía y permite reintentar', () => {
    const f = TestBed.createComponent(ReservasPage);
    listado().flush({ mensaje: 'El teléfono del filtro no es válido.' }, { status: 400, statusText: 'Bad Request' });
    for (const estado of ['PENDIENTE', 'CONFIRMADA', 'VENCIDA']) resumen(estado).flush(pagina([], 0));
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('El teléfono del filtro no es válido.');
    expect(el.textContent).not.toContain('Todavía no hay reservas.');
    (f.componentInstance as unknown as Record<string, () => void>)['cargar']();
    listado().flush(pagina([]));
    f.detectChanges();
    expect(el.textContent).toContain('Todavía no hay reservas.');
  });

  it('irAPagina no pide una página fuera de rango', () => {
    const f = TestBed.createComponent(ReservasPage);
    listado().flush(pagina([base], 45));
    for (const estado of ['PENDIENTE', 'CONFIRMADA', 'VENCIDA']) resumen(estado).flush(pagina([], 0));
    const page = f.componentInstance as unknown as Record<string, (...a: unknown[]) => void>;
    page['irAPagina'](-1);
    http.expectNone((r) => r.url === url);
    page['irAPagina'](1);
    expect(listado().request.params.get('page')).toBe('1');
  });

  it('abrir el detalle usa el id de la reserva y recarga listado y contadores solo si hubo cambios', () => {
    const f = crear();
    const dialog = TestBed.inject(Dialog);
    let cerrado!: (resultado: unknown) => void;
    const abrir = vi.spyOn(dialog, 'open').mockImplementation(
      () => ({ closed: { subscribe: (fn: (r: unknown) => void) => (cerrado = fn) } }) as never
    );
    (f.componentInstance as unknown as Record<string, (...a: unknown[]) => void>)['abrirDetalle']('r-1');
    expect(abrir.mock.calls[0][0]).toBe(ReservaDetalleDialog);
    expect(abrir.mock.calls[0][1]?.data).toEqual({ id: 'r-1' });

    cerrado(false);
    http.expectNone((r) => r.url === url);

    cerrado(true);
    listado().flush(pagina([base]));
    for (const estado of ['PENDIENTE', 'CONFIRMADA', 'VENCIDA']) resumen(estado).flush(pagina([], 0));
  });
});
