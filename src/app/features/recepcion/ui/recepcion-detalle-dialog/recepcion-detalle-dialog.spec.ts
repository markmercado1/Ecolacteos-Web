import { TestBed } from '@angular/core/testing';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { RecepcionDetalleDialog } from './recepcion-detalle-dialog';
import { JornadaDetalleDialog } from '../../../jornadas/ui/jornada-detalle-dialog/jornada-detalle-dialog';
import { RecepcionPlanta } from '../../data-access/recepcion.models';

const recepcionConJornada: RecepcionPlanta = {
  id: 'rp1',
  fecha: '2026-09-17',
  turno: 'UNICO',
  unidadId: 'u1',
  litrosCampo: 100,
  litrosPlanta: 98,
  diferenciaPct: -2,
  estado: 'ALERTA',
  litrosRegistradosAcopio: 100,
  registroAcopioIds: ['r1', 'r2'],
  jornadaId: 'j1',
  horaLlegada: '2026-09-17T10:00:00',
  diferenciaLitros: -2,
  observacion: 'Balanza calibrada en la mañana',
};

function setup(data: { recepcion: RecepcionPlanta; placa: string }) {
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close: vi.fn() } },
    ],
  });
}

describe('RecepcionDetalleDialog', () => {
  it('muestra campo/planta, diferencia, estado, observación y registros vinculados', () => {
    setup({ recepcion: recepcionConJornada, placa: 'ABC-123' });
    const f = TestBed.createComponent(RecepcionDetalleDialog);
    f.detectChanges();
    const texto = f.nativeElement.textContent;
    expect(texto).toContain('100');
    expect(texto).toContain('98');
    expect(texto).toContain('ALERTA');
    expect(texto).toContain('ABC-123');
    expect(texto).toContain('Balanza calibrada en la mañana');
    expect(texto).toContain('r1');
    expect(texto).toContain('r2');
  });

  it('el gráfico de campo vs. planta recibe exactamente los litros de la recepción', () => {
    setup({ recepcion: recepcionConJornada, placa: 'ABC-123' });
    const f = TestBed.createComponent(RecepcionDetalleDialog);
    f.detectChanges();
    expect(f.componentInstance['datosComparacion']()).toEqual([
      { etiqueta: 'Campo', valor: 100 },
      { etiqueta: 'Planta', valor: 98 },
    ]);
    expect(f.nativeElement.querySelector('ui-bar-chart')).toBeTruthy();
  });

  it('"Ver jornada vinculada" abre JornadaDetalleDialog con el jornadaId', () => {
    setup({ recepcion: recepcionConJornada, placa: 'ABC-123' });
    const f = TestBed.createComponent(RecepcionDetalleDialog);
    f.detectChanges();
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    f.componentInstance['verJornada']();
    expect(abrirSpy.mock.calls[0][0]).toBe(JornadaDetalleDialog);
    expect((abrirSpy.mock.calls[0][1] as { data: { id: string } }).data).toEqual({ id: 'j1' });
  });

  it('no muestra "Ver jornada vinculada" cuando la recepción no tiene jornada asociada', () => {
    setup({ recepcion: { ...recepcionConJornada, jornadaId: null }, placa: 'ABC-123' });
    const f = TestBed.createComponent(RecepcionDetalleDialog);
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Ver jornada vinculada');
  });
});
