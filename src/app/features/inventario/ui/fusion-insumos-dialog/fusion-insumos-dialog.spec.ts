import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DialogRef } from '@angular/cdk/dialog';
import { vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { FusionInsumosDialog } from './fusion-insumos-dialog';

const base = `${environment.apiBaseUrl}/admin/insumos`;
const grupo = {
  clave: 'azucar',
  insumos: [
    { id: 'a', nombre: 'azucar', unidadMedida: 'kg', activo: true, stock: 112, movimientos: 8 },
    { id: 'b', nombre: 'Azúcar', unidadMedida: 'kg', activo: true, stock: 98, movimientos: 2 }
  ]
};
const vista = (fusionable: boolean) => ({
  origenId: 'b', origenNombre: 'Azúcar', destinoId: 'a', destinoNombre: 'azucar', unidadMedida: 'kg', stockOrigen: 98, stockDestino: 112,
  stockResultante: 210, movimientos: 2, retiros: 0, recetas: 1, lotesProduccion: 1, informes: 0,
  impedimentos: fusionable ? [] : ['Las unidades de medida son distintas.'], fusionable
});

function crear() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DialogRef, useValue: { close } }]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(FusionInsumosDialog);
  f.detectChanges();
  http.expectOne(`${base}/duplicados`).flush({ indiceUnicoActivo: false, grupos: [grupo] });
  f.detectChanges();
  return { f, c: f.componentInstance as any, http, close };
}

describe('FusionInsumosDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('lista el grupo y conserva por defecto el insumo con más movimientos', () => {
    const { f } = crear();
    const texto = f.nativeElement.textContent as string;
    expect(texto).toContain('azucar');
    expect(texto).toContain('Azúcar');
    expect(texto).toContain('Se conserva');
    expect(f.nativeElement.querySelectorAll('input[type=radio]:checked').length).toBe(1);
  });

  it('revisar muestra la vista previa y confirmar fusiona y recarga los duplicados', () => {
    const { f, c, http } = crear();
    c['revisar'](grupo, 'b');
    http.expectOne((r) => r.url === `${base}/fusion/vista-previa` && r.params.get('origenId') === 'b' && r.params.get('destinoId') === 'a').flush(vista(true));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Stock resultante');
    expect(f.nativeElement.textContent).toContain('Confirmar fusión');

    c['confirmar'](vista(true));
    const req = http.expectOne(`${base}/fusion`);
    expect(req.request.body).toEqual({ origenId: 'b', destinoId: 'a' });
    req.flush({ id: 'f1', origenNombre: 'Azúcar', destinoNombre: 'azucar', unidadMedida: 'kg', stockDestinoDespues: 210 });
    http.expectOne(`${base}/duplicados`).flush({ indiceUnicoActivo: true, grupos: [] });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Fusionado «Azúcar» en «azucar»');
    expect(f.nativeElement.textContent).toContain('No hay insumos duplicados');
  });

  it('con impedimentos no ofrece confirmar y muestra el motivo', () => {
    const { f, c, http } = crear();
    c['revisar'](grupo, 'b');
    http.expectOne((r) => r.url === `${base}/fusion/vista-previa`).flush(vista(false));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Las unidades de medida son distintas.');
    expect(f.nativeElement.textContent).not.toContain('Confirmar fusión');
  });

  it('cambiar el insumo que se conserva descarta las vistas previas; el servidor puede rechazar la fusión', () => {
    const { f, c, http } = crear();
    c['revisar'](grupo, 'b');
    http.expectOne((r) => r.url === `${base}/fusion/vista-previa`).flush(vista(true));
    c['elegirDestino'](grupo, 'b');
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Stock resultante');

    c['confirmar'](vista(true));
    http.expectOne(`${base}/fusion`).flush({ mensaje: 'No se puede fusionar: unidades' }, { status: 409, statusText: 'Conflict' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No se puede fusionar');
  });

  it('cerrar devuelve true solo si se fusionó algo', () => {
    const { c, close } = crear();
    c['cerrar']();
    expect(close).toHaveBeenCalledWith(false);
  });
});
