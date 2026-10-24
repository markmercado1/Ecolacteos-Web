import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { AjusteCalidadEntregaResponse } from '../../../pagos/data-access/pago.models';
import { PreciosCalidadEntregaDialog } from './precios-calidad-entrega-dialog';

const base = environment.apiBaseUrl;
const url = `${base}/analisis-calidad/registro/r-1/precios-calidad`;

const precio = (id: string, nuevo: number, efecto: number): AjusteCalidadEntregaResponse => ({
  id, pagoId: 'pg-1', registroAcopioId: 'r-1', analisisCalidadId: 'a-1', analisisFolio: 'F-0042', analisisResultado: 'OBSERVADO', litrosLiquidados: 100,
  precioNormal: 1, precioAnterior: 1, precioLitroNuevo: nuevo, efectoEnElTotal: efecto, motivo: 'Agua en la leche', usuarioNombre: 'Administrador',
  creadoEn: '2026-10-21T10:30:00'
});

function crear(respuesta: AjusteCalidadEntregaResponse[] | 'error', proveedorNombre?: string) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { registroAcopioId: 'r-1', proveedorNombre } },
      { provide: DialogRef, useValue: { close } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(PreciosCalidadEntregaDialog);
  const req = http.expectOne(url);
  expect(req.request.method).toBe('GET');
  if (respuesta === 'error') {
    req.flush({ mensaje: 'Registro no encontrado' }, { status: 404, statusText: 'Not Found' });
  } else {
    req.flush(respuesta);
  }
  f.detectChanges();
  return { f, http, close };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const texto = (f: ComponentFixture<unknown>) => (el(f).textContent ?? '').replace(/\s+/g, ' ');
const comp = (f: ComponentFixture<PreciosCalidadEntregaDialog>) => f.componentInstance as unknown as Record<string, any>;

describe('PreciosCalidadEntregaDialog (CALIDAD)', () => {
  it('lista los precios de calidad de la entrega, el más reciente primero, con análisis, motivo y efecto del servidor', () => {
    const { f, http } = crear([precio('ac-2', 0.85, -15), precio('ac-1', 0.9, -10)], 'Alejandro Terrones');
    const items = Array.from(el(f).querySelectorAll('[data-testid="precio-calidad"]')) as HTMLElement[];
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('S/ 1.00 → S/ 0.85');
    expect(items[0].textContent).toContain('−S/ 15.00');
    expect(items[0].textContent).toContain('Análisis F-0042 (OBSERVADO)');
    expect(items[0].textContent).toContain('100 L liquidados');
    expect(items[0].textContent).toContain('Agua en la leche');
    expect(items[0].textContent).toContain('Administrador');
    expect(items[0].textContent).toContain('21/10/2026 10:30');
    expect(items[1].textContent).toContain('S/ 0.90');
    expect(texto(f)).toContain('Alejandro Terrones');
    http.verify();
  });

  it('es solo lectura y no da acceso a pagos: sin botones de acción ni enlaces al pago', () => {
    const { f, http } = crear([precio('ac-1', 0.9, -10)]);
    const botones = Array.from(el(f).querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(botones.every((b) => b === '×' || b === 'Cerrar')).toBe(true);
    expect(el(f).querySelector('a')).toBeNull();
    expect(texto(f)).toContain('Es solo una consulta');
    http.verify();
  });

  it('una entrega sin precios de calidad muestra un estado vacío, no un error', () => {
    const { f, http } = crear([]);
    expect(texto(f)).toContain('Esta entrega no tiene precios de calidad aplicados.');
    expect(comp(f)['error']()).toBeNull();
    http.verify();
  });

  it('un efecto positivo se muestra con signo +', () => {
    const { f, http } = crear([precio('ac-1', 1.1, 10)]);
    expect(texto(f)).toContain('+S/ 10.00');
    http.verify();
  });

  it('un error del servidor se muestra y permite reintentar', () => {
    const { f, http } = crear('error');
    expect(comp(f)['error']()).not.toBeNull();
    expect(el(f).querySelectorAll('[data-testid="precio-calidad"]').length).toBe(0);
    comp(f)['cargar']();
    http.expectOne(url).flush([precio('ac-1', 0.9, -10)]);
    f.detectChanges();
    expect(comp(f)['error']()).toBeNull();
    expect(el(f).querySelectorAll('[data-testid="precio-calidad"]').length).toBe(1);
    http.verify();
  });
});
