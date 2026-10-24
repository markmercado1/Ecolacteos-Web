import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { ProveedorAdminResponse } from '../../data-access/proveedor.models';
import { CambiarZonaDialog } from './cambiar-zona-dialog';

const base = environment.apiBaseUrl;

const proveedor = {
  id: 'p-1', nombre: 'Alejandro Terrones', dni: '45454545', telefono: null, zonaActualId: 'z-1', zonaActualNombre: 'Chugur', codigoQr: 'QR', activo: true
} as ProveedorAdminResponse;
const zonas = [{ id: 'z-1', nombre: 'Chugur', activa: true }, { id: 'z-2', nombre: 'Bambamarca', activa: true }];

function crear() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { proveedor, zonas } },
      { provide: DialogRef, useValue: { close } }
    ]
  });
  const f = TestBed.createComponent(CambiarZonaDialog);
  f.detectChanges();
  return { f, http: TestBed.inject(HttpTestingController), close };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const comp = (f: ComponentFixture<CambiarZonaDialog>) => f.componentInstance as unknown as Record<string, any>;

describe('CambiarZonaDialog', () => {
  it('ofrece un motivo opcional y deshabilita la zona en la que el proveedor ya está', () => {
    const { f, http } = crear();
    expect(el(f).querySelector('#motivoZona')).not.toBeNull();
    expect(el(f).textContent).toContain('Motivo (opcional)');
    const opciones = Array.from(el(f).querySelectorAll('#zonaId option')) as HTMLOptionElement[];
    const actual = opciones.find((o) => o.textContent?.includes('Chugur'))!;
    const otra = opciones.find((o) => o.textContent?.includes('Bambamarca'))!;
    expect(actual.disabled).toBe(true);
    expect(actual.textContent).toContain('(zona actual)');
    expect(otra.disabled).toBe(false);
    http.verify();
  });

  it('envía la zona y el motivo recortado', () => {
    const { f, http, close } = crear();
    comp(f)['form'].setValue({ zonaId: 'z-2', motivo: '  Cambió su ruta de recojo  ' });
    comp(f)['enviar']();
    const req = http.expectOne((r) => r.url === `${base}/proveedores/p-1/zona`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.params.get('zonaId')).toBe('z-2');
    expect(req.request.params.get('motivo')).toBe('Cambió su ruta de recojo');
    req.flush({ ...proveedor, zonaActualId: 'z-2' });
    expect(close).toHaveBeenCalled();
    http.verify();
  });

  it('sin motivo (o solo espacios) no envía el parámetro', () => {
    const { f, http } = crear();
    comp(f)['form'].setValue({ zonaId: 'z-2', motivo: '   ' });
    comp(f)['enviar']();
    const req = http.expectOne((r) => r.url === `${base}/proveedores/p-1/zona`);
    expect(req.request.params.has('motivo')).toBe(false);
    req.flush(proveedor);
    http.verify();
  });

  it('el motivo no puede pasar de 200 caracteres', () => {
    const { f, http } = crear();
    comp(f)['form'].setValue({ zonaId: 'z-2', motivo: 'x'.repeat(201) });
    expect(comp(f)['form'].invalid).toBe(true);
    comp(f)['enviar']();
    http.expectNone((r) => r.url === `${base}/proveedores/p-1/zona`);
    http.verify();
  });

  it('el rechazo del servidor (409: ya está en esa zona) se muestra y el diálogo no se cierra', () => {
    const { f, http, close } = crear();
    comp(f)['form'].setValue({ zonaId: 'z-2', motivo: '' });
    comp(f)['enviar']();
    http.expectOne((r) => r.url === `${base}/proveedores/p-1/zona`)
      .flush({ mensaje: 'El proveedor ya está en la zona Bambamarca' }, { status: 409, statusText: 'Conflict' });
    f.detectChanges();
    expect(el(f).textContent).toContain('El proveedor ya está en la zona Bambamarca');
    expect(comp(f)['enviando']()).toBe(false);
    expect(close).not.toHaveBeenCalled();
    http.verify();
  });
});
