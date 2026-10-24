import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { HistorialEntregaResponse, HistorialResumenResponse, SeccionHistorial } from '../../data-access/historial.models';
import { HistorialApi } from '../../data-access/historial.api';
import { HistorialConsolidadoDialog } from './historial-consolidado-dialog';

const base = `${environment.apiBaseUrl}/proveedores/p-1/historial`;

const entregasResumen = { total: 7, litrosRecibidos: 700, litrosEfectivos: 685, primeraEntrega: '2026-10-02T06:00:00', ultimaEntrega: '2026-10-23T20:00:00', conCorreccion: 2, sinZona: 1 };
const calidadResumen = { analizadas: 3, sinAnalisis: 4, aprobadas: 2, observadas: 1, rechazadas: 0, alertas: 1, conPrecioDeCalidad: 1 };
const pagosResumen = {
  liquidaciones: 1, litrosLiquidados: 595, totalOriginal: 595, totalReconocido: 585, ajusteCalidad: -10, ajustesLitros: -10, totalConAjustes: 575, pagado: 200,
  saldoLiquidaciones: 375, adelantosSinAplicar: 50, saldoNeto: 325, entregasSinLiquidar: 1, litrosSinLiquidar: 100
};
const zona = { id: 'h-1', zonaId: 'z-1', zonaNombre: 'Zona Sur', desde: '2026-10-23', hasta: null, inicioEn: '2026-10-23T19:00:00', finEn: null, zonaOrigenNombre: null, motivo: null, usuarioNombre: null, requiereRevision: false, notaRevision: null };

function resumen(secciones: SeccionHistorial[]): HistorialResumenResponse {
  return {
    proveedorId: 'p-1', proveedorNombre: 'Alejandro Terrones', zonaActualNombre: 'Zona Sur', secciones,
    entregas: entregasResumen,
    calidad: secciones.includes('CALIDAD') ? calidadResumen : null,
    pagos: secciones.includes('PAGOS') ? pagosResumen : null,
    zonas: secciones.includes('ZONAS') ? [zona] : null
  };
}

const fila = (extra: Partial<HistorialEntregaResponse> = {}): HistorialEntregaResponse => ({
  id: 'r-1', fechaHora: '2026-10-22T06:00:00', litrosOriginales: 100, litrosEfectivos: 100, corregida: false, zonaNombre: 'Zona Norte',
  calidad: null, liquidacion: null, ...extra
});

function crear(r: HistorialResumenResponse | 'error', filas: HistorialEntregaResponse[] = [], total = filas.length) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { proveedorId: 'p-1', proveedorNombre: 'Alejandro Terrones' } },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(HistorialConsolidadoDialog);
  const req = http.expectOne(`${base}/resumen`);
  if (r === 'error') {
    req.flush({ mensaje: 'Proveedor no encontrado' }, { status: 404, statusText: 'Not Found' });
  } else {
    req.flush(r);
    http.expectOne((x) => x.url === `${base}/entregas`).flush({ contenido: filas, paginaActual: 0, tamanoPagina: 10, totalElementos: total, totalPaginas: Math.ceil(total / 10) });
  }
  f.detectChanges();
  return { f, http };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const texto = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ');
const comp = (f: ComponentFixture<HistorialConsolidadoDialog>) => f.componentInstance as unknown as Record<string, any>;

describe('HistorialApi', () => {
  it('lee el resumen y las entregas paginadas del proveedor (con la URL codificada)', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const api = TestBed.inject(HistorialApi);
    api.resumen('p 1').subscribe();
    http.expectOne(`${environment.apiBaseUrl}/proveedores/p%201/historial/resumen`).flush({});
    api.entregas('p-1', { page: 2, size: 10 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/entregas`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('10');
    req.flush({});
    http.verify();
  });
});

describe('HistorialConsolidadoDialog', () => {
  it('ADMIN: muestra todas las secciones, los totales del servidor y los movimientos de zona', () => {
    const { f, http } = crear(resumen(['ENTREGAS', 'CALIDAD', 'PAGOS', 'ZONAS']), [fila()]);
    expect(el(f).querySelector('[data-testid="seccion-entregas"]')).not.toBeNull();
    expect(el(f).querySelector('[data-testid="seccion-calidad"]')).not.toBeNull();
    expect(el(f).querySelector('[data-testid="seccion-pagos"]')).not.toBeNull();
    expect(el(f).querySelector('[data-testid="seccion-zonas"]')).not.toBeNull();
    expect(texto(el(f).querySelector('[data-testid="entregas-total"]'))).toBe('7');
    const pagos = texto(el(f).querySelector('[data-testid="seccion-pagos"]'));
    expect(pagos).toContain('S/ 585.00'); // total reconocido tal cual lo envía el servidor
    expect(pagos).toContain('−S/ 10.00'); // ajustes con signo
    expect(pagos).toContain('S/ 200.00');
    expect(pagos).toContain('Saldo de las liquidacionesS/ 375.00'); // un saldo por pagar no lleva signo (+)
    expect(pagos).not.toContain('+S/ 375.00');
    expect(texto(el(f).querySelector('[data-testid="saldo-neto"]'))).toContain('Saldo neto por pagarS/ 325.00');
    expect(texto(el(f).querySelector('[data-testid="sin-liquidar"]'))).toContain('1 entrega(s) todavía sin liquidar (100.00 L)');
    expect(el(f).querySelectorAll('[data-testid="zona-item"]').length).toBe(1);
    expect(texto(el(f)) ).toContain('Zona actual: Zona Sur');
    http.verify();
  });

  it('CALIDAD: solo entregas y calidad; sin pagos, sin zonas y sin columna de liquidación', () => {
    const { f, http } = crear(resumen(['ENTREGAS', 'CALIDAD']), [fila({ calidad: { resultado: 'APROBADO', folio: 'F-1', analizadoEn: null, analisis: 1, alertas: 0, precioPropio: false } })]);
    expect(el(f).querySelector('[data-testid="seccion-pagos"]')).toBeNull();
    expect(el(f).querySelector('[data-testid="seccion-zonas"]')).toBeNull();
    const cabeceras = Array.from(el(f).querySelectorAll('th')).map((t) => t.textContent?.trim());
    expect(cabeceras).toContain('Calidad');
    expect(cabeceras).not.toContain('Liquidación');
    http.verify();
  });

  it('RECEPCION: entregas y pagos; sin calidad ni zonas y sin columna de calidad', () => {
    const { f, http } = crear(resumen(['ENTREGAS', 'PAGOS']), [fila()]);
    expect(el(f).querySelector('[data-testid="seccion-calidad"]')).toBeNull();
    expect(el(f).querySelector('[data-testid="seccion-pagos"]')).not.toBeNull();
    const cabeceras = Array.from(el(f).querySelectorAll('th')).map((t) => t.textContent?.trim());
    expect(cabeceras).toContain('Liquidación');
    expect(cabeceras).not.toContain('Calidad');
    http.verify();
  });

  it('cada entrega dice con texto su zona (o «Sin zona»), si fue corregida, su calidad y su liquidación', () => {
    const filas = [
      fila({ id: 'a', zonaNombre: null, corregida: true, litrosOriginales: 100, litrosEfectivos: 95,
        calidad: { resultado: 'OBSERVADO', folio: 'F-2', analizadoEn: null, analisis: 2, alertas: 1, precioPropio: true },
        liquidacion: { pagoId: 'pg-1', semanaInicio: '2026-10-17', semanaFin: '2026-10-23', litrosLiquidados: 95, precioAplicado: 0.9, importe: 85.5 } }),
      fila({ id: 'b', calidad: { resultado: null, folio: null, analizadoEn: null, analisis: 0, alertas: 0, precioPropio: false }, liquidacion: null })
    ];
    const { f, http } = crear(resumen(['ENTREGAS', 'CALIDAD', 'PAGOS']), filas);
    const [a, b] = Array.from(el(f).querySelectorAll('[data-testid="entrega"]'));
    const ta = texto(a);
    expect(ta).toContain('Sin zona');
    expect(ta).toContain('Corregida');
    expect(ta).toContain('recibido 100.00 L');
    expect(ta).toContain('95.00 L');
    expect(ta).toContain('OBSERVADO');
    expect(ta).toContain('1 alerta(s)');
    expect(ta).toContain('Precio propio');
    expect(ta).toContain('2026-10-17 → 2026-10-23');
    expect(ta).toContain('95.00 L × S/ 0.90 = S/ 85.50');
    const tb = texto(b);
    expect(tb).toContain('Zona Norte');
    expect(tb).toContain('Sin análisis');
    expect(tb).toContain('Sin liquidar');
    http.verify();
  });

  it('un saldo neto negativo se presenta como saldo a favor del proveedor', () => {
    const r = resumen(['ENTREGAS', 'PAGOS']);
    r.pagos = { ...pagosResumen, saldoNeto: -25, saldoLiquidaciones: -5, entregasSinLiquidar: 0 };
    const { f, http } = crear(r, []);
    const neto = texto(el(f).querySelector('[data-testid="saldo-neto"]'));
    expect(neto).toContain('Saldo neto a favor del proveedorS/ 25.00');
    expect(el(f).querySelector('[data-testid="sin-liquidar"]')).toBeNull();
    http.verify();
  });

  it('sin entregas muestra el estado vacío; un error del resumen se muestra y se puede reintentar', () => {
    const vacio = crear(resumen(['ENTREGAS']), []);
    expect(texto(el(vacio.f))).toContain('Este proveedor no tiene entregas registradas.');
    TestBed.resetTestingModule();

    const { f, http } = crear('error');
    expect(comp(f)['errorResumen']()).not.toBeNull();
    expect(el(f).querySelector('[data-testid="seccion-entregas"]')).toBeNull();
    comp(f)['cargarResumen']();
    http.expectOne(`${base}/resumen`).flush(resumen(['ENTREGAS']));
    http.expectOne((x) => x.url === `${base}/entregas`).flush({ contenido: [], paginaActual: 0, tamanoPagina: 10, totalElementos: 0, totalPaginas: 0 });
    f.detectChanges();
    expect(comp(f)['errorResumen']()).toBeNull();
    http.verify();
  });

  it('cambiar de página pide esa página al servidor', () => {
    const { f, http } = crear(resumen(['ENTREGAS']), [fila()], 25);
    comp(f)['irAPagina'](1);
    const req = http.expectOne((x) => x.url === `${base}/entregas`);
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ contenido: [fila({ id: 'z' })], paginaActual: 1, tamanoPagina: 10, totalElementos: 25, totalPaginas: 3 });
    comp(f)['irAPagina'](9); // fuera de rango: no se pide
    http.verify();
  });

  it('es solo de lectura: el único botón de acción es cerrar', () => {
    const { f, http } = crear(resumen(['ENTREGAS', 'CALIDAD', 'PAGOS', 'ZONAS']), [fila()]);
    const botones = Array.from(el(f).querySelectorAll('button')).map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim());
    expect(botones.filter((b) => !/^\d+$/.test(b ?? '') && !/(anterior|siguiente|Anterior|Siguiente|página)/i.test(b ?? ''))).toEqual(['Cerrar historial']);
    http.verify();
  });
});
