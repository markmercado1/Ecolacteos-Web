import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { InsumoDetalleDialog, InsumoDetalleDialogData } from './insumo-detalle-dialog';

const base = `${environment.apiBaseUrl}/inventario`;
const insumo = { id: 'i1', nombre: 'azucar', unidadMedida: 'kg', activo: true, stock: 112 };
const lote = (o: Record<string, unknown>) => ({
  id: 'l', insumoId: 'i1', insumoNombre: 'azucar', unidadMedida: 'kg', codigo: 'X', codigoProveedor: null, fechaIngreso: '2026-10-21', fechaVencimiento: null,
  proveedorId: null, proveedorNombre: null, proveedorRuc: null, documentoIngresoId: null, tipoDocumento: null, numeroDocumento: null,
  cantidadInicial: 10, cantidadDisponible: 10, estado: 'VIGENTE', diasParaVencer: null, ...o
});
const lotes = [
  lote({ id: 'a', codigo: 'INICIAL', cantidadInicial: 112, cantidadDisponible: 112 }),
  lote({ id: 'b', codigo: 'AZU-20261029-01', proveedorNombre: 'Distribuidora Andina', numeroDocumento: 'F001-0234', fechaVencimiento: '2026-11-05', diasParaVencer: 7, estado: 'POR_VENCER', cantidadInicial: 100, cantidadDisponible: 100 }),
  lote({ id: 'c', codigo: 'VIEJO', fechaVencimiento: '2026-10-20', diasParaVencer: -9, estado: 'VENCIDO', cantidadInicial: 5, cantidadDisponible: 3 })
];

function crear(data: Partial<InsumoDetalleDialogData> = {}) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DialogRef, useValue: { close } }, { provide: DIALOG_DATA, useValue: { insumo, ...data } }]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(InsumoDetalleDialog);
  f.detectChanges();
  http.expectOne((r) => r.url === `${base}/insumos/i1/lotes`).flush(lotes);
  if ((data.pestana ?? 'kardex') === 'kardex') {
    http.expectOne((r) => r.url === `${base}/kardex/insumos/i1`).flush({
      tipoItem: 'INSUMO', itemId: 'i1', itemNombre: 'azucar', unidadMedida: 'kg', desde: null, hasta: null, saldoInicial: 0, totalEntradas: 0, totalSalidas: 0, saldoFinal: 0,
      movimientos: { contenido: [], paginaActual: 0, tamanoPagina: 50, totalElementos: 0, totalPaginas: 0 }
    });
  }
  f.detectChanges();
  return { f, c: f.componentInstance as any, http, close };
}

describe('InsumoDetalleDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('abre en Kardex y ofrece la pestaña Lotes', () => {
    const { f, c } = crear();
    expect(c['pestana']()).toBe('kardex');
    const tabs = Array.from(f.nativeElement.querySelectorAll('[role=tab]')).map((t: any) => t.textContent.trim());
    expect(tabs).toEqual(['Kardex', 'Lotes']);
  });

  it('la pestaña Lotes muestra código, proveedor, ingreso, vencimiento, cantidades y estado de cada lote', () => {
    const { f } = crear({ pestana: 'lotes' });
    const texto = f.nativeElement.textContent as string;
    expect(texto).toContain('INICIAL');
    expect(texto).toContain('AZU-20261029-01');
    expect(texto).toContain('Distribuidora Andina');
    expect(texto).toContain('F001-0234');
    expect(texto).toContain('Por vencer');
    expect(texto).toContain('Vencido');
    expect(texto).toContain('en 7 d');
    expect(texto).toContain('venció hace 9 d');
  });

  it('solo ADMIN ve «Anular ingreso», y solo en un ingreso sin usar que no es el INICIAL', () => {
    const sinAdmin = crear({ pestana: 'lotes' });
    expect(sinAdmin.f.nativeElement.textContent).not.toContain('Anular ingreso');
    TestBed.resetTestingModule();
    const { f, c } = crear({ pestana: 'lotes', esAdmin: true });
    const botones = Array.from(f.nativeElement.querySelectorAll('button')).filter((b: any) => b.textContent.trim() === 'Anular ingreso');
    expect(botones.length).toBe(1);                       // solo el lote «AZU-…»: el INICIAL y el ya usado (VIEJO 3 de 5) no
    expect(c['puedeAnular'](lotes[0])).toBe(false);
    expect(c['puedeAnular'](lotes[1])).toBe(true);
    expect(c['puedeAnular'](lotes[2])).toBe(false);
  });

  it('anular pide motivo, llama a la anulación, recarga y avisa al cerrar que hubo cambios', () => {
    const { c, http, close } = crear({ pestana: 'lotes', esAdmin: true });
    c['anulando'].set(lotes[1]);
    c['anular'](lotes[1]);
    http.expectNone(`${base}/insumos/lotes/b/anulacion`);       // sin motivo no se envía
    c['motivo'].set('Se cargó dos veces');
    c['anular'](lotes[1]);
    const req = http.expectOne(`${base}/insumos/lotes/b/anulacion`);
    expect(req.request.body).toEqual({ motivo: 'Se cargó dos veces' });
    req.flush({ id: 'm1' });
    http.expectOne((r) => r.url === `${base}/insumos/i1/lotes`).flush(lotes);
    expect(c['huboCambios']()).toBe(true);
    c['dialogRef'].close(c['huboCambios']());
    expect(close).toHaveBeenCalledWith(true);
  });

  it('muestra el motivo del rechazo del servidor al anular', () => {
    const { f, c, http } = crear({ pestana: 'lotes', esAdmin: true });
    c['anulando'].set(lotes[1]);
    c['motivo'].set('x');
    c['anular'](lotes[1]);
    http.expectOne(`${base}/insumos/lotes/b/anulacion`).flush({ mensaje: 'El lote ya se usó' }, { status: 409, statusText: 'Conflict' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('El lote ya se usó');
  });
});
