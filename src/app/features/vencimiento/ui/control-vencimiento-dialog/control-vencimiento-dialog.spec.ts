import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { ControlVencimientoDialog, ControlVencimientoDialogData } from './control-vencimiento-dialog';

const base = environment.apiBaseUrl;
const urlLista = `${base}/control-vencimiento/productos`;
const urlControl = `${base}/admin/productos/prod-1/control-vencimiento`;

function abrir(idsConControl: string[]) {
  const cerrar = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DialogRef, useValue: { close: cerrar } },
      { provide: DIALOG_DATA, useValue: { productoId: 'prod-1', productoNombre: 'Yogurt de fresa' } satisfies ControlVencimientoDialogData }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(ControlVencimientoDialog);
  fixture.detectChanges();
  http.expectOne(urlLista).flush({ productoIds: idsConControl });
  fixture.detectChanges();
  return { fixture, http, cerrar, dialog: fixture.componentInstance };
}

describe('ControlVencimientoDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('refleja el estado: sin control cuando el producto no está en la lista', () => {
    const { fixture, dialog } = abrir(['otro']);
    expect(dialog['controla']()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No controla vencimiento');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Activar control');
  });

  it('refleja el estado: con control cuando el producto está en la lista', () => {
    const { fixture, dialog } = abrir(['prod-1']);
    expect(dialog['controla']()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Desactivar control');
  });

  it('activar exige confirmar y advierte que lo existente queda sin trazabilidad (no vendible)', () => {
    const { fixture, http, dialog, cerrar } = abrir([]);
    dialog['confirmando'].set(true);
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('sin trazabilidad');
    expect(texto).toContain('no se podrán vender');
    http.expectNone(urlControl);

    dialog['aplicar']();
    const req = http.expectOne(urlControl);
    expect(req.request.method).toBe('PUT');
    req.flush({ productoId: 'prod-1', controlaVencimiento: true, presentaciones: [] });
    fixture.detectChanges();

    expect(dialog['controla']()).toBe(true);
    dialog['cerrar']();
    expect(cerrar).toHaveBeenCalledWith(true);
  });

  it('desactivar usa DELETE', () => {
    const { http, dialog } = abrir(['prod-1']);
    dialog['aplicar']();
    const req = http.expectOne(urlControl);
    expect(req.request.method).toBe('DELETE');
    req.flush({ productoId: 'prod-1', controlaVencimiento: false, presentaciones: [] });
    expect(dialog['controla']()).toBe(false);
  });

  it('si la activación está deshabilitada en el entorno (409) muestra el mensaje y no cambia el estado', () => {
    const { fixture, http, dialog, cerrar } = abrir([]);
    dialog['confirmando'].set(true);
    dialog['aplicar']();
    http.expectOne(urlControl).flush(
      { mensaje: 'La activación del control de vencimiento está deshabilitada en este entorno.' },
      { status: 409, statusText: 'Conflict' }
    );
    fixture.detectChanges();

    expect(dialog['controla']()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('deshabilitada en este entorno');
    dialog['cerrar']();
    expect(cerrar).toHaveBeenCalledWith(false);
  });

  it('un error al consultar el estado se muestra y permite reintentar', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DialogRef, useValue: { close: vi.fn() } },
        { provide: DIALOG_DATA, useValue: { productoId: 'prod-1', productoNombre: 'Yogurt' } }
      ]
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ControlVencimientoDialog);
    fixture.detectChanges();
    http.expectOne(urlLista).flush({ mensaje: 'caído' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(fixture.componentInstance['errorCarga']()).not.toBeNull();

    fixture.componentInstance['cargar']();
    http.expectOne(urlLista).flush({ productoIds: [] });
  });
});
