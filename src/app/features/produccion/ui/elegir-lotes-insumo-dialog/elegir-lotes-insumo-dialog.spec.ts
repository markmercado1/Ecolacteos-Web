import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { ElegirLotesInsumoDialog } from './elegir-lotes-insumo-dialog';

const url = `${environment.apiBaseUrl}/lotes-produccion/lp1/plan-lotes`;
const plan = {
  loteProduccionId: 'lp1',
  insumos: [{
    insumoId: 'i1', insumoNombre: 'azucar', unidadMedida: 'kg', requerido: 10,
    propuesta: [{ loteId: 'a', codigo: 'AZU-A', fechaVencimiento: '2026-11-08', cantidad: 3 }, { loteId: 'b', codigo: 'AZU-B', fechaVencimiento: '2026-12-31', cantidad: 4 },
                { loteId: 'c', codigo: 'INICIAL', fechaVencimiento: null, cantidad: 3 }],
    disponibles: [
      { loteId: 'a', codigo: 'AZU-A', proveedorNombre: 'Andina', fechaVencimiento: '2026-11-08', disponible: 3 },
      { loteId: 'b', codigo: 'AZU-B', proveedorNombre: null, fechaVencimiento: '2026-12-31', disponible: 4 },
      { loteId: 'c', codigo: 'INICIAL', proveedorNombre: null, fechaVencimiento: null, disponible: 10 }
    ]
  }]
};

function crear() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DialogRef, useValue: { close } }, { provide: DIALOG_DATA, useValue: { loteProduccionId: 'lp1' } }]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(ElegirLotesInsumoDialog);
  f.detectChanges();
  http.expectOne(url).flush(plan);
  f.detectChanges();
  return { f, c: f.componentInstance as any, close };
}

describe('ElegirLotesInsumoDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('muestra la propuesta FEFO de cada insumo y, sin cambios, sigue con el reparto automático', () => {
    const { f, c, close } = crear();
    expect(f.nativeElement.textContent).toContain('necesita 10');
    expect(f.nativeElement.textContent).toContain('AZU-A');
    expect(f.nativeElement.textContent).toContain('Seguir con el reparto automático');
    c['aceptar']();
    expect(close).toHaveBeenCalledWith(null);          // null = automático
  });

  it('cambiar lotes parte de la propuesta y exige que la suma sea exactamente lo que pide el plan', () => {
    const { c, close } = crear();
    const i = plan.insumos[0];
    c['editar'](i);
    expect(c['suma'](i)).toBe(10);
    c['poner']('a', 0);
    expect(c['suma'](i)).toBe(7);
    expect(c['problema'](i)).toContain('suma debe ser exactamente');
    c['aceptar']();
    expect(close).not.toHaveBeenCalled();              // no deja aceptar una suma que no cuadra
    c['poner']('c', 6);
    expect(c['problema'](i)).toBeNull();
    c['aceptar']();
    expect(close).toHaveBeenCalledWith({ insumos: [{ insumoId: 'i1', lotes: [{ loteId: 'b', cantidad: 4 }, { loteId: 'c', cantidad: 6 }] }] });
  });

  it('no deja usar más de lo disponible de un lote, y volver a automático descarta el cambio', () => {
    const { c, close } = crear();
    const i = plan.insumos[0];
    c['editar'](i);
    c['poner']('a', 5);
    expect(c['problema'](i)).toContain('AZU-A solo tiene 3');
    c['volverAutomatico'](i);
    expect(c['problema'](i)).toBeNull();
    c['aceptar']();
    expect(close).toHaveBeenCalledWith(null);
  });
});
