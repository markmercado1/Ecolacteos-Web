import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { CalidadApi } from './calidad.api';

const base = environment.apiBaseUrl;

describe('CalidadApi', () => {
  let api: CalidadApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(CalidadApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('bandeja() hace GET /analisis-calidad/bandeja con fecha exacta', () => {
    api.bandeja('2026-09-17').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/analisis-calidad/bandeja` && r.params.get('fecha') === '2026-09-17');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('porFolio() codifica el folio en la ruta', () => {
    api.porFolio('F 001/A').subscribe();
    const req = http.expectOne(`${base}/analisis-calidad/folio/${encodeURIComponent('F 001/A')}`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('porRegistro() consulta por id de registro de acopio', () => {
    api.porRegistro('r1').subscribe();
    const req = http.expectOne(`${base}/analisis-calidad/registro/r1`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('alertasPorZona() envía zonaId como query param', () => {
    api.alertasPorZona('z1').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/innovacion/alertas` && r.params.get('zonaId') === 'z1');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('score() consulta por proveedor y propaga un 404 sin transformarlo', () => {
    const error = vi.fn();
    api.score('p1').subscribe({ error });
    const req = http.expectOne(`${base}/innovacion/score/p1`);
    req.flush({ mensaje: 'Sin score calculado aun para el proveedor: p1' }, { status: 404, statusText: 'Not Found' });
    expect(error).toHaveBeenCalled();
  });

  it('prediccion() consulta por proveedor', () => {
    api.prediccion('p1').subscribe();
    const req = http.expectOne(`${base}/innovacion/prediccion/p1`);
    expect(req.request.method).toBe('GET');
    req.flush({ proveedorId: 'p1', fechaPrevista: '2026-09-24', litrosEstimadosMin: 10, litrosEstimadosMax: 20 });
  });

  it('panelEconomico() envía zonaId como query param y devuelve el panel completo', () => {
    api.panelEconomico('z1').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/innovacion/panel-economico` && r.params.get('zonaId') === 'z1');
    expect(req.request.method).toBe('GET');
    req.flush({
      zonaId: 'z1',
      litrosEnRiesgoValorizados: 150.5,
      forecastSemana: { zonaId: 'z1', semanaInicio: '2026-09-21', litrosEstimados: 1000, litrosReales: null, recomendacionMezcla: 'Mantener mezcla actual', flujoCajaProyectado: 3500, alertaCapacidad: false },
      margenPorCanal: [{ tipoCliente: 'MAYORISTA', totalVentas: 500 }],
      pctRechazoSiScoreSube10: null,
    });
  });

  it('panelEconomico() propaga un 404 sin transformarlo (zona sin proyección o inexistente)', () => {
    const error = vi.fn();
    api.panelEconomico('z1').subscribe({ error });
    const req = http.expectOne((r) => r.url === `${base}/innovacion/panel-economico`);
    req.flush({ mensaje: 'Sin prediccion calculada aun para la zona: z1' }, { status: 404, statusText: 'Not Found' });
    expect(error).toHaveBeenCalled();
  });
});
