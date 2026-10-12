import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ReservasApi } from './reservas.api';

const base = `${environment.apiBaseUrl}/reservas`;

describe('ReservasApi', () => {
  let api: ReservasApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ReservasApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() envía page/size y omite los filtros vacíos', () => {
    api.listar({ page: 0, size: 20, telefono: '  ', codigo: '' }).subscribe();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    for (const filtro of ['estado', 'fechaRetiro', 'telefono', 'codigo']) expect(req.request.params.has(filtro)).toBe(false);
    req.flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });

  it('listar() envía estado, fecha de retiro, teléfono y código cuando se filtran', () => {
    api.listar({ page: 2, size: 20, estado: 'PENDIENTE', fechaRetiro: '2026-10-13', telefono: ' 987654321 ', codigo: 'ABCD234567' }).subscribe();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('estado')).toBe('PENDIENTE');
    expect(req.request.params.get('fechaRetiro')).toBe('2026-10-13');
    expect(req.request.params.get('telefono')).toBe('987654321');
    expect(req.request.params.get('codigo')).toBe('ABCD234567');
    req.flush({ contenido: [], paginaActual: 2, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });
  });

  it('obtener() hace GET por id', () => {
    api.obtener('r-1').subscribe();
    const req = http.expectOne(`${base}/r-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('recotizar() y confirmar() hacen PUT sin cuerpo', () => {
    api.recotizar('r-1').subscribe();
    const recotizar = http.expectOne(`${base}/r-1/recotizar`);
    expect(recotizar.request.method).toBe('PUT');
    expect(recotizar.request.body).toBeNull();
    recotizar.flush({});

    api.confirmar('r-1').subscribe();
    const confirmar = http.expectOne(`${base}/r-1/confirmar`);
    expect(confirmar.request.method).toBe('PUT');
    expect(confirmar.request.body).toBeNull();
    confirmar.flush({});
  });

  it('rechazar() y cancelar() hacen PUT con el motivo', () => {
    api.rechazar('r-1', 'Sin stock').subscribe();
    const rechazar = http.expectOne(`${base}/r-1/rechazar`);
    expect(rechazar.request.method).toBe('PUT');
    expect(rechazar.request.body).toEqual({ motivo: 'Sin stock' });
    rechazar.flush({});

    api.cancelar('r-1', 'El cliente no viene').subscribe();
    const cancelar = http.expectOne(`${base}/r-1/cancelar`);
    expect(cancelar.request.method).toBe('PUT');
    expect(cancelar.request.body).toEqual({ motivo: 'El cliente no viene' });
    cancelar.flush({});
  });

  it('registrarAceptacion() hace POST a aceptacion-precio con medio y nota', () => {
    api.registrarAceptacion('r-1', { medio: 'WHATSAPP', nota: 'Escribió al chat' }).subscribe();
    const req = http.expectOne(`${base}/r-1/aceptacion-precio`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ medio: 'WHATSAPP', nota: 'Escribió al chat' });
    req.flush({});
  });

  it('retirar() hace POST a retirar con el uuidCliente de la venta (clave de idempotencia)', () => {
    api.retirar('r-1', 'uuid-venta-1').subscribe();
    const req = http.expectOne(`${base}/r-1/retirar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ uuidCliente: 'uuid-venta-1' });
    req.flush({ id: 'v-1', fecha: '2026-10-12', tipoCliente: 'PUBLICO', detalles: [], total: 10 });
  });
});
