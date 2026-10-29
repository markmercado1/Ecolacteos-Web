import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { ProveedorAdminResponse } from '../../data-access/proveedor.models';
import { ProveedorFormDialog, ProveedorFormDialogData } from './proveedor-form-dialog';

const base = environment.apiBaseUrl;

const natural: ProveedorAdminResponse = {
  id: 'p-1', nombre: 'Rosa Quispe', dni: '04567890', telefono: null, zonaActualId: null, zonaActualNombre: null, codigoQr: 'QR',
  activo: true, tipoPersona: 'NATURAL', ruc: null, razonSocial: null
};

function crear(data: ProveedorFormDialogData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close } }
    ]
  });
  const f = TestBed.createComponent(ProveedorFormDialog);
  f.detectChanges();
  return { f, http: TestBed.inject(HttpTestingController), close };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const comp = (f: ComponentFixture<ProveedorFormDialog>) => f.componentInstance as unknown as Record<string, any>;

function elegirTipo(f: ComponentFixture<ProveedorFormDialog>, tipo: 'NATURAL' | 'EMPRESA') {
  const radio = el(f).querySelector(`input[type="radio"][value="${tipo}"]`) as HTMLInputElement;
  radio.click();
  f.detectChanges();
}

describe('ProveedorFormDialog (Fase G: DNI y RUC)', () => {
  it('una persona natural nueva envía su DNI y su RUC opcional en la misma ficha', () => {
    const { f, http, close } = crear({ zonas: [] });
    expect(el(f).textContent).toContain('RUC (opcional)');
    expect(el(f).querySelector('#razonSocial')).toBeNull();
    comp(f)['form'].patchValue({ nombre: ' Rosa Quispe ', dni: '04567890', ruc: '10045678909' });
    comp(f)['enviar']();
    const req = http.expectOne(`${base}/proveedores`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nombre: 'Rosa Quispe', telefono: null, zonaActualId: null, tipoPersona: 'NATURAL',
      dni: '04567890', ruc: '10045678909', razonSocial: null });
    req.flush({ ...natural, ruc: '10045678909' });
    expect(close).toHaveBeenCalled();
    http.verify();
  });

  it('sin RUC una persona natural sigue funcionando como antes', () => {
    const { f, http } = crear({ zonas: [] });
    comp(f)['form'].patchValue({ nombre: 'Juan', dni: '11111111' });
    comp(f)['enviar']();
    const req = http.expectOne(`${base}/proveedores`);
    expect(req.request.body.ruc).toBeNull();
    req.flush({ ...natural, dni: '11111111', nombre: 'Juan' });
    http.verify();
  });

  it('avisa antes de enviar si el DNI no tiene 8 dígitos o el RUC no corresponde a su DNI', () => {
    const { f, http } = crear({ zonas: [] });
    comp(f)['form'].patchValue({ nombre: 'Rosa', dni: '123' });
    comp(f)['enviar']();
    f.detectChanges();
    expect(el(f).querySelector('.error-bloque')?.textContent).toContain('8 dígitos');
    comp(f)['form'].patchValue({ dni: '11111111', ruc: '10045678909' });
    comp(f)['enviar']();
    f.detectChanges();
    expect(el(f).querySelector('.error-bloque')?.textContent).toContain('10 + su DNI');
    http.expectNone(`${base}/proveedores`);
    http.verify();
  });

  it('una empresa pide RUC y razón social, no muestra DNI y su nombre comercial es opcional', () => {
    const { f, http } = crear({ zonas: [] });
    elegirTipo(f, 'EMPRESA');
    expect(el(f).querySelector('#dni')).toBeNull();
    expect(el(f).querySelector('#razonSocial')).not.toBeNull();
    comp(f)['form'].patchValue({ ruc: '20601234565', razonSocial: ' Lácteos del Valle S.A.C. ', dni: '04567890' });
    comp(f)['enviar']();
    const req = http.expectOne(`${base}/proveedores`);
    expect(req.request.body).toEqual({ nombre: '', telefono: null, zonaActualId: null, tipoPersona: 'EMPRESA', dni: null,
      ruc: '20601234565', razonSocial: 'Lácteos del Valle S.A.C.' });
    req.flush({ ...natural, tipoPersona: 'EMPRESA', dni: null, ruc: '20601234565', razonSocial: 'Lácteos del Valle S.A.C.', nombre: 'Lácteos del Valle S.A.C.' });
    http.verify();
  });

  it('el botón de guardar no se deshabilita y los campos con problema quedan señalados y asociados a su mensaje', () => {
    const { f, http } = crear({ zonas: [] });
    expect(el(f).querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    el(f).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    f.detectChanges();
    http.expectNone(`${base}/proveedores`);
    expect(el(f).querySelector('#nombre-error')?.textContent).toContain('nombre es obligatorio');
    expect(el(f).querySelector('#nombre')?.getAttribute('aria-invalid')).toBe('true');
    expect(el(f).querySelector('#nombre')?.getAttribute('aria-describedby')).toBe('nombre-error');

    elegirTipo(f, 'EMPRESA');
    el(f).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    f.detectChanges();
    // el bloque de documentos nombra el primer problema (RUC); la razón social vacía se explica junto a su campo
    expect(el(f).querySelector('#documentos-error')?.textContent).toContain('RUC es obligatorio');
    expect(el(f).querySelector('#razonSocial-error')?.textContent).toContain('razón social es obligatoria');
    expect(el(f).querySelector('#razonSocial')?.getAttribute('aria-describedby')).toBe('razonSocial-error');

    // con el RUC bien escrito, el bloque pasa a nombrar la razón social y el aviso del campo no se duplica
    comp(f)['form'].patchValue({ ruc: '20601234565' });
    el(f).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    f.detectChanges();
    expect(el(f).querySelector('#documentos-error')?.textContent).toContain('razón social');
    expect(el(f).querySelector('#razonSocial-error')).toBeNull();
    expect(el(f).querySelector('#razonSocial')?.getAttribute('aria-describedby')).toBe('documentos-error');
  });

  it('una empresa sin razón social o con un RUC de persona natural no se envía', () => {
    const { f, http } = crear({ zonas: [] });
    elegirTipo(f, 'EMPRESA');
    comp(f)['form'].patchValue({ ruc: '20601234565' });
    comp(f)['enviar']();
    f.detectChanges();
    expect(el(f).querySelector('.error-bloque')?.textContent).toContain('razón social');
    comp(f)['form'].patchValue({ ruc: '10045678909', razonSocial: 'ACME' });
    comp(f)['enviar']();
    f.detectChanges();
    expect(el(f).querySelector('.error-bloque')?.textContent).toContain('empieza con 20');
    http.expectNone(`${base}/proveedores`);
    http.verify();
  });

  it('al editar un DNI anterior fuera de formato sin tocarlo, se conserva tal cual', () => {
    const { f, http } = crear({ zonas: [], proveedor: { ...natural, dni: '123 45' } });
    comp(f)['form'].patchValue({ nombre: 'Rosa Quispe Huamán' });
    comp(f)['enviar']();
    const req = http.expectOne(`${base}/proveedores/p-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.dni).toBe('123 45');
    expect(req.request.body.tipoPersona).toBe('NATURAL');
    req.flush({ ...natural, dni: '123 45', nombre: 'Rosa Quispe Huamán' });
    http.verify();
  });

  it('al editar una empresa cuyo nombre es su razón social, el nombre comercial empieza vacío', () => {
    const empresa: ProveedorAdminResponse = { ...natural, tipoPersona: 'EMPRESA', dni: null, ruc: '20601234565', razonSocial: 'ACME S.A.C.', nombre: 'ACME S.A.C.' };
    const { f } = crear({ zonas: [], proveedor: empresa });
    expect((el(f).querySelector('#nombre') as HTMLInputElement).value).toBe('');
    expect((el(f).querySelector('#razonSocial') as HTMLInputElement).value).toBe('ACME S.A.C.');
  });

  it('muestra el mensaje del servidor si DNI o RUC ya existen', () => {
    const { f, http } = crear({ zonas: [] });
    comp(f)['form'].patchValue({ nombre: 'Rosa', dni: '04567890' });
    comp(f)['enviar']();
    http.expectOne(`${base}/proveedores`).flush({ mensaje: 'Ya existe un proveedor con DNI 04567890' }, { status: 409, statusText: 'Conflict' });
    f.detectChanges();
    expect(el(f).querySelector('.server-error')?.textContent).toContain('Ya existe un proveedor con DNI 04567890');
    http.verify();
  });
});
