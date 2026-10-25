import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { VentaDetalleDialog, VentaDetalleDialogData } from './venta-detalle-dialog';

const base = environment.apiBaseUrl;

function crear(data: VentaDetalleDialogData): { fixture: ComponentFixture<VentaDetalleDialog>; http: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(VentaDetalleDialog);
  fixture.detectChanges();
  return { fixture, http };
}

const ventaDeUnaLinea = {
  id: 'v-1',
  fecha: '2026-09-17',
  tipoCliente: 'PROVEEDOR',
  detalles: [
    { presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoNombre: 'Andino', cantidad: 4, precioUnitario: 8.5, subtotal: 34 }
  ],
  total: 34
};

const ventaDeVariasLineas = {
  id: 'v-2',
  fecha: '2026-09-18',
  tipoCliente: 'PUBLICO',
  detalles: [
    { presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoNombre: 'Yogurt', cantidad: 3, precioUnitario: 10, subtotal: 30 },
    { presentacionId: 'pres-2', presentacionNombre: 'Unidad', productoNombre: 'Queso', cantidad: 1, precioUnitario: 12, subtotal: 12 }
  ],
  total: 42
};

describe('VentaDetalleDialog', () => {
  it('consulta GET /api/ventas/{id} y muestra los campos confirmados de una venta de una sola línea', () => {
    const { fixture, http } = crear({ id: 'v-1' });
    http.expectOne(`${base}/ventas/v-1`).flush(ventaDeUnaLinea);
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Proveedor');
    expect(texto).toContain('Andino');
    expect(texto).toContain('Botella 1 L');
    expect(texto).toContain('34.00');
    http.verify();
  });

  it('muestra todas las líneas de una venta con varias presentaciones, cada una con su propio subtotal', () => {
    const { fixture, http } = crear({ id: 'v-2' });
    http.expectOne(`${base}/ventas/v-2`).flush(ventaDeVariasLineas);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const filas = raiz.querySelectorAll('tbody tr');
    expect(filas.length).toBe(2);
    const texto = raiz.textContent ?? '';
    expect(texto).toContain('30.00');
    expect(texto).toContain('12.00');
    expect(texto).toContain('42.00'); // total
    http.verify();
  });

  it('venta inexistente: muestra el error 404 y el botón "Reintentar" vuelve a consultar', () => {
    const { fixture, http } = crear({ id: 'v-inexistente' });
    http.expectOne(`${base}/ventas/v-inexistente`).flush({ mensaje: 'Venta no encontrada' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).toContain('Venta no encontrada');

    const botonReintentar = Array.from(raiz.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Reintentar'
    )!;
    botonReintentar.click();

    http.expectOne(`${base}/ventas/v-inexistente`).flush(ventaDeUnaLinea);
    http.verify();
  });

  it('encoda el id en la URL', () => {
    const { http } = crear({ id: 'id con espacio' });
    http.expectOne(`${base}/ventas/id%20con%20espacio`).flush({ ...ventaDeUnaLinea, id: 'id con espacio' });
    http.verify();
  });

  describe('Fase G: IGV', () => {
    it('una venta sin foto tributaria (anterior o con el cálculo apagado) se ve igual que antes, sin «Incluye IGV»', () => {
      const { fixture, http } = crear({ id: 'v-1' });
      http.expectOne(`${base}/ventas/v-1`).flush({ ...ventaDeUnaLinea, igv: { estado: 'SIN_DETERMINAR', incluyeIgv: false, operacionesGravadas: 0,
        operacionesExoneradas: 0, operacionesInafectas: 0, igvTotal: 0, montoSinDeterminar: 34 } });
      fixture.detectChanges();
      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.querySelector('[data-testid="desglose-igv"]')).toBeNull();
      expect(raiz.querySelectorAll('[data-testid="igv-linea"]').length).toBe(0);
      expect(raiz.textContent).not.toContain('IGV');
      http.verify();
    });

    it('una venta gravada muestra el IGV incluido por línea y en total; la parte sin clasificar queda «sin determinar»', () => {
      const { fixture, http } = crear({ id: 'v-2' });
      http.expectOne(`${base}/ventas/v-2`).flush({
        ...ventaDeVariasLineas,
        detalles: [
          { ...ventaDeVariasLineas.detalles[0], afectacionIgv: 'GRAVADO', tasaIgv: 18, valorVenta: 25.42, igv: 4.58 },
          { ...ventaDeVariasLineas.detalles[1], afectacionIgv: null, tasaIgv: null, valorVenta: null, igv: null }
        ],
        igv: { estado: 'PARCIAL', incluyeIgv: true, operacionesGravadas: 25.42, operacionesExoneradas: 0, operacionesInafectas: 0, igvTotal: 4.58, montoSinDeterminar: 12 }
      });
      fixture.detectChanges();
      const raiz = fixture.nativeElement as HTMLElement;
      const lineas = Array.from(raiz.querySelectorAll('[data-testid="igv-linea"]')).map((e) => e.textContent?.replace(/\s+/g, ' ').trim());
      expect(lineas[0]).toContain('Incluye S/ 4.58 (18 %)');
      expect(lineas[1]).toContain('Sin determinar');
      const desglose = raiz.querySelector('[data-testid="desglose-igv"]')?.textContent ?? '';
      expect(desglose).toContain('Incluye IGV: S/ 4.58');
      expect(desglose).toContain('Sin determinar: S/ 12.00');
      expect(raiz.textContent).toContain('S/ 42.00'); // el total cobrado no cambia
      http.verify();
    });
  });
});

describe('VentaDetalleDialog — Fase H: comprador', () => {
  it('muestra «Cliente varios» si no se identificó y el comprador con su reserva de origen si lo hay', () => {
    const anon = crear({ id: 'v-1' });
    anon.http.expectOne(`${base}/ventas/v-1`).flush({ ...ventaDeUnaLinea, comprador: null });
    anon.fixture.detectChanges();
    expect((anon.fixture.nativeElement as HTMLElement).querySelector('[data-testid="comprador-venta"]')?.textContent).toContain('Cliente varios');
    TestBed.resetTestingModule();

    const conComprador = crear({ id: 'v-2' });
    conComprador.http.expectOne(`${base}/ventas/v-2`).flush({ ...ventaDeVariasLineas, comprador: { tipo: 'CLIENTE', id: 'c-1', nombre: 'Rosa Quispe', ruc: null },
      reservaId: 'r-1', reservaCodigo: 'ABC123' });
    conComprador.fixture.detectChanges();
    const raiz = conComprador.fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-testid="comprador-venta"]')?.textContent).toContain('Rosa Quispe (cliente)');
    expect(raiz.querySelector('[data-testid="reserva-origen"]')?.textContent).toContain('ABC123');
  });
});
