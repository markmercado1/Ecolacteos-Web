import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { ConteoInsumoDialog } from './conteo-insumo-dialog';

const base = `${environment.apiBaseUrl}/inventario/insumos/i1`;
const insumo = { id: 'i1', nombre: 'azucar', unidadMedida: 'kg', activo: true, stock: 15 };
const lote = (id: string, codigo: string, cantidadDisponible: number, estado = 'VIGENTE') => ({
  id, codigo, cantidadDisponible, estado, fechaVencimiento: null, insumoId: 'i1', insumoNombre: 'azucar', unidadMedida: 'kg'
});

function crear(lotes: unknown[]) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DialogRef, useValue: { close } }, { provide: DIALOG_DATA, useValue: { insumo } }]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(ConteoInsumoDialog);
  f.detectChanges();
  http.expectOne((r) => r.url === `${base}/lotes` && r.params.get('soloConExistencia') === 'true').flush(lotes);
  f.detectChanges();
  return { f, c: f.componentInstance as any, http, close };
}

describe('ConteoInsumoDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con varios lotes pide la cantidad contada de cada uno y calcula la diferencia por lote', () => {
    const { f, c } = crear([lote('l1', 'INICIAL', 10), lote('l2', 'AZU-20261029-01', 5, 'POR_VENCER')]);
    expect(c['unico']()).toBe(false);
    expect(f.nativeElement.textContent).toContain('INICIAL');
    c['poner']('l1', 7);
    c['poner']('l2', 6);
    expect(c['diferencia'](c['lotes']()[0])).toBe(-3);
    expect(c['diferencia'](c['lotes']()[1])).toBe(1);
  });

  it('atajo: con un solo lote se pide una sola cantidad (sin columnas de lote)', () => {
    const { f, c } = crear([lote('l1', 'INICIAL', 10)]);
    expect(c['unico']()).toBe(true);
    expect(f.nativeElement.querySelectorAll('input[type=number]').length).toBe(1);
    expect(f.nativeElement.textContent).not.toContain('Lote');
  });

  it('envía solo los lotes que difieren, con el motivo, a /conteos', () => {
    const { c, http, close } = crear([lote('l1', 'INICIAL', 10), lote('l2', 'L2', 5)]);
    c['poner']('l1', 7);
    c['motivo'].set(' Conteo de octubre ');
    c['enviar']();
    const req = http.expectOne(`${base}/conteos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo: 'Conteo de octubre', lotes: [{ loteId: 'l1', cantidadContada: 7 }] });
    req.flush({ insumoNombre: 'azucar', saldoAnterior: 15, saldoResultante: 12, unidadMedida: 'kg', diferencias: [] });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ saldoResultante: 12 }));
  });

  it('exige motivo, rechaza cantidades inválidas y avisa si no hay diferencia, sin llamar al backend', () => {
    const { c, http } = crear([lote('l1', 'INICIAL', 10)]);
    c['poner']('l1', 7);
    c['enviar']();                                   // sin motivo
    c['motivo'].set('x');
    c['poner']('l1', 1.234);
    c['enviar']();                                   // más de dos decimales
    c['poner']('l1', 10);
    c['enviar']();                                   // coincide con el sistema
    expect(c['errorServidor']()).toContain('no hay ninguna diferencia');
    http.expectNone(`${base}/conteos`);
  });

  it('muestra el mensaje del servidor y permite corregir', () => {
    const { f, c, http } = crear([lote('l1', 'INICIAL', 10)]);
    c['poner']('l1', 4);
    c['motivo'].set('Conteo');
    c['enviar']();
    http.expectOne(`${base}/conteos`).flush({ mensaje: 'El lote no es de azucar.' }, { status: 400, statusText: 'Bad Request' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('El lote no es de azucar.');
    expect(c['enviando']()).toBe(false);
  });
});
