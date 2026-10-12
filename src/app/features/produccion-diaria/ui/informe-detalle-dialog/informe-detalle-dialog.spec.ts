import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { InformeDetalleDialog } from './informe-detalle-dialog';
import { InformeProduccionDiario } from '../../data-access/informe-produccion.models';

const informe: InformeProduccionDiario = {
  id: 'i0',
  uuidCliente: 'u0',
  fecha: '2026-01-01',
  quesosDiarios: 100,
  quesosReparados: 2,
  quesosDeRecorte: 1,
  totalQuesos: 103,
  recorteEnKilos: 4.5,
  responsableNombre: 'Ana',
  creadoEn: '2026-01-01T10:00:00',
  actualizadoPorNombre: 'Beto',
  actualizadoEn: '2026-01-01T12:00:00',
  insumos: [{ insumoId: 'ins1', insumoNombre: 'Cuajo', unidadMedida: 'unidades', cantidad: 3 }]
};

describe('InformeDetalleDialog', () => {
  it('muestra los datos recibidos sin hacer ninguna llamada a la API', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: { informe } },
        { provide: DialogRef, useValue: { close: vi.fn() } }
      ]
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(InformeDetalleDialog);
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('2026-01-01');
    expect(f.nativeElement.textContent).toContain('Cuajo');
    expect(f.nativeElement.textContent).toContain('última edición de Beto');
    http.verify(); // sin peticiones: todo viene de DIALOG_DATA
  });
});
