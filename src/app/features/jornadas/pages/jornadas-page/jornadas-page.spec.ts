import { Subject } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { JornadasPage } from './jornadas-page';
import { JornadaDetalleDialog } from '../../ui/jornada-detalle-dialog/jornada-detalle-dialog';
import { JornadaBandeja } from '../../data-access/jornada.models';
import { ToastService } from '../../../../shared/ui/toast/toast.service';

const base = environment.apiBaseUrl;

const jornada: JornadaBandeja = {
  id: 'j1',
  uuidCliente: 'movil1',
  estado: 'REGRESANDO_A_PLANTA',
  unidadId: 'u1',
  unidadPlaca: 'ABC-123',
  acopiadorId: 'ac1',
  acopiadorNombre: 'Acopiador Uno',
  horaInicio: '2026-09-17T06:00:00',
  horaFin: null,
  cantidadAcopios: 4,
  cantidadProveedores: 3,
  litrosEsperados: 120.5,
};

describe('JornadasPage', () => {
  it('carga la bandeja de jornadas regresando a planta', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(JornadasPage);
    http.expectOne(`${base}/jornadas`).flush([jornada]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Acopiador Uno');
    expect(f.nativeElement.textContent).toContain('ABC-123');
    http.verify();
  });

  it('busca por acopiador o vehículo sobre toda la bandeja y conserva el orden de llegada', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(JornadasPage);
    http.expectOne(`${base}/jornadas`).flush([
      { ...jornada, id: 'j1', acopiadorNombre: 'Zoila Quispe', unidadPlaca: 'AAA-111' },
      { ...jornada, id: 'j2', acopiadorNombre: 'Juan Pérez', unidadPlaca: 'BBB-222' },
      { ...jornada, id: 'j3', acopiadorNombre: 'María Núñez', unidadPlaca: 'CCC-333' }
    ]);
    const lista = f.componentInstance['lista'];
    expect(lista.filas().map((j: JornadaBandeja) => j.id)).toEqual(['j1', 'j2', 'j3']);
    lista.buscar('perez');
    expect(lista.filtradas().map((j: JornadaBandeja) => j.id)).toEqual(['j2']);
    lista.buscar('ccc');
    expect(lista.filtradas().map((j: JornadaBandeja) => j.id)).toEqual(['j3']);
    http.verify();
  });

  it('conserva el error 403 en vez de mostrar una bandeja vacía', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(JornadasPage);
    http.expectOne(`${base}/jornadas`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(f.componentInstance['error']()?.status).toBe(403);
    http.verify();
  });

  describe('"Recepcionar jornada"', () => {
    function abrirRecepcion() {
      TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
      const http = TestBed.inject(HttpTestingController);
      const f = TestBed.createComponent(JornadasPage);
      http.expectOne(`${base}/jornadas`).flush([jornada]);

      const cierre = new Subject<boolean | undefined>();
      const abrirSpy = vi.spyOn(TestBed.inject(Dialog), 'open').mockReturnValue({ closed: cierre.asObservable() } as never);
      const exito = vi.spyOn(TestBed.inject(ToastService), 'exito');
      f.componentInstance['recepcionar'](jornada);
      return { http, cierre, abrirSpy, exito };
    }

    it('abre el diálogo en modo recepción y, al confirmarse, avisa con un toast y recarga la bandeja', () => {
      const { http, cierre, abrirSpy, exito } = abrirRecepcion();
      expect(abrirSpy.mock.calls[0][0]).toBe(JornadaDetalleDialog);
      expect((abrirSpy.mock.calls[0][1] as { data: unknown }).data).toEqual({ id: 'j1', recepcionar: true });

      cierre.next(true);

      expect(exito).toHaveBeenCalledWith('Recepción de Acopiador Uno confirmada por el servidor.');
      http.expectOne(`${base}/jornadas`).flush([]);
      http.verify();
    });

    it('si se cierra sin confirmar no avisa de éxito, pero recarga por si la recepción llegó a registrarse', () => {
      const { http, cierre, exito } = abrirRecepcion();

      cierre.next(undefined);

      expect(exito).not.toHaveBeenCalled();
      http.expectOne(`${base}/jornadas`).flush([jornada]);
      http.verify();
    });
  });

  it('"Ver detalle" abre JornadaDetalleDialog con el id de la fila', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(JornadasPage);
    http.expectOne(`${base}/jornadas`).flush([jornada]);

    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    f.componentInstance['verDetalle'](jornada);

    expect(abrirSpy.mock.calls[0][0]).toBe(JornadaDetalleDialog);
    expect((abrirSpy.mock.calls[0][1] as { data: { id: string } }).data).toEqual({ id: 'j1' });
    http.verify();
  });
});
