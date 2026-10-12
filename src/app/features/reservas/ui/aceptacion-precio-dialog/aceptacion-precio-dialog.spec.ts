import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { AceptacionPrecioDialog, AceptacionPrecioDialogData } from './aceptacion-precio-dialog';

const base = `${environment.apiBaseUrl}/reservas`;
const DATA: AceptacionPrecioDialogData = { reservaId: 'r-1', codigo: 'ABCD234567', total: 60 };

function crear() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: DATA },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const dialogRef = TestBed.inject(DialogRef) as unknown as { close: ReturnType<typeof vi.fn> };
  const fixture = TestBed.createComponent(AceptacionPrecioDialog);
  fixture.detectChanges();
  return { fixture, http, dialogRef, c: fixture.componentInstance as unknown as Record<string, any> };
}

describe('AceptacionPrecioDialog', () => {
  it('muestra la reserva y el importe que se le informó al cliente', () => {
    const { fixture } = crear();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('ABCD234567');
    expect(texto).toContain('S/ 60.00');
  });

  it('enviar() registra el medio y la nota recortada y cierra con la reserva devuelta', () => {
    const { http, dialogRef, c } = crear();
    c['form'].controls.medio.setValue('WHATSAPP');
    c['form'].controls.nota.setValue('  Escribió al chat  ');
    c['enviar']();
    expect(c['enviando']()).toBe(true);

    const req = http.expectOne(`${base}/r-1/aceptacion-precio`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ medio: 'WHATSAPP', nota: 'Escribió al chat' });
    req.flush({ id: 'r-1', codigo: 'ABCD234567' });
    expect(dialogRef.close).toHaveBeenCalledWith({ id: 'r-1', codigo: 'ABCD234567' });
  });

  it('sin nota no la envía', () => {
    const { http, c } = crear();
    c['enviar']();
    const req = http.expectOne(`${base}/r-1/aceptacion-precio`);
    expect(req.request.body).toEqual({ medio: 'TELEFONO', nota: undefined });
    req.flush({});
  });

  it('si el servidor lo rechaza muestra su mensaje, no cierra y permite reintentar', () => {
    const { fixture, http, dialogRef, c } = crear();
    c['enviar']();
    http.expectOne(`${base}/r-1/aceptacion-precio`).flush(
      { mensaje: 'Primero recotiza: hay líneas sin precio.' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(c['enviando']()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Primero recotiza: hay líneas sin precio.');
  });

  it('no envía dos veces mientras hay una solicitud en curso', () => {
    const { http, c } = crear();
    c['enviar']();
    c['enviar']();
    http.expectOne(`${base}/r-1/aceptacion-precio`).flush({});
  });
});
