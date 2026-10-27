import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { ClasificarLoteDialog } from './clasificar-lote-dialog';

const base = `${environment.apiBaseUrl}/admin/tributario`;

function crear(sinDefinir = 4) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DIALOG_DATA, useValue: { sinDefinir } }, { provide: DialogRef, useValue: { close } }]
  });
  const f = TestBed.createComponent(ClasificarLoteDialog);
  f.detectChanges();
  return { f, http: TestBed.inject(HttpTestingController), close };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const comp = (f: ComponentFixture<ClasificarLoteDialog>) => f.componentInstance as unknown as Record<string, any>;

describe('ClasificarLoteDialog', () => {
  it('dice cuántas presentaciones faltan y no ofrece «sin definir» como clasificación', () => {
    const { f } = crear(4);
    expect(el(f).querySelector('[data-testid="resumen-lote"]')?.textContent).toContain('4 presentaciones activas');
    const opciones = Array.from(el(f).querySelectorAll('#lote-afectacion option')).map((o) => (o as HTMLOptionElement).value);
    expect(opciones).toEqual(['GRAVADO', 'EXONERADO', 'INAFECTO']);
  });

  it('envía afectación, fecha, motivo recortado y soloSinDefinir (marcado por defecto) y cierra con el resultado', () => {
    const { f, http, close } = crear();
    comp(f)['form'].patchValue({ vigenteDesde: '2026-10-26', motivo: '  Todo gravado  ' });
    comp(f)['enviar']();
    const req = http.expectOne(`${base}/afectaciones/lote`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ afectacion: 'GRAVADO', vigenteDesde: '2026-10-26', motivo: 'Todo gravado', soloSinDefinir: true });
    req.flush({ aplicadas: 4, omitidas: 0 });
    expect(close).toHaveBeenCalledWith({ aplicadas: 4, omitidas: 0 });
    http.verify();
  });

  it('sin motivo no envía; un error del servidor se muestra y deja reintentar', () => {
    const { f, http } = crear();
    comp(f)['form'].patchValue({ motivo: '   ' });
    comp(f)['enviar']();
    http.expectNone(`${base}/afectaciones/lote`);
    comp(f)['form'].patchValue({ motivo: 'Todo gravado' });
    comp(f)['enviar']();
    http.expectOne(`${base}/afectaciones/lote`).flush({ mensaje: 'Solo un administrador' }, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect(el(f).querySelector('.server-error')?.textContent).toContain('Solo un administrador');
    expect(comp(f)['enviando']()).toBe(false);
    http.verify();
  });
});
