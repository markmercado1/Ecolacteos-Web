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
});
