import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { JornadaDetalle } from '../../../acopios/acopios.api';
import { RecepcionJornadaRequest, ResultadoRecepcionJornada } from '../../data-access/jornada.models';
import { RecepcionJornadaForm } from './recepcion-jornada-form';

const base = environment.apiBaseUrl;
const URL_ENVIO = `${base}/sync/recepciones-jornada`;
const URL_TURNOS = `${base}/recepcion-planta`;

function jornada(sobrescribir: Partial<JornadaDetalle> = {}): JornadaDetalle {
  return {
    id: 'j1',
    uuidCliente: 'movil1',
    estado: 'REGRESANDO_A_PLANTA',
    unidadId: 'u1',
    unidadPlaca: 'ABC-123',
    acopiadorId: 'ac1',
    acopiadorNombre: 'Acopiador Uno',
    horaInicio: '2026-10-21T06:00:00',
    horaFin: null,
    litrosEsperados: 100,
    proveedoresVisitados: [],
    acopios: [],
    ...sobrescribir,
  };
}

interface Contexto {
  http: HttpTestingController;
  fixture: ComponentFixture<RecepcionJornadaForm>;
  form: RecepcionJornadaForm;
  recibida: ReturnType<typeof vi.fn>;
}

/** Abre el formulario, responde la consulta inicial de turnos (vacía) y deja datos válidos escritos. */
function abrir(datos: Partial<JornadaDetalle> = {}): Contexto {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(RecepcionJornadaForm);
  fixture.componentRef.setInput('jornada', jornada(datos));
  const recibida = vi.fn();
  fixture.componentInstance.recibida.subscribe(recibida);
  fixture.detectChanges();

  http.expectOne((r) => r.url === URL_TURNOS).flush({ contenido: [], totalPaginas: 0 });
  fixture.componentInstance['form'].setValue(
    { litrosReales: 98, horaLlegada: '2026-10-21T10:30', observacion: 'Medido', turno: 'UNICO' },
    { emitEvent: false },
  );
  fixture.detectChanges();
  return { http, fixture, form: fixture.componentInstance, recibida };
}

function envio(http: HttpTestingController): { req: TestRequest; solicitud: RecepcionJornadaRequest } {
  const req = http.expectOne(URL_ENVIO);
  return { req, solicitud: (req.request.body as RecepcionJornadaRequest[])[0] };
}

const confirmada = (solicitud: RecepcionJornadaRequest): ResultadoRecepcionJornada => ({
  confirmados: [solicitud.uuidCliente],
  errores: [],
});

describe('RecepcionJornadaForm', () => {
  describe('turnos ya recepcionados (informativo)', () => {
    it('consulta todas las páginas y envía el turno elegido aunque tenga marca', () => {
      const { http, form, fixture } = abrir();
      form['form'].controls.horaLlegada.setValue('2026-10-22T09:00');
      const primera = http.expectOne((r) => r.url === URL_TURNOS);
      expect(primera.request.params.get('fecha')).toBe('2026-10-22');
      expect(primera.request.params.get('unidadId')).toBe('u1');
      primera.flush({ contenido: [{ turno: 'MAÑANA' }], totalPaginas: 2 });
      const segunda = http.expectOne((r) => r.url === URL_TURNOS);
      expect(segunda.request.params.get('page')).toBe('1');
      segunda.flush({ contenido: [{ turno: 'TARDE' }], totalPaginas: 2 });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.realizado').length).toBe(2);
      expect(fixture.nativeElement.textContent).toContain('Ya recepcionado');

      form['form'].controls.turno.setValue('MAÑANA');
      form['recibir']();
      expect(envio(http).solicitud.turno).toBe('MAÑANA');
    });

    it('cancela la consulta anterior al cambiar la fecha y no conserva marcas ante un fallo', () => {
      const { http, form, fixture } = abrir();
      form['consultarTurnos']();
      const anterior = http.expectOne((r) => r.url === URL_TURNOS);
      form['form'].controls.horaLlegada.setValue('2026-10-23T09:00');
      expect(anterior.cancelled).toBe(true);
      http.expectOne((r) => r.url === URL_TURNOS).flush({ contenido: [{ turno: 'UNICO' }], totalPaginas: 1 });
      expect(form['turnosRegistrados']()).toEqual(['UNICO']);

      form['form'].controls.horaLlegada.setValue('2026-10-24T09:00');
      expect(form['turnosRegistrados']()).toEqual([]);
      http.expectOne((r) => r.url === URL_TURNOS).flush({}, { status: 403, statusText: 'Forbidden' });
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('No se pudo comprobar');
      expect(form['turnosRegistrados']()).toEqual([]);
    });
  });

  describe('envío', () => {
    it('envía el contrato exacto en hora de Lima y emite «recibida» solo cuando se confirma su uuid', () => {
      const { http, form, recibida } = abrir();
      form['recibir']();

      const { req, solicitud } = envio(http);
      expect(req.request.method).toBe('POST');
      expect(solicitud).toEqual({
        uuidCliente: expect.any(String),
        jornadaId: 'j1',
        litrosReales: 98,
        horaLlegada: '2026-10-21T10:30:00',
        observacion: 'Medido',
        turno: 'UNICO',
      });
      expect(recibida).not.toHaveBeenCalled();

      req.flush(confirmada(solicitud));
      expect(recibida).toHaveBeenCalledTimes(1);
      http.verify();
    });

    it('envía la observación vacía como null', () => {
      const { http, form } = abrir();
      form['form'].controls.observacion.setValue('   ');
      form['recibir']();
      expect(envio(http).solicitud.observacion).toBeNull();
    });

    it('ignora un segundo envío mientras el primero está en curso', () => {
      const { http, form } = abrir();
      form['recibir']();
      form['recibir']();
      expect(form.enviando()).toBe(true);
      http.expectOne(URL_ENVIO);
      http.verify();
    });

    it('no envía una jornada que ya no está en REGRESANDO_A_PLANTA', () => {
      const { http, form } = abrir({ estado: 'RECIBIDA' });
      form['recibir']();
      http.expectNone(URL_ENVIO);
    });
  });

  describe('validaciones del formulario', () => {
    it('rechaza litros negativos o vacíos y acepta cero (el backend lo permite)', () => {
      const { http, form } = abrir();

      form['form'].controls.litrosReales.setValue(-1);
      form['recibir']();
      form['form'].controls.litrosReales.setValue(null);
      form['recibir']();
      http.expectNone(URL_ENVIO);

      form['form'].controls.litrosReales.setValue(0);
      form['recibir']();
      expect(envio(http).solicitud.litrosReales).toBe(0);
    });

    it('rechaza una fecha y hora de llegada incompleta', () => {
      const { http, form } = abrir();
      form['form'].controls.horaLlegada.setValue('');
      http.expectNone(URL_ENVIO);
      form['recibir']();
      http.expectNone(URL_ENVIO);
    });

    it('rechaza un turno que el backend no usa', () => {
      const { http, form } = abrir();
      form['form'].controls.turno.setValue('NOCHE');
      form['recibir']();
      http.expectNone(URL_ENVIO);
    });
  });

  describe('reintentos e idempotencia', () => {
    it('tras perder la respuesta bloquea el formulario y reintenta EXACTAMENTE la misma solicitud', () => {
      const { http, form, recibida } = abrir();
      form['recibir']();
      const primero = envio(http);
      primero.req.error(new ProgressEvent('error'));

      expect(form['intento']()).not.toBeNull();
      expect(form.haySinGuardar()).toBe(true);
      // El formulario queda deshabilitado: lo escrito no puede divergir de lo ya enviado.
      form['form'].controls.litrosReales.setValue(200);
      form['recibir']();

      const segundo = envio(http);
      expect(segundo.solicitud).toEqual(primero.solicitud);
      segundo.req.flush(confirmada(segundo.solicitud));
      expect(recibida).toHaveBeenCalledTimes(1);
    });

    it('un error 5xx también es incierto: conserva el uuid para el reintento', () => {
      const { http, form } = abrir();
      form['recibir']();
      const primero = envio(http);
      primero.req.flush({}, { status: 503, statusText: 'Service Unavailable' });

      form['recibir']();
      expect(envio(http).solicitud.uuidCliente).toBe(primero.solicitud.uuidCliente);
    });

    it('una respuesta 200 sin confirmación propia no se anuncia como éxito y conserva la operación', () => {
      const { http, form, recibida } = abrir();
      form['recibir']();
      const primero = envio(http);
      primero.req.flush({ confirmados: ['otro'], errores: [] });

      expect(recibida).not.toHaveBeenCalled();
      expect(form['errorRecepcion']()).toContain('no confirmó');
      form['recibir']();
      expect(envio(http).solicitud.uuidCliente).toBe(primero.solicitud.uuidCliente);
    });

    it('un HTTP 200 con rechazo individual no es éxito y libera el formulario con un uuid NUEVO para la corrección', () => {
      const { http, form, recibida } = abrir();
      form['recibir']();
      const primero = envio(http);
      primero.req.flush({
        confirmados: [],
        errores: [{ uuidCliente: primero.solicitud.uuidCliente, motivo: 'La jornada ya tiene una recepción' }],
      });

      expect(recibida).not.toHaveBeenCalled();
      expect(form['errorRecepcion']()).toContain('ya tiene');
      expect(form['intento']()).toBeNull();

      // La solicitud corregida es otra: no debe poder confundirse con la rechazada.
      form['form'].controls.litrosReales.setValue(99);
      form['recibir']();
      const corregida = envio(http);
      expect(corregida.solicitud.litrosReales).toBe(99);
      expect(corregida.solicitud.uuidCliente).not.toBe(primero.solicitud.uuidCliente);
    });

    it('un error 4xx definitivo también libera el formulario y estrena uuid', () => {
      const { http, form } = abrir();
      form['recibir']();
      const primero = envio(http);
      primero.req.flush({ mensaje: 'Datos inválidos' }, { status: 400, statusText: 'Bad Request' });

      expect(form['intento']()).toBeNull();
      expect(form['errorRecepcion']()).toBeTruthy();

      form['recibir']();
      expect(envio(http).solicitud.uuidCliente).not.toBe(primero.solicitud.uuidCliente);
    });

    it('un 409 es incierto (pudo haberse registrado): conserva el uuid', () => {
      const { http, form } = abrir();
      form['recibir']();
      const primero = envio(http);
      primero.req.flush({}, { status: 409, statusText: 'Conflict' });

      expect(form['intento']()).not.toBeNull();
      form['recibir']();
      expect(envio(http).solicitud.uuidCliente).toBe(primero.solicitud.uuidCliente);
    });

  });

  describe('cierre del diálogo', () => {
    it('haySinGuardar es false con el formulario intacto y true al editarlo', () => {
      const { form } = abrir();
      expect(form.haySinGuardar()).toBe(false);
      form['form'].markAsDirty();
      expect(form.haySinGuardar()).toBe(true);
    });
  });
});
