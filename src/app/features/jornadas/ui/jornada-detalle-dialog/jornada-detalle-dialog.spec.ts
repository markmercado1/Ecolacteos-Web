import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { JornadaDetalleDialog } from './jornada-detalle-dialog';
import { JornadaDetalle } from '../../../acopios/acopios.api';

const base = environment.apiBaseUrl;

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { id: 'j1' } },
      { provide: DialogRef, useValue: { close: vi.fn() } },
    ],
  });
  return TestBed.inject(HttpTestingController);
}

describe('JornadaDetalleDialog', () => {
  it('muestra acopiador, vehículo, horas, proveedores visitados, acopios y litros esperados', () => {
    const http = setup();
    const f = TestBed.createComponent(JornadaDetalleDialog);
    const jornada: JornadaDetalle = {
      id: 'j1',
      uuidCliente: 'movil1',
      estado: 'REGRESANDO_A_PLANTA',
      unidadId: 'u1',
      unidadPlaca: 'ABC-123',
      acopiadorId: 'ac1',
      acopiadorNombre: 'Acopiador Uno',
      horaInicio: '2026-09-17T06:00:00',
      horaFin: '2026-09-17T09:30:00',
      litrosEsperados: 42.5,
      proveedoresVisitados: ['Productor Uno', 'Productor Dos'],
      acopios: [
        { registroAcopioId: 'r1', proveedorId: 'p1', proveedorNombre: 'Productor Uno', fechaHora: '2026-09-17T06:30:00', litros: 20 },
        { registroAcopioId: 'r2', proveedorId: 'p2', proveedorNombre: 'Productor Dos', fechaHora: '2026-09-17T07:00:00', litros: 22.5 },
      ],
    };
    http.expectOne(`${base}/jornadas/j1`).flush(jornada);
    f.detectChanges();
    const texto = f.nativeElement.textContent;
    expect(texto).toContain('Acopiador Uno');
    expect(texto).toContain('ABC-123');
    expect(texto).toContain('Productor Uno');
    expect(texto).toContain('Productor Dos');
    expect(texto).toContain('42.5');
    expect(f.nativeElement.querySelectorAll('.tabla-acopios tbody tr').length).toBe(2);
    http.verify();
  });

  it('conserva el error en vez de mostrar un detalle vacío', () => {
    const http = setup();
    const f = TestBed.createComponent(JornadaDetalleDialog);
    http.expectOne(`${base}/jornadas/j1`).flush({}, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    expect(f.componentInstance['error']()?.status).toBe(404);
    http.verify();
  });
});
