import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { ProveedorCompraSelectorComponent } from './proveedor-compra-selector';

const base = `${environment.apiBaseUrl}/proveedores-compra`;
const prov = { id: 'p1', nombre: 'Distribuidora Andina', ruc: '20100070970', telefono: null, contacto: null, activo: true, categorias: [], insumosHabituales: [] };

function crear() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(ProveedorCompraSelectorComponent);
  f.detectChanges();
  return { f, c: f.componentInstance as any, http };
}

describe('ProveedorCompraSelectorComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(HttpTestingController).verify();
  });

  it('busca por texto (con espera) solo entre proveedores activos y deja elegir uno', () => {
    const { f, c, http } = crear();
    c['escribir']('andina');
    vi.advanceTimersByTime(250);
    const req = http.expectOne((r) => r.url === base && r.params.get('busqueda') === 'andina' && r.params.get('soloActivos') === 'true');
    req.flush([prov]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Distribuidora Andina');
    c['elegir'](prov);
    f.detectChanges();
    expect(c.seleccionado()).toEqual(prov);
    expect(f.nativeElement.textContent).toContain('RUC 20100070970');
    c['quitar']();
    expect(c.seleccionado()).toBeNull();
  });

  it('«+ Nuevo proveedor» crea con nombre y RUC sin salir del flujo y lo deja elegido', () => {
    const { f, c, http } = crear();
    c['escribir']('Lacteos');
    vi.advanceTimersByTime(250);
    http.expectOne((r) => r.url === base).flush([]);
    c['empezarAlta']();
    f.detectChanges();
    expect(c.alta.getRawValue().nombre).toBe('Lacteos');   // el texto buscado pasa como nombre
    c.alta.patchValue({ ruc: '2060-0000-013' });
    c['crear']();
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nombre: 'Lacteos', ruc: '20600000013' });
    req.flush({ ...prov, id: 'p2', nombre: 'Lacteos', ruc: '20600000013' });
    expect(c.seleccionado().id).toBe('p2');
    expect(c.creando()).toBe(false);
  });

  it('rechaza un RUC que no tiene 11 dígitos y muestra el error del servidor (RUC repetido)', () => {
    const { c, http } = crear();
    c['empezarAlta']();
    c.alta.patchValue({ nombre: 'X', ruc: '123' });
    c['crear']();
    http.expectNone(base);
    expect(c.errorAlta()).toContain('11 dígitos');
    c.alta.patchValue({ ruc: '20600000013' });
    c['crear']();
    http.expectOne(base).flush({ mensaje: 'Ya existe un proveedor con ese RUC: «Lacteos».' }, { status: 409, statusText: 'Conflict' });
    expect(c.errorAlta()).toContain('Ya existe un proveedor con ese RUC');
    expect(c.seleccionado()).toBeNull();
  });
});
