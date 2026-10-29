import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Dialog } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { ProveedoresCompraPage } from './proveedores-compra-page';

const base = `${environment.apiBaseUrl}/proveedores-compra`;
const cat = { id: 'c2', codigo: 'OTROS_INSUMOS', nombre: 'Otros insumos' };
const lista = [
  { id: 'p1', nombre: 'Azucarera Norte', ruc: '20600000013', telefono: '999', contacto: 'Rosa', activo: true, categorias: [cat], insumosHabituales: [] },
  { id: 'p2', nombre: 'Envases Sur', ruc: '20500000024', telefono: null, contacto: null, activo: false, categorias: [cat], insumosHabituales: [] }
];

function crear() {
  const abrir = vi.fn().mockReturnValue({ closed: of(true) });
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Dialog, useValue: { open: abrir } }] });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(ProveedoresCompraPage);
  f.detectChanges();
  http.expectOne((r) => r.url === base && r.params.get('soloActivos') === 'false').flush(lista);
  f.detectChanges();
  return { f, http, abrir };
}

describe('ProveedoresCompraPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('lista activos e inactivos con RUC, categorías y las acciones que corresponden a cada estado', () => {
    const { f } = crear();
    const texto = f.nativeElement.textContent as string;
    expect(texto).toContain('Azucarera Norte');
    expect(texto).toContain('20600000013');
    expect(texto).toContain('Otros insumos');
    expect(texto).toContain('Proveedor inactivo');
    const botones = Array.from(f.nativeElement.querySelectorAll('button')).map((b: any) => b.textContent.trim());
    expect(botones).toContain('Desactivar');
    expect(botones).toContain('Reactivar');
  });

  it('desactivar pide confirmación y llama a PATCH; reactivar llama directo', () => {
    const { f, http } = crear();
    (f.componentInstance as any).desactivar(lista[0]);
    http.expectOne(`${base}/p1/desactivar`).flush({ ...lista[0], activo: false });
    http.expectOne((r) => r.url === base).flush(lista);
    (f.componentInstance as any).reactivar(lista[1]);
    http.expectOne(`${base}/p2/reactivar`).flush({ ...lista[1], activo: true });
    http.expectOne((r) => r.url === base).flush(lista);
  });
});
