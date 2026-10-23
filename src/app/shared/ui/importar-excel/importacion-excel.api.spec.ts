import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { mapHttpError } from '../../../core/http/app-error';
import { ImportacionExcelApi } from './importacion-excel.api';

const base = `${environment.apiBaseUrl}/admin/importaciones`;

describe('ImportacionExcelApi', () => {
  let api: ImportacionExcelApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ImportacionExcelApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('descarga la plantilla del tipo con el nombre del servidor', () => {
    let nombre = '';
    api.plantilla('insumos').subscribe((r) => (nombre = r.nombre));

    const req = http.expectOne(`${base}/insumos/plantilla`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']), { headers: { 'Content-Disposition': 'attachment; filename="plantilla-insumos-v1.xlsx"' } });
    expect(nombre).toBe('plantilla-insumos-v1.xlsx');
  });

  it('previsualizar sube el archivo como multipart en el campo "archivo" y no confirma nada', () => {
    const archivo = new File(['contenido'], 'padron.xlsx');
    api.previsualizar('proveedores', archivo).subscribe();

    const req = http.expectOne(`${base}/proveedores/previsualizar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);
    const enviado = (req.request.body as FormData).get('archivo') as File;
    expect(enviado.name).toBe('padron.xlsx');
    // El navegador fija el Content-Type con su boundary: no se escribe a mano.
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush({});
    http.expectNone(`${base}/imp-1/confirmar`);
  });

  it('confirmar, reporte y cancelar usan el id de la importación', () => {
    api.confirmar('imp 1').subscribe();
    const confirmar = http.expectOne(`${base}/imp%201/confirmar`);
    expect(confirmar.request.method).toBe('POST');
    confirmar.flush({});

    api.reporte('imp-1').subscribe();
    const reporte = http.expectOne(`${base}/imp-1/reporte`);
    expect(reporte.request.responseType).toBe('blob');
    reporte.flush(new Blob(['x']));

    api.cancelar('imp-1').subscribe();
    const cancelar = http.expectOne(`${base}/imp-1`);
    expect(cancelar.request.method).toBe('DELETE');
    cancelar.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('el mensaje del servidor se conserva aunque el error de una descarga llegue como blob', async () => {
    const error = await new Promise<unknown>((resolve) => {
      api.plantilla('proveedores').subscribe({ error: resolve });
      const cuerpo = new Blob([JSON.stringify({ status: 404, mensaje: "No existe una importación de tipo 'ventas'." })], { type: 'application/json' });
      http.expectOne(`${base}/proveedores/plantilla`).flush(cuerpo, { status: 404, statusText: 'Not Found' });
    });

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(mapHttpError(error).mensaje).toContain('No existe una importación');
  });
});
