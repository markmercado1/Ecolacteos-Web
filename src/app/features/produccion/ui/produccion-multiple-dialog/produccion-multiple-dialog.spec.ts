import { TestBed } from '@angular/core/testing';
import { DialogRef } from '@angular/cdk/dialog';
import { of, throwError, Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { RecetasApi } from '../../../catalogos/data-access/recetas.api';
import { DisponibilidadProduccion } from '../../../catalogos/data-access/receta.models';
import { LotesProduccionApi } from '../../data-access/lotes-produccion.api';
import { ProduccionMultipleDialog, sumarDisponibilidad } from './produccion-multiple-dialog';

function calculo(litros = 100, stock = 500): DisponibilidadProduccion {
  return { litrosSolicitados: litros, factor: 1, leche: { insumoId: null, nombre: 'Leche', unidadMedida: 'L', requerido: litros, disponible: stock, suficiente: stock >= litros, faltante: Math.max(0, litros - stock) },
    insumos: [{ insumoId: 'sal', nombre: 'Sal', unidadMedida: 'kg', requerido: 1, disponible: 1.5, suficiente: true, faltante: 0 }],
    todoDisponible: stock >= litros, cantidadEsperada: 10, unidadConteo: 'unidad', presentacionNombre: 'Pieza', litrosMaximos: null, cantidadEsperadaMaxima: null };
}
function setup(stockSal = 10) {
  const recetas = { listar: vi.fn(() => of([{ id: 'r1', nombre: 'Yogurt', activo: true }, { id: 'r2', nombre: 'Queso', activo: true }])),
    calcular: vi.fn((_id: string, litros: number) => { const c = calculo(litros); c.insumos[0].disponible = stockSal; return of(c); }) };
  const lotes = { planificar: vi.fn((r: any) => of({ id: r.recetaId, estado: 'PLANIFICADA' })), iniciar: vi.fn((id: string) => of({ id, estado: 'EN_PRODUCCION' })) };
  const close = vi.fn();
  TestBed.configureTestingModule({ providers: [{ provide: RecetasApi, useValue: recetas }, { provide: LotesProduccionApi, useValue: lotes }, { provide: DialogRef, useValue: { close } }] });
  const f = TestBed.createComponent(ProduccionMultipleDialog);
  return { f, c: f.componentInstance, recetas, lotes, close };
}
async function seleccionar(c: ProduccionMultipleDialog) {
  c['agregar']();
  c['filas']().forEach((f, i) => { c['cambiar'](f.uuid, 'recetaId', 'r' + (i + 1)); c['cambiar'](f.uuid, 'litros', 100); });
  await new Promise(r => setTimeout(r, 350));
}

describe('Producción con varias recetas', () => {
  it('suma consumos compartidos sin duplicar disponible ni convertir unidades', () => {
    const r = sumarDisponibilidad([calculo(), calculo()]);
    expect(r.leche.requerido).toBe(200); expect(r.leche.disponible).toBe(500);
    expect(r.insumos[0].requerido).toBe(2); expect(r.insumos[0].disponible).toBe(1.5);
    expect(r.insumos[0].faltante).toBe(0.5); expect(r.todoDisponible).toBe(false);
  });
  it('bloquea iniciar si las recetas por separado caben pero juntas no', async () => {
    const { c, lotes } = setup(1.5); await seleccionar(c);
    await c['enviar'](true); expect(lotes.planificar).not.toHaveBeenCalled();
    await c['enviar'](false); expect(lotes.planificar).toHaveBeenCalledTimes(2);
    expect(lotes.iniciar).not.toHaveBeenCalled();
  });
  it('inicia dos lotes distintos con las cantidades de cada fila', async () => {
    const { c, lotes, f } = setup(); await seleccionar(c);
    await c['enviar'](true);
    expect(lotes.planificar).toHaveBeenCalledTimes(2); expect(lotes.iniciar.mock.calls).toEqual([['r1'], ['r2']]);
    const requests = lotes.planificar.mock.calls.map(x => x[0]);
    expect(requests[0].litros).toBe(100); expect(requests[1].litros).toBe(100);
    expect(requests[0].uuidCliente).not.toBe(requests[1].uuidCliente);
    expect(c['terminado']()).toBe(true); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Iniciada · leche e insumos descontados');
  });
  it('un fallo parcial conserva los éxitos y reintenta solo el inicio pendiente', async () => {
    const { c, lotes } = setup(); await seleccionar(c);
    lotes.iniciar.mockImplementationOnce(id => of({ id, estado: 'EN_PRODUCCION' })).mockImplementationOnce(() => throwError(() => new HttpErrorResponse({ status: 0 })));
    await c['enviar'](true);
    expect(c['filas']()[0].completada).toBe(true); expect(c['filas']()[1].completada).toBeUndefined();
    expect(c['filas']()[1].estado).toContain('inicio no confirmado');
    await c['enviar'](true);
    expect(lotes.planificar).toHaveBeenCalledTimes(2);
    expect(lotes.iniciar.mock.calls).toEqual([['r1'], ['r2'], ['r2']]);
    expect(c['terminado']()).toBe(true);
  });
  it('conserva solicitud, UUID y modo tras perder la respuesta de planificar', async () => {
    const { c, lotes } = setup(); await seleccionar(c);
    lotes.planificar.mockImplementationOnce(() => throwError(() => new HttpErrorResponse({ status: 500 })));
    await c['enviar'](false);
    const request = lotes.planificar.mock.calls[0][0];
    c['cambiar'](c['filas']()[0].uuid, 'litros', 999);
    c['fecha'] = '2027-01-01';
    await c['enviar'](true);
    expect(lotes.planificar.mock.calls[1][0]).toEqual(request);
    expect(lotes.iniciar).not.toHaveBeenCalled();
  });
  it('invalida el resumen inmediatamente al editar y permite quitar filas', async () => {
    const { c } = setup(); await seleccionar(c); expect(c['resumen']()).not.toBeNull();
    c['cambiar'](c['filas']()[1].uuid, 'litros', -1); expect(c['resumen']()).toBeNull();
    c['quitar'](c['filas']()[1].uuid); await new Promise(r => setTimeout(r, 350));
    expect(c['resumen']()?.leche.requerido).toBe(100);
  });
  it('impide doble envío y cierre mientras se confirma', async () => {
    const { c, lotes, close } = setup(); await seleccionar(c);
    const pendiente = new Subject<any>(); lotes.planificar.mockImplementationOnce(() => pendiente);
    const envio = c['enviar'](true); await c['enviar'](true); c['cerrar']();
    expect(lotes.planificar).toHaveBeenCalledTimes(1); expect(close).not.toHaveBeenCalled();
    pendiente.next({ id: 'r1', estado: 'PLANIFICADA' }); pendiente.complete(); await envio;
    expect(c['terminado']()).toBe(true);
  });
});
