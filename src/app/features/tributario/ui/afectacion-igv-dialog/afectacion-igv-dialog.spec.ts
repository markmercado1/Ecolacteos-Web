import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { FilaAfectacionIgvResponse } from '../../data-access/igv.models';
import { AfectacionIgvDialog } from './afectacion-igv-dialog';

const base = `${environment.apiBaseUrl}/admin/tributario`;

const fila: FilaAfectacionIgvResponse = {
  presentacionId: 'pr-1', presentacionNombre: 'Pieza 1 kg', productoId: 'p-1', productoNombre: 'Queso fresco', familiaNombre: 'Quesos',
  afectacionVigente: 'SIN_DEFINIR', vigenteDesde: null, afectacionProgramada: null, programadaDesde: null
};

function crear() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DIALOG_DATA, useValue: { fila } }, { provide: DialogRef, useValue: { close } }]
  });
  const f = TestBed.createComponent(AfectacionIgvDialog);
  const http = TestBed.inject(HttpTestingController);
  return { f, http, close };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const comp = (f: ComponentFixture<AfectacionIgvDialog>) => f.componentInstance as unknown as Record<string, any>;

describe('AfectacionIgvDialog (Fase G)', () => {
  it('una presentación nunca clasificada lo dice y el selector empieza en «Sin definir» (el panel no propone ninguna)', () => {
    const { f, http } = crear();
    http.expectOne(`${base}/presentaciones/pr-1/afectaciones`).flush([]);
    f.detectChanges();
    expect(el(f).textContent).toContain('Nunca se clasificó');
    expect((el(f).querySelector('#afectacion') as HTMLSelectElement).value).toBe('SIN_DEFINIR');
    http.verify();
  });

  it('registra el cambio con fecha y motivo recortado, recarga el historial y al cerrar avisa que hubo cambios', () => {
    const { f, http, close } = crear();
    http.expectOne(`${base}/presentaciones/pr-1/afectaciones`).flush([]);
    f.detectChanges();
    comp(f)['form'].setValue({ afectacion: 'GRAVADO', vigenteDesde: '2026-11-01', motivo: '  Decisión del administrador  ' });
    comp(f)['enviar']();
    const req = http.expectOne(`${base}/presentaciones/pr-1/afectaciones`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ afectacion: 'GRAVADO', vigenteDesde: '2026-11-01', motivo: 'Decisión del administrador' });
    req.flush({ id: 'a-1', presentacionId: 'pr-1', afectacion: 'GRAVADO', vigenteDesde: '2026-11-01', motivo: 'Decisión del administrador', usuarioNombre: 'Admin', creadoEn: '' });
    http.expectOne(`${base}/presentaciones/pr-1/afectaciones`).flush([
      { id: 'a-1', presentacionId: 'pr-1', afectacion: 'GRAVADO', vigenteDesde: '2026-11-01', motivo: 'Decisión del administrador', usuarioNombre: 'Admin', creadoEn: '' }
    ]);
    f.detectChanges();
    expect(el(f).querySelector('[data-testid="historial-afectacion"]')?.textContent).toContain('Gravado');
    (Array.from(el(f).querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cerrar') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledWith(true);
    http.verify();
  });

  it('sin motivo no envía; un conflicto del servidor se muestra', () => {
    const { f, http } = crear();
    http.expectOne(`${base}/presentaciones/pr-1/afectaciones`).flush([]);
    comp(f)['form'].patchValue({ motivo: '   ' });
    comp(f)['enviar']();
    http.expectNone((r) => r.method === 'POST');
    comp(f)['form'].patchValue({ motivo: 'Contador' });
    comp(f)['enviar']();
    http.expectOne((r) => r.method === 'POST').flush({ mensaje: 'Ya tiene una afectación con esa fecha' }, { status: 409, statusText: 'Conflict' });
    f.detectChanges();
    expect(el(f).querySelector('.server-error')?.textContent).toContain('Ya tiene una afectación con esa fecha');
    http.verify();
  });
});
