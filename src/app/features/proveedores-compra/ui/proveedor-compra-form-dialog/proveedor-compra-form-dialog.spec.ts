import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { ProveedorCompraFormDialog, ProveedorCompraFormDialogData, rucDe } from './proveedor-compra-form-dialog';

const base = `${environment.apiBaseUrl}/proveedores-compra`;
const categorias = [
  { id: 'c1', codigo: 'LECHE', nombre: 'Leche' },
  { id: 'c2', codigo: 'OTROS_INSUMOS', nombre: 'Otros insumos' }
];
const existente = {
  id: 'p1', nombre: 'Lacteos del Sur', ruc: '20600000013', telefono: null, contacto: null, activo: true,
  categorias: [categorias[0]], insumosHabituales: [{ id: 'i1', nombre: 'Azúcar', unidadMedida: 'kg' }]
};

function crear(data: ProveedorCompraFormDialogData, insumos: unknown[] | null = [{ id: 'i1', nombre: 'Azúcar', unidadMedida: 'kg', activo: true }]) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DialogRef, useValue: { close } }, { provide: DIALOG_DATA, useValue: data }]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(ProveedorCompraFormDialog);
  f.detectChanges();
  http.expectOne(`${base}/categorias`).flush(categorias);
  const req = http.expectOne(`${environment.apiBaseUrl}/admin/insumos`);
  if (insumos) req.flush(insumos); else req.flush({}, { status: 403, statusText: 'Forbidden' });
  f.detectChanges();
  return { f, c: f.componentInstance as any, http, close };
}

it('rucDe quita espacios, guiones y puntos', () => {
  expect(rucDe(' 2060-0000.013 ')).toBe('20600000013');
});

describe('ProveedorCompraFormDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('alta: nombre y RUC; por defecto queda en «Otros insumos»; el RUC se envía limpio', () => {
    const { c, http, close } = crear({});
    expect(c['seleccion']().has('OTROS_INSUMOS')).toBe(true);
    c['form'].patchValue({ nombre: ' Nuevo SAC ', ruc: '2060 0000-013' });
    c['enviar']();
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nombre: 'Nuevo SAC', ruc: '20600000013', telefono: null, contacto: null, categorias: ['OTROS_INSUMOS'], insumosHabituales: [] });
    req.flush({ ...existente, id: 'p2' });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }));
  });

  it('no envía con un RUC que no tiene 11 dígitos ni sin categoría', () => {
    const { c, http } = crear({});
    c['form'].patchValue({ nombre: 'X', ruc: '12345' });
    c['enviar']();
    c['form'].patchValue({ ruc: '20600000013' });
    c['alternar']('OTROS_INSUMOS');
    c['enviar']();
    http.expectNone(base);
  });

  it('una categoría se marca con un clic y un proveedor puede estar en las dos', () => {
    const { f, c } = crear({ proveedor: existente });
    expect([...c['seleccion']()]).toEqual(['LECHE']);
    c['alternar']('OTROS_INSUMOS');
    f.detectChanges();
    expect([...c['seleccion']()].sort()).toEqual(['LECHE', 'OTROS_INSUMOS']);
    expect(f.nativeElement.querySelectorAll('.chip.marcado').length).toBeGreaterThanOrEqual(2);
  });

  it('edición: PUT con las categorías y los insumos habituales marcados', () => {
    const { c, http } = crear({ proveedor: existente });
    c['alternarInsumo']('i1');
    c['enviar']();
    const req = http.expectOne(`${base}/p1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.insumosHabituales).toEqual([]);
    expect(req.request.body.categorias).toEqual(['LECHE']);
    req.flush(existente);
  });

  it('si no se puede leer el catálogo de insumos, editar nunca borra los habituales (se envía null)', () => {
    const { c, http } = crear({ proveedor: existente }, null);
    c['enviar']();
    expect(http.expectOne(`${base}/p1`).request.body.insumosHabituales).toBeNull();
  });

  it('muestra el mensaje del servidor (p. ej. RUC repetido)', () => {
    const { f, c, http } = crear({});
    c['form'].patchValue({ nombre: 'X', ruc: '20600000013' });
    c['enviar']();
    http.expectOne(base).flush({ mensaje: 'Ya existe un proveedor con ese RUC: «Lacteos del Sur».' }, { status: 409, statusText: 'Conflict' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Ya existe un proveedor con ese RUC');
  });
});
