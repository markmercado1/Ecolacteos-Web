import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { HistorialPrecioDialog, HistorialPrecioDialogData } from './historial-precio-dialog';
import { PrecioQuesoResponse } from '../../data-access/precio-queso.models';

const base = environment.apiBaseUrl;

function isoHaceDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function precio(datos: Partial<PrecioQuesoResponse> & { id: string; modalidad: PrecioQuesoResponse['modalidad']; vigenteDesde: string }): PrecioQuesoResponse {
  return {
    presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoId: 'prod-1', productoNombre: 'Yogurt', precio: 10,
    ...datos
  };
}

function crear(data: HistorialPrecioDialogData) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(HistorialPrecioDialog);
  return { c: f.componentInstance, http };
}

const DATA: HistorialPrecioDialogData = { productoNombre: 'Yogurt', presentacionNombre: 'Botella 1 L', presentacionId: 'pres-1' };

describe('HistorialPrecioDialog', () => {
  it('consulta el histórico de solo esa presentación (nunca el histórico completo del catálogo)', () => {
    const { http } = crear(DATA);
    const req = http.expectOne((r) => r.url === `${base}/admin/precios-queso`);
    expect(req.request.params.get('presentacionId')).toBe('pres-1');
    req.flush([]);
    http.verify();
  });

  it('muestra estado de carga mientras espera la respuesta', () => {
    const { c, http } = crear(DATA);
    expect(c['cargando']()).toBe(true);
    http.expectOne(`${base}/admin/precios-queso?presentacionId=pres-1`).flush([]);
    expect(c['cargando']()).toBe(false);
  });

  it('un error del servidor se muestra y permite reintentar', () => {
    const { c, http } = crear(DATA);
    http.expectOne((r) => r.url === `${base}/admin/precios-queso`).flush(
      { mensaje: 'Error de servidor' },
      { status: 500, statusText: 'Server Error' }
    );
    expect(c['error']()).toBeTruthy();
    expect(c['cargando']()).toBe(false);

    c['cargar']();
    http.expectOne((r) => r.url === `${base}/admin/precios-queso`).flush([]);
    expect(c['error']()).toBeNull();
    http.verify();
  });

  it('ordena el histórico del más reciente al más antiguo', () => {
    const { c, http } = crear(DATA);
    const precios = [
      precio({ id: 'a', modalidad: 'PUBLICO', vigenteDesde: '2026-01-01' }),
      precio({ id: 'b', modalidad: 'PUBLICO', vigenteDesde: '2026-06-01' }),
      precio({ id: 'c', modalidad: 'PUBLICO', vigenteDesde: '2026-03-01' })
    ];
    http.expectOne((r) => r.url === `${base}/admin/precios-queso`).flush(precios);

    expect(c['ordenados']().map((p) => p.id)).toEqual(['b', 'c', 'a']);
    http.verify();
  });

  it('distingue vigente/programado/anterior por modalidad de forma independiente', () => {
    const { c, http } = crear(DATA);
    const precios = [
      precio({ id: 'pub-viejo', modalidad: 'PUBLICO', vigenteDesde: isoHaceDias(-60) }),
      precio({ id: 'pub-actual', modalidad: 'PUBLICO', vigenteDesde: isoHaceDias(-5) }),
      precio({ id: 'pub-futuro', modalidad: 'PUBLICO', vigenteDesde: isoHaceDias(30) }),
      precio({ id: 'may-actual', modalidad: 'MAYORISTA', vigenteDesde: isoHaceDias(-20) })
    ];
    http.expectOne((r) => r.url === `${base}/admin/precios-queso`).flush(precios);

    expect(c['estadoDe'](precios[0])).toBe('Anterior');
    expect(c['estadoDe'](precios[1])).toBe('Vigente');
    expect(c['estadoDe'](precios[2])).toBe('Programado');
    expect(c['estadoDe'](precios[3])).toBe('Vigente'); // MAYORISTA vigente no depende de PUBLICO
    http.verify();
  });

  it('etiquetaModalidad traduce las tres modalidades', () => {
    const { c, http } = crear(DATA);
    http.expectOne((r) => r.url === `${base}/admin/precios-queso`).flush([]);
    expect(c['etiquetaModalidad']('MAYORISTA')).toBe('Mayorista');
    expect(c['etiquetaModalidad']('PROVEEDOR')).toBe('Proveedor');
    expect(c['etiquetaModalidad']('PUBLICO')).toBe('Público');
  });
});
