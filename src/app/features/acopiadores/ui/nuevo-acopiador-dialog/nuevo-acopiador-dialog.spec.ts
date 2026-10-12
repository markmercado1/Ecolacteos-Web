import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { NuevoAcopiadorDialog } from './nuevo-acopiador-dialog';
describe('Alta de acopiador y asignación', () => {
  it('asigna una unidad ya existente y conserva el usuario si falla el PUT', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(NuevoAcopiadorDialog);
    const c = f.componentInstance;
    c['usuarioCreado'].set({
      id: 'nuevo',
      nombre: 'Nuevo',
      email: 'test@example.com',
      rolNombre: 'ACOPIADOR',
      activo: true,
    });
    c['unidades'].set([
      {
        id: 'u1',
        placa: 'ABC-123',
        capacidadTon: 5,
        zonaId: 'z1',
        responsableId: 'viejo',
        responsableNombre: 'Viejo',
      },
    ]);
    c['formUnidad'].setValue({ unidadId: 'u1' });
    c.asignarUnidad();
    const req = http.expectOne(`${environment.apiBaseUrl}/admin/unidades/u1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      placa: 'ABC-123',
      capacidadTon: 5,
      zonaId: 'z1',
      responsableId: 'nuevo',
    });
    req.flush({}, { status: 409, statusText: 'Conflict' });
    expect(c['usuarioCreado']()?.id).toBe('nuevo');
    expect(c['enviandoUnidad']()).toBe(false);
    http.verify();
  });
});
