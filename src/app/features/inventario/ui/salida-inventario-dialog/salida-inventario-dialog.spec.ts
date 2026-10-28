import { EMPTY } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { SalidaInventarioDialog } from './salida-inventario-dialog';

const url = `${environment.apiBaseUrl}/inventario/insumos/sal/salidas`;
function crear() {
  const close = vi.fn();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
    { provide: DIALOG_DATA, useValue: { tipo: 'insumos', id: 'sal', nombre: 'Sal', controlaVencimiento: false } },
    { provide: DialogRef, useValue: { close, backdropClick: EMPTY, keydownEvents: EMPTY } }
  ] });
  const f = TestBed.createComponent(SalidaInventarioDialog); f.detectChanges();
  return { c: f.componentInstance, http: TestBed.inject(HttpTestingController), close };
}
describe('SalidaInventarioDialog', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());
  it('una respuesta incierta conserva la solicitud aunque cambie el formulario y bloquea doble envío', () => {
    const { c, http, close } = crear();
    c['form'].setValue({ lote: '', cantidad: 2.5, tipo: 'DETERIORO', motivo: 'Envase roto' });
    c['enviar'](); c['enviar']();
    const r = http.expectOne(url); const original = r.request.body;
    expect(original.cantidad).toBe(2.5); expect(original.uuidCliente).toBeTruthy();
    r.flush({}, { status: 503, statusText: 'Unavailable' });
    c['form'].controls.cantidad.setValue(9); c['enviar']();
    const reintento = http.expectOne(url); expect(reintento.request.body).toEqual(original);
    reintento.flush({ id: 'salida', movimientoId: 'movimiento' });
    expect(close).toHaveBeenCalledWith({ id: 'salida', movimientoId: 'movimiento' }); http.verify();
  });
  it('rechaza cantidad inválida y motivo vacío sin invocar la API', () => {
    const { c, http } = crear();
    c['form'].setValue({ lote: '', cantidad: -1, tipo: 'OTRA', motivo: '   ' }); c['enviar']();
    http.expectNone(url); http.verify();
  });
  it('un rechazo de validación permite corregir y genera una nueva clave', () => {
    const { c, http } = crear();
    c['form'].setValue({ lote: '', cantidad: 20, tipo: 'OTRA', motivo: 'Retiro' }); c['enviar']();
    const r = http.expectOne(url); const anterior = r.request.body.uuidCliente;
    r.flush({ mensaje: 'Stock insuficiente' }, { status: 400, statusText: 'Bad Request' });
    c['form'].controls.cantidad.setValue(1); c['enviar']();
    const nuevo = http.expectOne(url); expect(nuevo.request.body.uuidCliente).not.toBe(anterior);
    expect(nuevo.request.body.cantidad).toBe(1); nuevo.flush({ id: 's' }); http.verify();
  });
  it('recupera la misma operación al reabrir el diálogo tras una respuesta incierta', () => {
    const { c, http } = crear();
    c['form'].setValue({ lote: '', cantidad: 2, tipo: 'DETERIORO', motivo: 'Rotura' });
    c['enviar']();
    const primera = http.expectOne(url);
    const original = primera.request.body;
    primera.flush({}, { status: 503, statusText: 'Unavailable' });
    const reabierto = TestBed.createComponent(SalidaInventarioDialog);
    reabierto.detectChanges();
    expect(reabierto.componentInstance['form'].getRawValue().cantidad).toBe(2);
    reabierto.componentInstance['enviar']();
    const segunda = http.expectOne(url);
    expect(segunda.request.body).toEqual(original);
    segunda.flush({ id: 'salida', movimientoId: 'movimiento' });
    expect(sessionStorage.length).toBe(0);
    http.verify();
  });

});
