import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { JornadaDetalleDialog } from './jornada-detalle-dialog';
import { JornadaDetalle } from '../../../acopios/acopios.api';

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


describe('Recepción de jornada', () => {
  function iniciar(estado = 'REGRESANDO_A_PLANTA') {
    const http = setup(true);
    const f = TestBed.createComponent(JornadaDetalleDialog);
    http.expectOne(`${base}/jornadas/j1`).flush({ id: 'j1', unidadId: 'u1', estado, litrosEsperados: 100, acopios: [], proveedoresVisitados: [] });
    f.componentInstance['form'].setValue({ litrosReales: 98, horaLlegada: '2026-10-21T10:30', observacion: 'Medido', turno: 'UNICO' }, { emitEvent: false });
    http.expectOne(r => r.url === `${base}/recepcion-planta`).flush({ contenido: [], totalPaginas: 0 });
    f.detectChanges();
    return { http, f, c: f.componentInstance, ref: TestBed.inject(DialogRef) };
  }

  it('consulta todas las páginas y envía el turno seleccionado aunque tenga marca', () => {
    const { http, c, f } = iniciar();
    c['form'].controls.horaLlegada.setValue('2026-10-22T09:00');
    const req = http.expectOne(r => r.url === `${base}/recepcion-planta`);
    expect(req.request.params.get('fecha')).toBe('2026-10-22');
    expect(req.request.params.get('unidadId')).toBe('u1');
    req.flush({ contenido: [{ turno: 'MAÑANA' }], totalPaginas: 2 });
    const segunda = http.expectOne(r => r.url === `${base}/recepcion-planta`);
    expect(segunda.request.params.get('page')).toBe('1');
    segunda.flush({ contenido: [{ turno: 'TARDE' }], totalPaginas: 2 });
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('.realizado').length).toBe(2);
    expect(f.nativeElement.textContent).toContain('Ya recepcionado');
    c['form'].controls.turno.setValue('MAÑANA');
    c['recibir']();
    const envio = http.expectOne(`${base}/sync/recepciones-jornada`);
    expect(envio.request.body[0].turno).toBe('MAÑANA');
    envio.flush({ confirmados: [], errores: [] });
    http.verify();
  });

  it('cancela consultas anteriores y no conserva marcas al cambiar de fecha o fallar', () => {
    const { http, c, f } = iniciar();
    c['consultarTurnos']();
    const anterior = http.expectOne(r => r.url === `${base}/recepcion-planta`);
    c['form'].controls.horaLlegada.setValue('2026-10-23T09:00');
    expect(anterior.cancelled).toBe(true);
    http.expectOne(r => r.url === `${base}/recepcion-planta`).flush({ contenido: [{ turno: 'UNICO' }], totalPaginas: 1 });
    expect(c['turnosRegistrados']()).toEqual(['UNICO']);
    c['form'].controls.horaLlegada.setValue('2026-10-24T09:00');
    expect(c['turnosRegistrados']()).toEqual([]);
    http.expectOne(r => r.url === `${base}/recepcion-planta`).flush({}, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No se pudo comprobar');
    expect(c['turnosRegistrados']()).toEqual([]);
    http.verify();
  });

  it('envía el contrato exacto y cierra solo cuando se confirma el UUID enviado', () => {
    const { http, c, ref } = iniciar();
    c['recibir']();
    const req = http.expectOne(`${base}/sync/recepciones-jornada`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body[0];
    expect(body).toEqual({ uuidCliente: expect.any(String), jornadaId: 'j1', litrosReales: 98, horaLlegada: '2026-10-21T10:30:00', observacion: 'Medido', turno: 'UNICO' });
    req.flush({ confirmados: [body.uuidCliente], errores: [] });
    expect(ref.close).toHaveBeenCalledWith(true);
    http.verify();
  });

  it('evita doble envío y conserva UUID y datos tras respuesta perdida', () => {
    const { http, c, ref } = iniciar();
    c['recibir'](); c['recibir']();
    const req = http.expectOne(`${base}/sync/recepciones-jornada`);
    const original = req.request.body;
    req.error(new ProgressEvent('error'));
    c['form'].controls.litrosReales.setValue(200);
    c['recibir']();
    const retry = http.expectOne(`${base}/sync/recepciones-jornada`);
    expect(retry.request.body).toEqual(original);
    retry.flush({ confirmados: [original[0].uuidCliente], errores: [] });
    expect(ref.close).toHaveBeenCalledWith(true);
    http.verify();
  });

  it('un HTTP 200 con rechazo individual no se anuncia como éxito', () => {
    const { http, c, ref } = iniciar();
    c['recibir']();
    const req = http.expectOne(`${base}/sync/recepciones-jornada`);
    req.flush({ confirmados: [], errores: [{ uuidCliente: req.request.body[0].uuidCliente, motivo: 'La jornada ya tiene una recepción' }] });
    expect(ref.close).not.toHaveBeenCalled();
    expect(c['errorRecepcion']()).toContain('ya tiene');
    http.verify();
  });

  it('una respuesta sin confirmación propia conserva la operación para reintentar', () => {
    const { http, c, ref } = iniciar();
    c['recibir']();
    http.expectOne(`${base}/sync/recepciones-jornada`).flush({ confirmados: ['otro'], errores: [] });
    expect(ref.close).not.toHaveBeenCalled();
    expect(c['intento']).not.toBeNull();
    http.verify();
  });

  it('bloquea litros negativos y permite cero conforme al backend', () => {
    const { http, c } = iniciar();
    c['form'].controls.litrosReales.setValue(-1);
    c['recibir']();
    http.expectNone(`${base}/sync/recepciones-jornada`);
    c['form'].controls.litrosReales.setValue(0);
    c['recibir']();
    const req = http.expectOne(`${base}/sync/recepciones-jornada`);
    expect(req.request.body[0].litrosReales).toBe(0);
    req.flush({ confirmados: [], errores: [] });
    http.verify();
  });

  it('no recibe una jornada cuyo estado cambió al abrirla', () => {
    const { http, c, f } = iniciar('RECIBIDA');
    c['recibir']();
    expect(f.nativeElement.textContent).toContain('ya no se puede recibir');
    http.expectNone(`${base}/sync/recepciones-jornada`);
    http.verify();
  });
});
