import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { IngresoDocumentoDialog, IngresoDocumentoDialogData } from './ingreso-documento-dialog';

const url = `${environment.apiBaseUrl}/inventario/ingresos`;
const azucar = { id: 'a', nombre: 'azucar', unidadMedida: 'kg', activo: true, stock: 112 };
const sal = { id: 's', nombre: 'Sal', unidadMedida: 'kg', activo: true, stock: 5 };

function crear(data: IngresoDocumentoDialogData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DialogRef, useValue: { close } }, { provide: DIALOG_DATA, useValue: data }]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(IngresoDocumentoDialog);
  f.detectChanges();
  return { f, c: f.componentInstance as any, http, close };
}

describe('IngresoDocumentoDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('desde un insumo, la primera línea ya lo trae y el título lo nombra', () => {
    const { f, c } = crear({ insumos: [azucar, sal], insumoInicial: azucar });
    expect(c['lineas'].length).toBe(1);
    expect(c['lineas'].at(0).controls.insumoId.value).toBe('a');
    expect(f.nativeElement.querySelector('h2').textContent).toContain('azucar');
  });

  it('sin documento: envía una línea con su lote autogenerado (código vacío) y un identificador propio', () => {
    const { c, http, close } = crear({ insumos: [azucar, sal], insumoInicial: azucar });
    c['lineas'].at(0).patchValue({ cantidad: 100 });
    c['enviar']();
    const req = http.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.uuidCliente).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.request.body).toMatchObject({ proveedorId: null, tipoDocumento: 'SIN_DOCUMENTO', numeroDocumento: null, observacion: null });
    expect(req.request.body.lineas).toEqual([{ insumoId: 'a', cantidad: 100, codigoLote: null, loteProveedor: null, fechaVencimiento: null }]);
    req.flush({ id: 'd1', lineas: [] });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
  });

  it('una factura con varias líneas envía número, fecha, proveedor, vencimiento y lote del proveedor', () => {
    const { c, http } = crear({ insumos: [azucar, sal] });
    c['proveedor'].set({ id: 'p1', nombre: 'Distribuidora', ruc: '20100070970', activo: true, telefono: null, contacto: null, categorias: [], insumosHabituales: [] });
    c['form'].patchValue({ tipo: 'FACTURA', numero: ' F001-0234 ', fecha: '2026-10-28', observacion: ' Compra ' });
    c['lineas'].at(0).patchValue({ insumoId: 'a', cantidad: 100, vence: '2027-01-31', codigo: 'LOTE-A1', loteProveedor: 'P-77' });
    c['agregarLinea']();
    c['lineas'].at(1).patchValue({ insumoId: 's', cantidad: 40.5 });
    c['enviar']();
    const body = http.expectOne(url).request.body;
    expect(body).toMatchObject({ proveedorId: 'p1', tipoDocumento: 'FACTURA', numeroDocumento: 'F001-0234', fechaDocumento: '2026-10-28', observacion: 'Compra' });
    expect(body.lineas).toEqual([
      { insumoId: 'a', cantidad: 100, codigoLote: 'LOTE-A1', loteProveedor: 'P-77', fechaVencimiento: '2027-01-31' },
      { insumoId: 's', cantidad: 40.5, codigoLote: null, loteProveedor: null, fechaVencimiento: null }
    ]);
  });

  it('no envía sin insumo, con cantidad inválida o sin número cuando hay documento', () => {
    const { c, http } = crear({ insumos: [azucar, sal] });
    c['enviar']();                                                    // sin insumo ni cantidad
    c['lineas'].at(0).patchValue({ insumoId: 'a', cantidad: 1.234 });
    c['enviar']();                                                    // más de dos decimales
    c['lineas'].at(0).patchValue({ cantidad: 5 });
    c['form'].patchValue({ tipo: 'GUIA', numero: '  ' });
    c['enviar']();                                                    // documento sin número
    http.expectNone(url);
    c['form'].patchValue({ numero: 'G-1' });
    c['enviar']();
    http.expectOne(url);
  });

  it('se puede quitar una línea mientras queden dos o más, y el servidor puede rechazar el ingreso', () => {
    const { f, c, http } = crear({ insumos: [azucar, sal] });
    c['quitarLinea'](0);
    expect(c['lineas'].length).toBe(1);                              // la última no se quita
    c['agregarLinea']();
    c['quitarLinea'](1);
    expect(c['lineas'].length).toBe(1);
    c['lineas'].at(0).patchValue({ insumoId: 'a', cantidad: 3 });
    c['enviar']();
    http.expectOne(url).flush({ mensaje: 'El documento Factura F001-1 de «X» ya fue cargado.' }, { status: 409, statusText: 'Conflict' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('ya fue cargado');
    expect(c['enviando']()).toBe(false);                             // se puede corregir y reintentar
  });

  it('los insumos que el proveedor suele proveer aparecen primero', () => {
    const { c } = crear({ insumos: [azucar, sal] });
    c['proveedor'].set({ id: 'p1', nombre: 'D', ruc: '20100070970', activo: true, telefono: null, contacto: null, categorias: [],
      insumosHabituales: [{ id: 's', nombre: 'Sal', unidadMedida: 'kg' }] });
    expect(c['habituales']().map((i: { id: string }) => i.id)).toEqual(['s']);
    expect(c['otros']().map((i: { id: string }) => i.id)).toEqual(['a']);
  });

  const archivo = (nombre: string, tipo = 'image/jpeg') => new File([new Uint8Array([1, 2, 3])], nombre, { type: tipo });
  const entrada = (...a: File[]) => ({ files: a, value: 'x' }) as unknown as HTMLInputElement;

  it('el recibo se sube al documento ya registrado y recién entonces se cierra', () => {
    const { c, http, close } = crear({ insumos: [azucar, sal], insumoInicial: azucar });
    c['elegirArchivos'](entrada(archivo('recibo.jpg'), archivo('factura.pdf', 'application/pdf')));
    expect(c['archivos']().length).toBe(2);
    c['lineas'].at(0).patchValue({ cantidad: 10 });
    c['enviar']();
    http.expectOne(url).flush({ id: 'd1', lineas: [] });
    expect(close).not.toHaveBeenCalled();
    http.expectOne(`${url}/d1/adjuntos`).flush({ id: 'a1' }, { status: 201, statusText: 'Created' });
    http.expectOne(`${url}/d1/adjuntos`).flush({ id: 'a2' }, { status: 201, statusText: 'Created' });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
  });

  it('si un recibo falla, el ingreso queda registrado y se avisa cuál, sin perderlo ni repetirlo', () => {
    const { f, c, http, close } = crear({ insumos: [azucar, sal], insumoInicial: azucar });
    c['elegirArchivos'](entrada(archivo('recibo.jpg')));
    c['lineas'].at(0).patchValue({ cantidad: 10 });
    c['enviar']();
    http.expectOne(url).flush({ id: 'd1', lineas: [] });
    http.expectOne(`${url}/d1/adjuntos`).flush({ mensaje: 'x' }, { status: 400, statusText: 'Bad Request' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('El ingreso ya quedó registrado');
    expect(f.nativeElement.textContent).toContain('recibo.jpg');
    expect(close).not.toHaveBeenCalled();
    c['dialogRef'].close(c['registrado']());
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
  });

  it('rechaza antes de subir un archivo que no es imagen ni PDF o pesa más de 10 MB', () => {
    const { c } = crear({ insumos: [azucar, sal] });
    c['elegirArchivos'](entrada(archivo('nota.txt', 'text/plain')));
    expect(c['problemaArchivos']()).toContain('no es una imagen');
    expect(c['archivos']().length).toBe(0);
    c['elegirArchivos'](entrada(new File([new Uint8Array(11 * 1024 * 1024)], 'grande.pdf', { type: 'application/pdf' })));
    expect(c['problemaArchivos']()).toContain('10 MB');
  });
});
