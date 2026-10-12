import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { InsumoFormDialog, InsumoFormDialogData } from './insumo-form-dialog';

const base = `${environment.apiBaseUrl}/admin/insumos`;

function crear(data: InsumoFormDialogData) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const f = TestBed.createComponent(InsumoFormDialog);
  f.detectChanges();
  return { f, c: f.componentInstance, http: TestBed.inject(HttpTestingController) };
}

describe('InsumoFormDialog (V19, kardex)', () => {
  it('al crear, el stock indicado se envía como stock inicial', () => {
    const { c, http } = crear({});
    c['form'].setValue({ nombre: 'Cuajo', unidadMedida: 'g', stock: 15 });
    c.enviar();
    expect(http.expectOne(base).request.body).toEqual({ nombre: 'Cuajo', unidadMedida: 'g', stock: 15 });
  });

  it('al editar, el stock es de solo lectura y NUNCA se envía (cambia solo por movimientos del kardex)', () => {
    const { f, c, http } = crear({ insumo: { id: 'i1', nombre: 'Sal', unidadMedida: 'kg', activo: true, stock: 6 } });
    expect(f.nativeElement.querySelector('#stock')).toBeNull();
    expect(f.nativeElement.textContent).toContain('Inventario → Insumos');
    c['form'].controls.nombre.setValue('Sal fina');
    c.enviar();
    const req = http.expectOne(`${base}/i1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nombre: 'Sal fina', unidadMedida: 'kg' });
  });
});
