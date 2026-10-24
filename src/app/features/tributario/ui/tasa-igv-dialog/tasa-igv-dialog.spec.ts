import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { TasaIgvDialog } from './tasa-igv-dialog';

const base = `${environment.apiBaseUrl}/admin/tributario`;

describe('TasaIgvDialog (Fase G)', () => {
  function crear() {
    const close = vi.fn();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DialogRef, useValue: { close } }] });
    const f = TestBed.createComponent(TasaIgvDialog);
    f.detectChanges();
    return { f, http: TestBed.inject(HttpTestingController), close, comp: f.componentInstance as unknown as Record<string, any> };
  }

  it('envía la tasa, la fecha y el motivo recortado y cierra con la tasa registrada', () => {
    const { http, close, comp } = crear();
    comp['form'].setValue({ tasa: 18, vigenteDesde: '2026-01-01', motivo: ' Confirmada por el contador ' });
    comp['enviar']();
    const req = http.expectOne(`${base}/tasas-igv`);
    expect(req.request.body).toEqual({ tasa: 18, vigenteDesde: '2026-01-01', motivo: 'Confirmada por el contador' });
    const respuesta = { id: 't-1', tasa: 18, vigenteDesde: '2026-01-01', motivo: 'Confirmada por el contador', usuarioNombre: 'Admin', creadoEn: '' };
    req.flush(respuesta);
    expect(close).toHaveBeenCalledWith(respuesta);
    http.verify();
  });

  it('no envía una tasa fuera de rango ni sin motivo', () => {
    const { http, comp } = crear();
    comp['form'].setValue({ tasa: 120, vigenteDesde: '2026-01-01', motivo: 'x' });
    comp['enviar']();
    comp['form'].setValue({ tasa: 18, vigenteDesde: '2026-01-01', motivo: '   ' });
    comp['enviar']();
    http.expectNone(`${base}/tasas-igv`);
    http.verify();
  });
});
