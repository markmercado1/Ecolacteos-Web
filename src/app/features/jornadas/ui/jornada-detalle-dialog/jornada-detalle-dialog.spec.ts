import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { Subject } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { JornadaDetalleDialog } from './jornada-detalle-dialog';
import { JornadaDetalle } from '../../../acopios/acopios.api';
import { RecepcionJornadaForm } from '../recepcion-jornada-form/recepcion-jornada-form';

const base = environment.apiBaseUrl;

function setup(recepcionar = false) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { id: 'j1', recepcionar } },
      { provide: DialogRef, useValue: { close: vi.fn() } },
    ],
  });
  return TestBed.inject(HttpTestingController);
}

describe('JornadaDetalleDialog', () => {
  it('muestra acopiador, vehículo, horas, proveedores visitados, acopios y litros esperados', () => {
    const http = setup();
    const f = TestBed.createComponent(JornadaDetalleDialog);
    const jornada: JornadaDetalle = {
      id: 'j1',
      uuidCliente: 'movil1',
      estado: 'REGRESANDO_A_PLANTA',
      unidadId: 'u1',
      unidadPlaca: 'ABC-123',
      acopiadorId: 'ac1',
      acopiadorNombre: 'Acopiador Uno',
      horaInicio: '2026-09-17T06:00:00',
      horaFin: '2026-09-17T09:30:00',
      litrosEsperados: 42.5,
      proveedoresVisitados: ['Productor Uno', 'Productor Dos'],
      acopios: [
        { registroAcopioId: 'r1', proveedorId: 'p1', proveedorNombre: 'Productor Uno', fechaHora: '2026-09-17T06:30:00', litros: 20 },
        { registroAcopioId: 'r2', proveedorId: 'p2', proveedorNombre: 'Productor Dos', fechaHora: '2026-09-17T07:00:00', litros: 22.5 },
      ],
    };
    http.expectOne(`${base}/jornadas/j1`).flush(jornada);
    f.detectChanges();
    const texto = f.nativeElement.textContent;
    expect(texto).toContain('Acopiador Uno');
    expect(texto).toContain('ABC-123');
    expect(texto).toContain('Productor Uno');
    expect(texto).toContain('Productor Dos');
    expect(texto).toContain('42.5');
    expect(f.nativeElement.querySelectorAll('.tabla-acopios tbody tr').length).toBe(2);
    http.verify();
  });

  it('conserva el error en vez de mostrar un detalle vacío', () => {
    const http = setup();
    const f = TestBed.createComponent(JornadaDetalleDialog);
    http.expectOne(`${base}/jornadas/j1`).flush({}, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    expect(f.componentInstance['error']()?.status).toBe(404);
    http.verify();
  });
});


describe('JornadaDetalleDialog · recepción', () => {
  const jornadaDetalle = (estado: string) => ({
    id: 'j1',
    unidadId: 'u1',
    estado,
    litrosEsperados: 100,
    acopios: [],
    proveedoresVisitados: [],
  });

  function abrir(estado = 'REGRESANDO_A_PLANTA') {
    const confirmacion = new Subject<boolean>();
    const abrirConfirmacion = vi.fn(() => ({ closed: confirmacion.asObservable() }));
    const cerrar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: { id: 'j1', recepcionar: true } },
        { provide: DialogRef, useValue: { close: cerrar } },
        { provide: Dialog, useValue: { open: abrirConfirmacion } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(JornadaDetalleDialog);
    http.expectOne(`${base}/jornadas/j1`).flush(jornadaDetalle(estado));
    fixture.detectChanges();
    if (estado === 'REGRESANDO_A_PLANTA') {
      http.expectOne((r) => r.url === `${base}/recepcion-planta`).flush({ contenido: [], totalPaginas: 0 });
    }
    return { http, fixture, cerrar, abrirConfirmacion, confirmacion };
  }

  const formulario = (fixture: ComponentFixture<JornadaDetalleDialog>): RecepcionJornadaForm =>
    fixture.debugElement.query(By.directive(RecepcionJornadaForm)).componentInstance;

  it('muestra el formulario de recepción solo si la jornada está en REGRESANDO_A_PLANTA', () => {
    const { fixture, http } = abrir();
    expect(fixture.nativeElement.textContent).toContain('Recepcionar jornada');
    expect(fixture.nativeElement.querySelector('app-recepcion-jornada-form')).not.toBeNull();
    http.verify();
  });

  it('no ofrece recibir una jornada cuyo estado cambió', () => {
    const { fixture, http } = abrir('RECIBIDA');
    expect(fixture.nativeElement.querySelector('app-recepcion-jornada-form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('ya no se puede recibir');
    http.verify();
  });

  it('se cierra con true cuando el servidor confirma la recepción', () => {
    const { fixture, cerrar } = abrir();
    formulario(fixture).recibida.emit();
    expect(cerrar).toHaveBeenCalledWith(true);
  });

  it('cierra sin preguntar si no hay nada escrito', () => {
    const { fixture, cerrar, abrirConfirmacion } = abrir();
    fixture.componentInstance['cerrar']();
    expect(abrirConfirmacion).not.toHaveBeenCalled();
    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it('con datos escritos pide confirmación con ConfirmDialog y solo cierra si se acepta', () => {
    const { fixture, cerrar, abrirConfirmacion, confirmacion } = abrir();
    formulario(fixture)['form'].markAsDirty();

    fixture.componentInstance['cerrar']();
    expect(abrirConfirmacion).toHaveBeenCalledTimes(1);
    expect(cerrar).not.toHaveBeenCalled();

    confirmacion.next(false);
    expect(cerrar).not.toHaveBeenCalled();

    confirmacion.next(true);
    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it('no deja cerrar mientras se confirma la recepción', () => {
    const { fixture, http, cerrar, abrirConfirmacion } = abrir();
    const form = formulario(fixture);
    form['form'].patchValue({ litrosReales: 98 });
    form['recibir']();
    http.expectOne(`${base}/sync/recepciones-jornada`);

    fixture.componentInstance['cerrar']();

    expect(abrirConfirmacion).not.toHaveBeenCalled();
    expect(cerrar).not.toHaveBeenCalled();
  });
});
