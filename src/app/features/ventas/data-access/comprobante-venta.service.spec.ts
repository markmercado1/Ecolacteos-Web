import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { DescargaArchivos } from '../../../shared/util/descarga-archivos';
import { ComprobanteVentaService } from './comprobante-venta.service';

const base = environment.apiBaseUrl;

describe('ComprobanteVentaService', () => {
  let service: ComprobanteVentaService;
  let http: HttpTestingController;
  const descarga = { guardar: vi.fn() };

  beforeEach(() => {
    descarga.guardar.mockClear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DescargaArchivos, useValue: descarga }]
    });
    service = TestBed.inject(ComprobanteVentaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('el archivo se llama como el comprobante, o «venta» si no lo tiene', () => {
    expect(service.nombreArchivo('B001-00000213')).toBe('B001-00000213.pdf');
    expect(service.nombreArchivo('  NV01-00000041 ')).toBe('NV01-00000041.pdf');
    expect(service.nombreArchivo(null)).toBe('venta.pdf');
    expect(service.nombreArchivo('')).toBe('venta.pdf');
  });

  it('descargar() pide el PDF y lo guarda con el número del comprobante', () => {
    let terminado = false;
    service.descargar('v-1', 'B001-00000213').subscribe(() => (terminado = true));
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    http.expectOne(`${base}/ventas/v-1/comprobante`).flush(pdf);

    expect(descarga.guardar).toHaveBeenCalledWith(expect.any(Blob), 'B001-00000213.pdf');
    expect(terminado).toBe(true);
  });

  it('imprimir() pide el PDF y lo manda a imprimir; un error de la descarga llega a quien llama sin imprimir', () => {
    const imprimirPdf = vi.spyOn(service, 'imprimirPdf').mockImplementation(() => undefined);
    service.imprimir('v-1').subscribe();
    http.expectOne(`${base}/ventas/v-1/comprobante`).flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect(imprimirPdf).toHaveBeenCalledTimes(1);

    let fallo = false;
    service.imprimir('v-2').subscribe({ error: () => (fallo = true) });
    http.expectOne(`${base}/ventas/v-2/comprobante`).flush(new Blob(), { status: 404, statusText: 'Not Found' });
    expect(fallo).toBe(true);
    expect(imprimirPdf).toHaveBeenCalledTimes(1);
  });
});
