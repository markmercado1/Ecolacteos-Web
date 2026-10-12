import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { RutasPage } from './rutas-page';

const base = environment.apiBaseUrl;

function crearPagina(http: HttpTestingController): RutasPage {
  const page = TestBed.createComponent(RutasPage).componentInstance;
  http.expectOne(`${base}/zonas/operativo`).flush([{ id: 'z-1', nombre: 'Huancayo Norte', activa: true }]);
  http.expectOne(`${base}/proveedores/operativo`).flush([
    { id: 'p-1', nombre: 'Máximo Quispe', zonaActualId: 'z-1', zonaActualNombre: 'Huancayo Norte', codigoQr: 'QR-1' },
    { id: 'p-2', nombre: 'Rosa Huamán', zonaActualId: 'z-1', zonaActualNombre: 'Huancayo Norte', codigoQr: 'QR-2' },
    { id: 'p-3', nombre: 'Otra Zona', zonaActualId: 'z-2', zonaActualNombre: 'El Tambo', codigoQr: 'QR-3' }
  ]);
  return page;
}

describe('RutasPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carga la ruta de la zona seleccionada y detecta que no hay cambios sin guardar recién cargada', () => {
    const page = crearPagina(http);
    page['seleccionarZona']('z-1');
    http.expectOne(`${base}/zonas/z-1/ruta`).flush([
      { id: 'r-1', proveedorId: 'p-1', proveedorNombre: 'Máximo Quispe', orden: 1, horaEstimada: '07:30' }
    ]);

    expect(page['paradas']().length).toBe(1);
    expect(page['hayCambiosSinGuardar']()).toBe(false);
  });

  it('proveedoresDisponibles excluye a quienes ya están en la ruta y a otras zonas', () => {
    const page = crearPagina(http);
    page['seleccionarZona']('z-1');
    http.expectOne(`${base}/zonas/z-1/ruta`).flush([
      { id: 'r-1', proveedorId: 'p-1', proveedorNombre: 'Máximo Quispe', orden: 1, horaEstimada: null }
    ]);

    expect(page['proveedoresDisponibles']().map((p) => p.id)).toEqual(['p-2']);
  });

  it('mover una parada cambia su posición y marca cambios sin guardar', () => {
    const page = crearPagina(http);
    page['seleccionarZona']('z-1');
    http.expectOne(`${base}/zonas/z-1/ruta`).flush([
      { id: 'r-1', proveedorId: 'p-1', proveedorNombre: 'Máximo Quispe', orden: 1, horaEstimada: null },
      { id: 'r-2', proveedorId: 'p-2', proveedorNombre: 'Rosa Huamán', orden: 2, horaEstimada: null }
    ]);

    page['moverParada'](0, 1);
    expect(page['paradas']().map((p) => p.proveedorId)).toEqual(['p-2', 'p-1']);
    expect(page['hayCambiosSinGuardar']()).toBe(true);
  });

  it('guardarRuta() no llama a la API si la ruta quedaría vacía', () => {
    const page = crearPagina(http);
    page['seleccionarZona']('z-1');
    http.expectOne(`${base}/zonas/z-1/ruta`).flush([]);

    page['guardarRuta']();
    http.expectNone(`${base}/zonas/z-1/ruta`);
  });

  it('guardarRuta() envía el orden recalculado (1-based) según la posición actual', () => {
    const page = crearPagina(http);
    page['seleccionarZona']('z-1');
    http.expectOne(`${base}/zonas/z-1/ruta`).flush([
      { id: 'r-1', proveedorId: 'p-1', proveedorNombre: 'Máximo Quispe', orden: 1, horaEstimada: null },
      { id: 'r-2', proveedorId: 'p-2', proveedorNombre: 'Rosa Huamán', orden: 2, horaEstimada: null }
    ]);
    page['moverParada'](0, 1);

    page['guardarRuta']();
    const req = http.expectOne((r) => r.url === `${base}/zonas/z-1/ruta` && r.method === 'PUT');
    expect(req.request.body.items).toEqual([
      { proveedorId: 'p-2', orden: 1, horaEstimada: null },
      { proveedorId: 'p-1', orden: 2, horaEstimada: null }
    ]);
    req.flush([
      { id: 'r-2', proveedorId: 'p-2', proveedorNombre: 'Rosa Huamán', orden: 1, horaEstimada: null },
      { id: 'r-1', proveedorId: 'p-1', proveedorNombre: 'Máximo Quispe', orden: 2, horaEstimada: null }
    ]);
    expect(page['hayCambiosSinGuardar']()).toBe(false);
  });
});
