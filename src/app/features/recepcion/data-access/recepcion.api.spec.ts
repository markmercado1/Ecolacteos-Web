import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { RecepcionApi } from './recepcion.api';

const base = environment.apiBaseUrl;

describe('RecepcionApi', () => {
  let api: RecepcionApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(RecepcionApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() envía page/size siempre y omite unidadId/fecha si no se seleccionan', () => {
    api.listar({ page: 0, size: 20 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/recepcion-planta`);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.has('unidadId')).toBe(false);
    expect(req.request.params.has('fecha')).toBe(false);
    req.flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });

  it('listar() combina unidadId y fecha cuando ambos se seleccionan', () => {
    api.listar({ page: 1, size: 10, unidadId: 'u1', fecha: '2026-09-17' }).subscribe();
    const req = http.expectOne(
      (r) =>
        r.url === `${base}/recepcion-planta` &&
        r.params.get('unidadId') === 'u1' &&
        r.params.get('fecha') === '2026-09-17' &&
        r.params.get('page') === '1',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ contenido: [], paginaActual: 1, tamanoPagina: 10, totalElementos: 0, totalPaginas: 1 });
  });

  it('obtener() consulta por id', () => {
    api.obtener('rp1').subscribe();
    const req = http.expectOne(`${base}/recepcion-planta/rp1`);
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'rp1',
      fecha: '2026-09-17',
      turno: 'UNICO',
      unidadId: 'u1',
      litrosCampo: 100,
      litrosPlanta: 98,
      diferenciaPct: -2,
      estado: 'OK',
      litrosRegistradosAcopio: 100,
      registroAcopioIds: ['r1'],
      jornadaId: 'j1',
      horaLlegada: '2026-09-17T10:00:00',
      diferenciaLitros: -2,
      observacion: null,
    });
  });
});
