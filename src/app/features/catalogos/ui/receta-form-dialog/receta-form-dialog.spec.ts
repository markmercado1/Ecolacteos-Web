import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { InsumoResponse } from '../../data-access/insumo.models';
import { ProductoResponse } from '../../data-access/producto.models';
import { RecetaResponse } from '../../data-access/receta.models';
import { RecetaFormDialog, RecetaFormDialogData } from './receta-form-dialog';

const base = environment.apiBaseUrl;

const andino: ProductoResponse = {
  id: 'p1', nombre: 'Queso Andino', familiaId: 'f1', familiaNombre: 'Queso', rendimientoEsperadoPct: null,
  cicloCapital: null, activo: true,
  presentaciones: [
    { id: 'pr1', productoId: 'p1', nombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza', activo: true },
    { id: 'pr2', productoId: 'p1', nombre: 'Vieja', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza', activo: false }
  ]
};
const insumos: InsumoResponse[] = [
  { id: 'i1', nombre: 'Cuajo', unidadMedida: 'g', activo: true, stock: 15 },
  { id: 'i2', nombre: 'Sal', unidadMedida: 'kg', activo: true, stock: 20 }
];

function setup(data: RecetaFormDialogData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close } }
    ]
  });
  const f = TestBed.createComponent(RecetaFormDialog);
  f.detectChanges();
  return { f, c: f.componentInstance, http: TestBed.inject(HttpTestingController), close };
}

describe('RecetaFormDialog', () => {
  it('crea una receta con insumos existentes y envía el request exacto del contrato', () => {
    const { c, http, close } = setup({ productos: [andino], insumos });
    c['form'].patchValue({ nombre: ' Receta estándar ', productoId: 'p1' });
    c['form'].patchValue({ presentacionId: 'pr1', litrosBase: 100, rendimientoBase: 1 });
    c['agregarInsumo']();
    c['insumosForm'].at(0).setValue({ insumoId: 'i1', cantidad: 1 });
    c['agregarInsumo']();
    c['insumosForm'].at(1).setValue({ insumoId: 'i2', cantidad: 1 });

    c['enviar']();
    const req = http.expectOne(`${base}/recetas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      nombre: 'Receta estándar', productoId: 'p1', presentacionId: 'pr1', litrosBase: 100, rendimientoBase: 1,
      insumos: [{ insumoId: 'i1', cantidad: 1 }, { insumoId: 'i2', cantidad: 1 }]
    });
    req.flush({ id: 'r1' });
    expect(close).toHaveBeenCalledWith({ id: 'r1' });
  });

  it('solo ofrece presentaciones activas del producto elegido y no repite insumos entre filas', () => {
    const { c } = setup({ productos: [andino], insumos });
    c['form'].controls.productoId.setValue('p1');
    expect(c['presentaciones']().map((p) => p.id)).toEqual(['pr1']);
    c['agregarInsumo']();
    c['insumosForm'].at(0).setValue({ insumoId: 'i1', cantidad: 1 });
    c['agregarInsumo']();
    expect(c['opcionesInsumo'](1).map((i) => i.id)).toEqual(['i2']);
    c['insumosForm'].at(1).setValue({ insumoId: 'i2', cantidad: 1 });
    expect(c['puedeAgregarInsumo']()).toBe(false);
  });

  it('no envía una receta inválida (litros base 0, cantidad de insumo 0)', () => {
    const { c, http } = setup({ productos: [andino], insumos });
    c['form'].patchValue({ nombre: 'R', productoId: 'p1' });
    c['form'].patchValue({ presentacionId: 'pr1', litrosBase: 0, rendimientoBase: 1 });
    c['enviar']();
    http.expectNone(`${base}/recetas`);

    c['form'].controls.litrosBase.setValue(100);
    c['agregarInsumo']();
    c['insumosForm'].at(0).setValue({ insumoId: 'i1', cantidad: 0 });
    c['enviar']();
    http.expectNone(`${base}/recetas`);
    expect(c['errorServidor']()).toContain('Revisa');
  });

  it('al editar, producto y presentación quedan fijos y se envían los originales con PUT', () => {
    const existente: RecetaResponse = {
      id: 'r1', nombre: 'Receta estándar', productoId: 'p1', productoNombre: 'Queso Andino', presentacionId: 'pr1',
      presentacionNombre: 'Pieza', unidadConteo: 'pieza', litrosBase: 100, rendimientoBase: 1, activo: true,
      insumos: [{ insumoId: 'i1', insumoNombre: 'Cuajo', unidadMedida: 'g', cantidad: 1, insumoActivo: true }]
    };
    const { c, http } = setup({ receta: existente, productos: [andino], insumos });
    expect(c['form'].controls.productoId.disabled).toBe(true);
    expect(c['form'].controls.presentacionId.disabled).toBe(true);
    c['form'].controls.litrosBase.setValue(50);

    c['enviar']();
    const req = http.expectOne(`${base}/recetas/r1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(expect.objectContaining({ productoId: 'p1', presentacionId: 'pr1', litrosBase: 50 }));
    expect(req.request.body.insumos).toEqual([{ insumoId: 'i1', cantidad: 1 }]);
  });

  it('muestra el mensaje del servidor si rechaza la receta', () => {
    const { c, http } = setup({ productos: [andino], insumos });
    c['form'].patchValue({ nombre: 'R', productoId: 'p1' });
    c['form'].patchValue({ presentacionId: 'pr1', litrosBase: 100, rendimientoBase: 1 });
    c['enviar']();
    http.expectOne(`${base}/recetas`).flush({ mensaje: 'Ya existe una receta' }, { status: 409, statusText: 'Conflict' });
    expect(c['errorServidor']()).toBe('Ya existe una receta');
  });
});
