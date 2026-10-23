import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { mapHttpError } from '../../../core/http/app-error';
import { ExportacionExcelApi, nombreDeContentDisposition } from './exportacion-excel.api';

const base = environment.apiBaseUrl;

describe('nombreDeContentDisposition', () => {
  it('lee filename entre comillas', () => {
    expect(nombreDeContentDisposition('attachment; filename="proveedores-20261022-1030.xlsx"', 'x.xlsx')).toBe('proveedores-20261022-1030.xlsx');
  });

  it('prefiere filename* UTF-8 y lo decodifica', () => {
    expect(nombreDeContentDisposition("attachment; filename*=UTF-8''pr%C3%B3ximos-pagos.xlsx", 'x.xlsx')).toBe('próximos-pagos.xlsx');
  });

  it('sin cabecera o ilegible usa el respaldo', () => {
    expect(nombreDeContentDisposition(null, 'respaldo.xlsx')).toBe('respaldo.xlsx');
    expect(nombreDeContentDisposition('attachment', 'respaldo.xlsx')).toBe('respaldo.xlsx');
    expect(nombreDeContentDisposition("attachment; filename*=UTF-8''%E0%A4%A", 'respaldo.xlsx')).toBe('respaldo.xlsx');
  });

  it('nunca deja pasar una ruta', () => {
    expect(nombreDeContentDisposition('attachment; filename="../../etc/passwd.xlsx"', 'x.xlsx')).toBe('passwd.xlsx');
    expect(nombreDeContentDisposition('attachment; filename="C:\\\\Windows\\\\malo.xlsx"', 'x.xlsx')).toBe('malo.xlsx');
  });
});

describe('ExportacionExcelApi', () => {
  let api: ExportacionExcelApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ExportacionExcelApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el recurso como blob con los filtros, sin enviar los vacíos', () => {
    api.descargar('proveedores', { zonaId: 'z-1', activo: false, busqueda: '  huaman ', vacio: '', nulo: null, indefinido: undefined }).subscribe();

    const req = http.expectOne((r) => r.url === `${base}/exportaciones/proveedores`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('zonaId')).toBe('z-1');
    expect(req.request.params.get('activo')).toBe('false');
    expect(req.request.params.get('busqueda')).toBe('huaman');
    expect(req.request.params.has('vacio')).toBe(false);
    expect(req.request.params.has('nulo')).toBe(false);
    expect(req.request.params.has('indefinido')).toBe(false);
    expect(req.request.params.has('page')).toBe(false); // el archivo trae TODAS las filas, no una página
    req.flush(new Blob(['x']));
  });

  it('devuelve el archivo con el nombre que sugiere el servidor', () => {
    let resultado: { blob: Blob; nombre: string } | undefined;
    api.descargar('pagos', {}, 'pagos.xlsx').subscribe((r) => (resultado = r));

    http.expectOne(`${base}/exportaciones/pagos`).flush(new Blob(['datos']), {
      headers: { 'Content-Disposition': 'attachment; filename="pagos-20261022-1100.xlsx"' }
    });

    expect(resultado?.nombre).toBe('pagos-20261022-1100.xlsx');
    expect(resultado?.blob.size).toBe(5);
  });

  it('sin Content-Disposition usa el nombre de respaldo', () => {
    let nombre = '';
    api.descargar('ventas', {}, 'ventas.xlsx').subscribe((r) => (nombre = r.nombre));
    http.expectOne(`${base}/exportaciones/ventas`).flush(new Blob(['x']));
    expect(nombre).toBe('ventas.xlsx');
  });

  it('conserva el mensaje del servidor aunque el error llegue como blob', async () => {
    const error = await new Promise<unknown>((resolve) => {
      api.descargar('pagos').subscribe({ error: resolve });
      const cuerpo = new Blob([JSON.stringify({ status: 400, mensaje: 'La exportación tiene 60000 filas y el máximo permitido es 50000.' })], { type: 'application/json' });
      http.expectOne(`${base}/exportaciones/pagos`).flush(cuerpo, { status: 400, statusText: 'Bad Request' });
    });

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(mapHttpError(error).mensaje).toContain('60000');
    expect(mapHttpError(error).tipo).toBe('validacion');
  });

  it('un error sin JSON legible cae al mensaje por defecto del estado', async () => {
    const error = await new Promise<unknown>((resolve) => {
      api.descargar('pagos').subscribe({ error: resolve });
      http.expectOne(`${base}/exportaciones/pagos`).flush(new Blob(['<html>'], { type: 'text/html' }), { status: 403, statusText: 'Forbidden' });
    });
    expect(mapHttpError(error).tipo).toBe('permiso');
  });
});
