import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { RevisionDocumentosResponse } from '../../data-access/proveedor.models';
import { RevisionDocumentosPage } from './revision-documentos-page';

const base = environment.apiBaseUrl;

const revision: RevisionDocumentosResponse = {
  totalProveedores: 42,
  proveedoresConObservaciones: 2,
  observaciones: [
    { proveedorId: 'p-1', nombre: 'Absalón Ortiz', tipoPersona: 'NATURAL', dni: '12345', ruc: null, activo: true, codigo: 'DNI_FORMATO',
      detalle: 'El DNI «12345» no tiene exactamente 8 dígitos (tiene 5).' },
    { proveedorId: 'p-2', nombre: 'Rosa Quispe', tipoPersona: 'NATURAL', dni: '10045678909', ruc: null, activo: false, codigo: 'DNI_PARECE_RUC',
      detalle: 'El campo DNI tiene 11 dígitos con forma de RUC.' }
  ]
};

function crear(respuesta: RevisionDocumentosResponse | 'error') {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(RevisionDocumentosPage);
  const req = http.expectOne(`${base}/admin/proveedores/revision-documentos`);
  expect(req.request.method).toBe('GET');
  if (respuesta === 'error') {
    req.flush({ mensaje: 'Sin permiso' }, { status: 403, statusText: 'Forbidden' });
  } else {
    req.flush(respuesta);
  }
  f.detectChanges();
  return { f, http };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const texto = (f: ComponentFixture<unknown>) => (el(f).textContent ?? '').replace(/\s+/g, ' ');

describe('RevisionDocumentosPage', () => {
  it('muestra cada observación con su etiqueta en texto y el detalle del servidor, sin acciones de corrección', () => {
    const { f, http } = crear(revision);
    expect(el(f).querySelector('[data-testid="total-proveedores"]')?.textContent).toContain('42');
    expect(el(f).querySelector('[data-testid="total-observados"]')?.textContent).toContain('2');
    const filas = Array.from(el(f).querySelectorAll('[data-testid="observacion"]')) as HTMLElement[];
    expect(filas.length).toBe(2);
    expect(filas[0].textContent).toContain('Absalón Ortiz');
    expect(filas[0].textContent).toContain('DNI fuera de formato');
    expect(filas[0].textContent).toContain('(tiene 5)');
    expect(filas[1].textContent).toContain('RUC escrito en el campo DNI');
    expect(filas[1].textContent).toContain('Inactivo');
    expect(texto(f)).toContain('solo lectura');
    expect(el(f).querySelectorAll('button').length).toBe(0); // no corrige nada
    http.verify();
  });

  it('sin observaciones lo dice; y un error del servidor se muestra con reintento', () => {
    const vacio = crear({ totalProveedores: 3, proveedoresConObservaciones: 0, observaciones: [] });
    expect(texto(vacio.f)).toContain('Todos los documentos cumplen las reglas actuales');
    TestBed.resetTestingModule();
    const conError = crear('error');
    expect(texto(conError.f)).toContain('Sin permiso');
  });
});
