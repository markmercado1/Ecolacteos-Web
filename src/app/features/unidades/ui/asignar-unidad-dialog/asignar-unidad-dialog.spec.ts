import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { UnidadResponse } from '../../data-access/unidad.models';
import { AsignarUnidadDialog, AsignarUnidadDialogData } from './asignar-unidad-dialog';

const base = environment.apiBaseUrl;

const unidades: UnidadResponse[] = [
  { id: 'un-1', placa: 'ABC-123', capacidadTon: 5, zonaId: null, responsableId: 'u-9', responsableNombre: 'Otro Acopiador' },
  { id: 'un-2', placa: 'XYZ-999', capacidadTon: null, zonaId: null, responsableId: 'u-9', responsableNombre: 'Otro Acopiador' }
];

function crear(data: AsignarUnidadDialogData) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(AsignarUnidadDialog);
  return { dialog: fixture.componentInstance, fixture, http };
}

describe('AsignarUnidadDialog', () => {
  it('por defecto asume que la unidad es existente cuando hay flota para elegir', () => {
    const { dialog } = crear({ unidades, responsableId: 'u-1', responsableNombre: 'Jorge Palomino' });
    expect(dialog['esNueva']()).toBe(false);
  });

  it('si la flota está vacía, no tiene sentido "existente": arranca en modo "es nueva"', () => {
    const { dialog } = crear({ unidades: [], responsableId: 'u-1', responsableNombre: 'Jorge Palomino' });
    expect(dialog['esNueva']()).toBe(true);
  });

  it('en modo "existente", no deja continuar sin seleccionar una unidad', () => {
    const { dialog } = crear({ unidades, responsableId: 'u-1', responsableNombre: 'Jorge Palomino' });
    expect(dialog['puedeContinuar']()).toBe(false);
    dialog['form'].controls.unidadId.setValue('un-1');
    expect(dialog['puedeContinuar']()).toBe(true);
  });

  it('al confirmar una unidad existente, hace PUT reasignando el responsable y cierra con { tipo: "reasignada" }', () => {
    const { dialog, http } = crear({ unidades, responsableId: 'u-1', responsableNombre: 'Jorge Palomino' });
    const cerrarSpy = TestBed.inject(DialogRef).close as unknown as ReturnType<typeof vi.fn>;
    dialog['form'].controls.unidadId.setValue('un-1');

    dialog['continuar']();

    const req = http.expectOne(`${base}/admin/unidades/un-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ placa: 'ABC-123', capacidadTon: 5, zonaId: null, responsableId: 'u-1' });
    const actualizada = { ...unidades[0], responsableId: 'u-1', responsableNombre: 'Jorge Palomino' };
    req.flush(actualizada);

    expect(cerrarSpy).toHaveBeenCalledWith({ tipo: 'reasignada', unidad: actualizada });
    http.verify();
  });

  it('al elegir "es una unidad nueva" y continuar, cierra con { tipo: "crear-nueva" } sin llamar a la API', () => {
    const { dialog, http } = crear({ unidades, responsableId: 'u-1', responsableNombre: 'Jorge Palomino' });
    const cerrarSpy = TestBed.inject(DialogRef).close as unknown as ReturnType<typeof vi.fn>;
    dialog['form'].controls.esNueva.setValue(true);

    dialog['continuar']();

    expect(cerrarSpy).toHaveBeenCalledWith({ tipo: 'crear-nueva' });
    http.verify();
  });

  // Regresión real (reportada en vivo): `unidadSeleccionada` estaba implementado como `computed()`
  // leyendo `FormControl.value` directamente -- eso NO es una señal, así que el computed nunca se
  // volvía a evaluar después de su primera lectura. En la app real esa primera lectura ocurre al
  // renderizar la plantilla (con unidadId todavía vacío), así que quedaba pegado en `undefined` para
  // siempre y "continuar()" no hacía nada al confirmar. Los tests de arriba no lo detectaban porque
  // nunca llamaban a `fixture.detectChanges()` antes de fijar el valor -- este sí, para reproducir
  // exactamente la secuencia real (render primero, seleccionar después).
  it('tras renderizar la plantilla (como en la app real), seleccionar una unidad y confirmar SÍ hace el PUT', () => {
    const { dialog, fixture, http } = crear({ unidades, responsableId: 'u-1', responsableNombre: 'Jorge Palomino' });
    fixture.detectChanges(); // primer render: unidadSeleccionada() se lee con unidadId todavía vacío
    const cerrarSpy = TestBed.inject(DialogRef).close as unknown as ReturnType<typeof vi.fn>;

    dialog['form'].controls.unidadId.setValue('un-1');
    fixture.detectChanges(); // re-render tras seleccionar, como haría el usuario en el combo

    expect(dialog['unidadSeleccionada']()?.placa).toBe('ABC-123');

    dialog['continuar']();

    const req = http.expectOne(`${base}/admin/unidades/un-1`);
    req.flush({ ...unidades[0], responsableId: 'u-1', responsableNombre: 'Jorge Palomino' });
    expect(cerrarSpy).toHaveBeenCalled();
    http.verify();
  });

  it('un error del servidor al reasignar se muestra y no cierra el diálogo', () => {
    const { dialog, http } = crear({ unidades, responsableId: 'u-1', responsableNombre: 'Jorge Palomino' });
    const cerrarSpy = TestBed.inject(DialogRef).close as unknown as ReturnType<typeof vi.fn>;
    dialog['form'].controls.unidadId.setValue('un-1');

    dialog['continuar']();
    http.expectOne(`${base}/admin/unidades/un-1`).flush({ mensaje: 'Conflicto' }, { status: 409, statusText: 'Conflict' });

    expect(dialog['errorServidor']()).toBe('Conflicto');
    expect(cerrarSpy).not.toHaveBeenCalled();
  });
});
