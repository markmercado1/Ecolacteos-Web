import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { RevisionZonasResponse } from '../../data-access/revision-zonas.models';
import { RevisionZonasPage } from './revision-zonas-page';

const base = environment.apiBaseUrl;

const revision: RevisionZonasResponse = {
  periodos: [
    { id: 'h-1', proveedorId: 'p-1', proveedorNombre: 'Absalón Ortiz Ramos', zonaNombre: 'Chugur', desde: '2026-09-30', hasta: '2026-09-29',
      nota: 'Periodo invertido (hasta anterior a desde)' },
    { id: 'h-2', proveedorId: 'p-1', proveedorNombre: 'Absalón Ortiz Ramos', zonaNombre: 'Bambamarca', desde: '2026-10-22', hasta: '2026-10-21', nota: null }
  ],
  totalEntregasSinZona: 3,
  limiteEntregas: 500,
  entregasSinZona: [
    { registroId: 'r-1', proveedorId: 'p-2', proveedorNombre: 'Irma Quiroz Huamán', fechaHora: '2026-07-20T05:30:58', litros: 25.71, motivo: 'DIA_DE_CAMBIO' },
    { registroId: 'r-2', proveedorId: 'p-3', proveedorNombre: 'Pedro Díaz', fechaHora: '2026-06-01T06:00:00', litros: 40, motivo: 'SIN_PERIODO' },
    { registroId: 'r-3', proveedorId: 'p-4', proveedorNombre: 'Ana Ruiz', fechaHora: '2026-06-02T06:00:00', litros: 10, motivo: 'OTRO' }
  ]
};

function crear(respuesta: RevisionZonasResponse | 'error') {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(RevisionZonasPage);
  const req = http.expectOne(`${base}/admin/zonas/revision`);
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

describe('RevisionZonasPage', () => {
  it('muestra los periodos marcados y las entregas sin zona tal como los informa el servidor, con su motivo en texto', () => {
    const { f, http } = crear(revision);
    expect(el(f).querySelector('[data-testid="total-periodos"]')?.textContent).toContain('2');
    expect(el(f).querySelector('[data-testid="total-entregas"]')?.textContent).toContain('3');
    const periodos = Array.from(el(f).querySelectorAll('[data-testid="periodo"]')) as HTMLElement[];
    expect(periodos.length).toBe(2);
    expect(periodos[0].textContent).toContain('Absalón Ortiz Ramos');
    expect(periodos[0].textContent).toContain('Chugur');
    expect(periodos[0].textContent).toContain('2026-09-30');
    expect(periodos[0].textContent).toContain('2026-09-29');
    expect(periodos[0].textContent).toContain('Invertido'); // marca con texto, no solo color
    const entregas = Array.from(el(f).querySelectorAll('[data-testid="entrega-sin-zona"]')) as HTMLElement[];
    expect(entregas.length).toBe(3);
    expect(entregas[0].textContent).toContain('Día de cambio de zona');
    expect(entregas[1].textContent).toContain('Ningún periodo de zona cubre esta fecha');
    expect(entregas[2].textContent).toContain('Otro motivo');
    expect(entregas[0].textContent).toContain('20/07/2026 05:30');
    http.verify();
  });

  it('es de solo lectura: ningún botón de corregir, asignar o resolver, y lo dice', () => {
    const { f, http } = crear(revision);
    expect(el(f).querySelectorAll('button').length).toBe(0);
    expect(texto(f)).toContain('solo lectura');
    expect(texto(f)).toContain('no corrige ningún dato histórico');
    http.verify();
  });

  it('sin casos pendientes muestra estados vacíos (cero real, no un error)', () => {
    const { f, http } = crear({ periodos: [], totalEntregasSinZona: 0, limiteEntregas: 500, entregasSinZona: [] });
    expect(texto(f)).toContain('No hay periodos marcados para revisión.');
    expect(texto(f)).toContain('No hay entregas sin zona.');
    expect(el(f).querySelector('[data-testid="total-entregas"]')?.textContent).toContain('0');
    http.verify();
  });

  it('avisa cuando el informe está limitado y hay más entregas sin zona que las mostradas', () => {
    const { f, http } = crear({ ...revision, totalEntregasSinZona: 1200, limiteEntregas: 3 });
    const aviso = el(f).querySelector('[data-testid="aviso-limite"]');
    expect(aviso?.textContent).toContain('primeras 3 de 1,200');
    http.verify();
  });

  it('no avisa de límite cuando se muestran todas', () => {
    const { f, http } = crear(revision);
    expect(el(f).querySelector('[data-testid="aviso-limite"]')).toBeNull();
    http.verify();
  });

  it('un error del servidor se muestra (no se convierte en una lista vacía) y permite reintentar', () => {
    const { f, http } = crear('error');
    expect(f.componentInstance['error']()).not.toBeNull();
    expect(el(f).querySelector('[data-testid="total-periodos"]')).toBeNull();
    expect(texto(f)).not.toContain('No hay entregas sin zona.');
    f.componentInstance['cargar']();
    http.expectOne(`${base}/admin/zonas/revision`).flush(revision);
    f.detectChanges();
    expect(f.componentInstance['error']()).toBeNull();
    expect(el(f).querySelectorAll('[data-testid="periodo"]').length).toBe(2);
    http.verify();
  });
});
