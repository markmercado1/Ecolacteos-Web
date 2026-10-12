import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LotesProduccionApi } from './lotes-produccion.api';
import { CrearLoteRequest } from './lote-produccion.models';

const base = environment.apiBaseUrl;

describe('LotesProduccionApi', () => {
  let api: LotesProduccionApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(LotesProduccionApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() envía page/size siempre y omite fecha/productoId si no se seleccionan', () => {
    api.listar({ page: 0, size: 20 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/lotes-produccion`);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.has('fecha')).toBe(false);
    expect(req.request.params.has('productoId')).toBe(false);
    req.flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });

  it('listar() envía el filtro de estado solo cuando se elige', () => {
    api.listar({ page: 0, size: 20, estado: 'PLANIFICADA' }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/lotes-produccion`);
    expect(req.request.params.get('estado')).toBe('PLANIFICADA');
    req.flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });

  it('planificar/disponibilidad/iniciar/finalizar/cancelar usan las rutas del ciclo de vida (V18)', () => {
    api.planificar({ uuidCliente: 'u', fecha: '2026-09-30', recetaId: 'r1', litros: 1000 }).subscribe();
    const plan = http.expectOne(`${base}/lotes-produccion/planificar`);
    expect(plan.request.method).toBe('POST');
    expect(plan.request.body.recetaId).toBe('r1');

    api.disponibilidad('l1').subscribe();
    expect(http.expectOne(`${base}/lotes-produccion/l1/disponibilidad`).request.method).toBe('GET');

    api.iniciar('l1').subscribe();
    expect(http.expectOne(`${base}/lotes-produccion/l1/iniciar`).request.method).toBe('POST');

    api.finalizar('l1', { detalles: [{ presentacionId: 'pr1', cantidadObtenida: 9 }] }).subscribe();
    const fin = http.expectOne(`${base}/lotes-produccion/l1/finalizar`);
    expect(fin.request.method).toBe('POST');
    expect(fin.request.body.detalles[0].cantidadObtenida).toBe(9);

    api.cancelar('l1').subscribe();
    expect(http.expectOne(`${base}/lotes-produccion/l1/cancelar`).request.method).toBe('POST');
  });

  it('listar() combina fecha y productoId cuando ambos se seleccionan', () => {
    api.listar({ page: 2, size: 10, fecha: '2026-09-17', productoId: 't1' }).subscribe();
    const req = http.expectOne(
      (r) =>
        r.url === `${base}/lotes-produccion` &&
        r.params.get('fecha') === '2026-09-17' &&
        r.params.get('productoId') === 't1' &&
        r.params.get('page') === '2',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ contenido: [], paginaActual: 2, tamanoPagina: 10, totalElementos: 0, totalPaginas: 3 });
  });

  it('obtener() consulta por id', () => {
    api.obtener('l1').subscribe();
    const req = http.expectOne(`${base}/lotes-produccion/l1`);
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'l1',
      fecha: '2026-09-17',
      productoNombre: 'Fresco',
      litrosUsados: 100,
      detalles: [{ presentacionId: 'pr1', cantidadObtenida: 12 }],
      rendimientoPct: 12,
      rendimientoEsperadoPct: 15,
      registroAcopioIds: [],
      unidadesEsperadas: 15,
      rendimientoEsperadoPctSnapshot: 15,
      recepcionesConsumidas: [{ recepcionPlantaId: 'rp1', litrosConsumidos: 100 }],
    });
  });

  // Refactor de Producción, fase 2/4: CrearLoteRequest ya no incluye registroAcopioIds -- el backend elige
  // automáticamente de qué recepciones de planta consume la leche (FIFO sobre el saldo remanente).
  it('crear() hace POST /lotes-produccion con exactamente los 5 campos del contrato nuevo', () => {
    const datos: CrearLoteRequest = {
      uuidCliente: 'uuid-1',
      fecha: '2026-09-18',
      productoId: 't1',
      litrosUsados: 80,
      detalles: [{ presentacionId: 'pr1', cantidadObtenida: 40 }],
    };
    api.crear(datos).subscribe();
    const req = http.expectOne(`${base}/lotes-produccion`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(datos);
    req.flush({
      id: 'l1',
      fecha: '2026-09-18',
      productoNombre: 'Fresco',
      litrosUsados: 80,
      detalles: [{ presentacionId: 'pr1', cantidadObtenida: 40 }],
      rendimientoPct: 50,
      rendimientoEsperadoPct: 45,
      registroAcopioIds: [],
      unidadesEsperadas: 36,
      rendimientoEsperadoPctSnapshot: 45,
      recepcionesConsumidas: [{ recepcionPlantaId: 'rp1', litrosConsumidos: 80 }],
    });
  });

  it('crear() propaga un error 404 (productoId inexistente) sin transformarlo', () => {
    const error = vi.fn();
    api
      .crear({ uuidCliente: 'u', fecha: '2026-09-18', productoId: 't1', litrosUsados: 1, detalles: [{ presentacionId: 'pr1', cantidadObtenida: 1 }] })
      .subscribe({ error });
    const req = http.expectOne(`${base}/lotes-produccion`);
    req.flush({ mensaje: 'Tipo de queso no encontrado: t1' }, { status: 404, statusText: 'Not Found' });
    expect(error).toHaveBeenCalled();
  });

  it('crear() propaga un error 400 (leche disponible insuficiente) sin transformarlo', () => {
    const error = vi.fn();
    api
      .crear({ uuidCliente: 'u', fecha: '2026-09-18', productoId: 't1', litrosUsados: 999, detalles: [{ presentacionId: 'pr1', cantidadObtenida: 1 }] })
      .subscribe({ error });
    const req = http.expectOne(`${base}/lotes-produccion`);
    req.flush({ mensaje: 'Leche disponible insuficiente: se solicitaron 999 L, disponibles 50 L' }, { status: 400, statusText: 'Bad Request' });
    expect(error).toHaveBeenCalled();
  });

  it('crear() propaga un error 409 (carrera concurrente con el mismo uuidCliente) sin transformarlo', () => {
    const error = vi.fn();
    api
      .crear({ uuidCliente: 'u', fecha: '2026-09-18', productoId: 't1', litrosUsados: 1, detalles: [{ presentacionId: 'pr1', cantidadObtenida: 1 }] })
      .subscribe({ error });
    const req = http.expectOne(`${base}/lotes-produccion`);
    req.flush({ mensaje: 'Ya existe un lote de produccion con este uuidCliente (creado concurrentemente)' }, { status: 409, statusText: 'Conflict' });
    expect(error).toHaveBeenCalled();
  });
});

