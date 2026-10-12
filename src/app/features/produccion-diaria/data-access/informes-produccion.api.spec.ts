import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { InformesProduccionApi } from './informes-produccion.api';
import { CrearInformeProduccionRequest, EditarInformeProduccionRequest } from './informe-produccion.models';

const base = environment.apiBaseUrl;

const informeFlush = {
  id: 'i1',
  uuidCliente: 'u1',
  fecha: '2026-09-01',
  quesosDiarios: 1195,
  quesosReparados: 5,
  quesosDeRecorte: 4,
  totalQuesos: 1204,
  recorteEnKilos: 9,
  responsableNombre: 'Ana',
  creadoEn: '2026-09-01T10:00:00',
  actualizadoPorNombre: null,
  actualizadoEn: null,
  insumos: [{ insumoId: 'ins1', insumoNombre: 'Cuajo', unidadMedida: 'unidades', cantidad: 108 }]
};

describe('InformesProduccionApi', () => {
  let api: InformesProduccionApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(InformesProduccionApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() envía page/size siempre y omite desde/hasta si no se seleccionan', () => {
    api.listar({ page: 0, size: 10 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/informes-produccion`);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.has('desde')).toBe(false);
    expect(req.request.params.has('hasta')).toBe(false);
    req.flush({ contenido: [], paginaActual: 0, tamanoPagina: 10, totalElementos: 0, totalPaginas: 0 });
  });

  it('obtenerPorFecha() consulta GET /informes-produccion/fecha/{fecha}', () => {
    api.obtenerPorFecha('2026-09-01').subscribe();
    const req = http.expectOne(`${base}/informes-produccion/fecha/2026-09-01`);
    expect(req.request.method).toBe('GET');
    req.flush(informeFlush);
  });

  it('obtenerPorFecha() propaga un 404 sin transformarlo (el llamador decide: no existe informe ese día)', () => {
    const error = vi.fn();
    api.obtenerPorFecha('2026-09-30').subscribe({ error });
    const req = http.expectOne(`${base}/informes-produccion/fecha/2026-09-30`);
    req.flush({ mensaje: 'No existe' }, { status: 404, statusText: 'Not Found' });
    expect(error).toHaveBeenCalled();
  });

  it('crear() hace POST con el payload exacto', () => {
    const datos: CrearInformeProduccionRequest = {
      uuidCliente: 'u1',
      fecha: '2026-09-01',
      quesosDiarios: 1195,
      quesosReparados: 5,
      quesosDeRecorte: 4,
      recorteEnKilos: 9,
      insumos: [{ insumoId: 'ins1', cantidad: 108 }]
    };
    api.crear(datos).subscribe();
    const req = http.expectOne(`${base}/informes-produccion`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(datos);
    req.flush(informeFlush);
  });

  it('editar() hace PUT por id, sin fecha ni uuidCliente en el payload', () => {
    const datos: EditarInformeProduccionRequest = {
      quesosDiarios: 1185,
      quesosReparados: 12,
      quesosDeRecorte: 4,
      recorteEnKilos: 6,
      insumos: []
    };
    api.editar('i1', datos).subscribe();
    const req = http.expectOne(`${base}/informes-produccion/i1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(datos);
    req.flush(informeFlush);
  });
});
