import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import type { Mock } from 'vitest';
import { Observable, Subject, of, throwError } from 'rxjs';
import { RecetasApi } from '../../../catalogos/data-access/recetas.api';
import { DisponibilidadProduccion, RecetaResponse } from '../../../catalogos/data-access/receta.models';
import { EstadoLote, LoteProduccion, PlanificarLoteRequest } from '../../data-access/lote-produccion.models';
import { LotesProduccionApi } from '../../data-access/lotes-produccion.api';
import { sumarDisponibilidad } from '../../domain/disponibilidad-multiple';
import { ProduccionMultipleDialog, ProduccionMultipleResultado } from './produccion-multiple-dialog';

const ERROR_RED = () => throwError(() => new HttpErrorResponse({ status: 0 }));

function calculo(litros = 100, stockLeche = 500): DisponibilidadProduccion {
  return {
    litrosSolicitados: litros,
    factor: 1,
    leche: {
      insumoId: null,
      nombre: 'Leche',
      unidadMedida: 'L',
      requerido: litros,
      disponible: stockLeche,
      suficiente: stockLeche >= litros,
      faltante: Math.max(0, litros - stockLeche)
    },
    insumos: [
      { insumoId: 'sal', nombre: 'Sal', unidadMedida: 'kg', requerido: 1, disponible: 1.5, suficiente: true, faltante: 0 }
    ],
    todoDisponible: stockLeche >= litros,
    cantidadEsperada: 10,
    unidadConteo: 'unidad',
    presentacionNombre: 'Pieza',
    litrosMaximos: null,
    cantidadEsperadaMaxima: null
  };
}

function receta(id: string, nombre: string): RecetaResponse {
  return {
    id,
    nombre,
    productoId: `p-${id}`,
    productoNombre: `Producto ${nombre}`,
    presentacionId: `pr-${id}`,
    presentacionNombre: 'Pieza',
    unidadConteo: 'unidad',
    litrosBase: 100,
    rendimientoBase: 10,
    activo: true,
    insumos: []
  };
}

function lote(id: string, estado: EstadoLote): LoteProduccion {
  return { id, estado } as LoteProduccion;
}

type Listar = () => Observable<RecetaResponse[]>;
type Calcular = (recetaId: string, litros: number) => Observable<DisponibilidadProduccion>;
type Planificar = (solicitud: PlanificarLoteRequest) => Observable<LoteProduccion>;
type Iniciar = (id: string) => Observable<LoteProduccion>;

interface ApisFalsas {
  recetas: { listar: Mock<Listar>; calcular: Mock<Calcular> };
  lotes: { planificar: Mock<Planificar>; iniciar: Mock<Iniciar> };
}

/** `stockSal`: lo que el servidor informa como disponible de sal en cada cálculo (compartido entre recetas). */
function preparar(stockSal = 10) {
  const apis: ApisFalsas = {
    recetas: {
      listar: vi.fn<Listar>(() => of([receta('r1', 'Yogurt'), receta('r2', 'Queso')])),
      calcular: vi.fn<Calcular>((_id, litros) => {
        const c = calculo(litros);
        c.insumos[0].disponible = stockSal;
        return of(c);
      })
    },
    lotes: {
      planificar: vi.fn<Planificar>((solicitud) => of(lote(solicitud.recetaId, 'PLANIFICADA'))),
      iniciar: vi.fn<Iniciar>((id) => of(lote(id, 'EN_PRODUCCION')))
    }
  };
  const cerrar = vi.fn();
  const confirmacion = new Subject<boolean>();
  const abrirConfirmacion = vi.fn(() => ({ closed: confirmacion.asObservable() }));

  TestBed.configureTestingModule({
    providers: [
      { provide: RecetasApi, useValue: apis.recetas },
      { provide: LotesProduccionApi, useValue: apis.lotes },
      { provide: DialogRef, useValue: { close: cerrar } },
      { provide: Dialog, useValue: { open: abrirConfirmacion } }
    ]
  });
  const fixture = TestBed.createComponent(ProduccionMultipleDialog);
  return { fixture, dialogo: fixture.componentInstance, apis, cerrar, confirmacion, abrirConfirmacion };
}

/** Agrega una segunda fila y elige receta y 100 L en cada una; espera a que se calcule el resumen. */
async function seleccionarDosRecetas(dialogo: ProduccionMultipleDialog): Promise<void> {
  dialogo['agregar']();
  dialogo['filas']().forEach((fila, i) => {
    dialogo['cambiar'](fila.uuid, 'recetaId', `r${i + 1}`);
    dialogo['cambiar'](fila.uuid, 'litros', 100);
  });
  await new Promise((resolver) => setTimeout(resolver, 350));
}

describe('sumarDisponibilidad', () => {
  it('suma los consumos compartidos sin duplicar el disponible ni convertir unidades', () => {
    const total = sumarDisponibilidad([calculo(), calculo()]);

    expect(total.leche.requerido).toBe(200);
    expect(total.leche.disponible).toBe(500);
    expect(total.insumos[0].requerido).toBe(2);
    expect(total.insumos[0].disponible).toBe(1.5);
    expect(total.insumos[0].faltante).toBe(0.5);
    expect(total.todoDisponible).toBe(false);
  });
});

describe('ProduccionMultipleDialog', () => {
  it('bloquea iniciar si las recetas por separado caben pero juntas no, y permite solo planificar', async () => {
    const { dialogo, apis } = preparar(1.5);
    await seleccionarDosRecetas(dialogo);

    await dialogo['enviar'](true);
    expect(apis.lotes.planificar).not.toHaveBeenCalled();

    await dialogo['enviar'](false);
    expect(apis.lotes.planificar).toHaveBeenCalledTimes(2);
    expect(apis.lotes.iniciar).not.toHaveBeenCalled();
  });

  it('planifica e inicia un lote distinto por fila, con sus propios litros y un uuidCliente propio', async () => {
    const { fixture, dialogo, apis } = preparar();
    await seleccionarDosRecetas(dialogo);

    await dialogo['enviar'](true);

    const solicitudes = apis.lotes.planificar.mock.calls.map(([solicitud]) => solicitud);
    expect(solicitudes.map((s) => s.recetaId)).toEqual(['r1', 'r2']);
    expect(solicitudes.map((s) => s.litros)).toEqual([100, 100]);
    expect(solicitudes[0].uuidCliente).not.toBe(solicitudes[1].uuidCliente);
    expect(apis.lotes.iniciar.mock.calls).toEqual([['r1'], ['r2']]);
    expect(dialogo['terminado']()).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Iniciada · leche e insumos descontados');
  });

  it('un fallo parcial conserva los éxitos, rotula las filas no enviadas y reintenta solo lo pendiente', async () => {
    const { dialogo, apis } = preparar();
    await seleccionarDosRecetas(dialogo);
    apis.lotes.iniciar.mockImplementationOnce((id) => of(lote(id, 'EN_PRODUCCION')));
    apis.lotes.iniciar.mockImplementationOnce(ERROR_RED);

    await dialogo['enviar'](true);

    const [primera, segunda] = dialogo['filas']();
    expect(primera.completada).toBe(true);
    expect(segunda.completada).toBe(false);
    expect(segunda.estado).toContain('inicio no confirmado');
    expect(dialogo['errorEnvio']()).toContain('Se detuvo el proceso');

    await dialogo['enviar'](true);

    expect(apis.lotes.planificar).toHaveBeenCalledTimes(2);
    expect(apis.lotes.iniciar.mock.calls).toEqual([['r1'], ['r2'], ['r2']]);
    expect(dialogo['terminado']()).toBe(true);
  });

  it('si falla la primera fila, la siguiente queda rotulada como pendiente y no se envía', async () => {
    const { dialogo, apis } = preparar();
    await seleccionarDosRecetas(dialogo);
    apis.lotes.planificar.mockImplementationOnce(ERROR_RED);

    await dialogo['enviar'](false);

    const [primera, segunda] = dialogo['filas']();
    expect(primera.estado).toBe('Registro no confirmado');
    expect(segunda.estado).toContain('Pendiente');
    expect(apis.lotes.planificar).toHaveBeenCalledTimes(1);
  });

  it('conserva la solicitud, el uuidCliente y el modo tras perder la respuesta de planificar', async () => {
    const { dialogo, apis } = preparar();
    await seleccionarDosRecetas(dialogo);
    apis.lotes.planificar.mockImplementationOnce(ERROR_RED);

    await dialogo['enviar'](false);
    const original = apis.lotes.planificar.mock.calls[0][0];

    // Intentar cambiar el formulario o el modo después del primer envío no tiene efecto.
    dialogo['cambiar'](dialogo['filas']()[0].uuid, 'litros', 999);
    dialogo['fecha'] = '2027-01-01';
    await dialogo['enviar'](true);

    expect(apis.lotes.planificar.mock.calls[1][0]).toEqual(original);
    expect(apis.lotes.iniciar).not.toHaveBeenCalled();
  });

  it('invalida el resumen al editar una fila y permite quitar filas', async () => {
    const { dialogo } = preparar();
    await seleccionarDosRecetas(dialogo);
    expect(dialogo['resumen']()).not.toBeNull();

    dialogo['cambiar'](dialogo['filas']()[1].uuid, 'litros', -1);
    expect(dialogo['resumen']()).toBeNull();

    dialogo['quitar'](dialogo['filas']()[1].uuid);
    await new Promise((resolver) => setTimeout(resolver, 350));
    expect(dialogo['resumen']()?.leche.requerido).toBe(100);
  });

  it('sin fecha explica por qué no se puede guardar ni iniciar, y el aviso desaparece al indicarla', async () => {
    const { fixture, dialogo, apis } = preparar();
    fixture.detectChanges();
    await seleccionarDosRecetas(dialogo);
    const el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    expect(el.querySelector('#fecha-multiple-error')).toBeNull();

    const escribir = (valor: string) => {
      const campo = el.querySelector<HTMLInputElement>('#fecha-multiple')!;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    escribir('');
    expect(el.querySelector('#fecha-multiple-error')?.textContent).toContain('Indica la fecha de producción');
    expect(el.querySelector('#fecha-multiple')?.getAttribute('aria-invalid')).toBe('true');
    await dialogo['enviar'](false);
    expect(apis.lotes.planificar).not.toHaveBeenCalled(); // sin fecha no se envía nada

    escribir('2026-10-28');
    expect(el.querySelector('#fecha-multiple-error')).toBeNull();
  });

  it('rechaza litros con más de dos decimales o fuera de rango', async () => {
    const { dialogo, apis } = preparar();
    const [fila] = dialogo['filas']();
    dialogo['cambiar'](fila.uuid, 'recetaId', 'r1');

    dialogo['cambiar'](fila.uuid, 'litros', 10.123);
    await new Promise((resolver) => setTimeout(resolver, 350));
    expect(apis.recetas.calcular).not.toHaveBeenCalled();
    expect(dialogo['resumen']()).toBeNull();

    dialogo['cambiar'](fila.uuid, 'litros', 10.12);
    await new Promise((resolver) => setTimeout(resolver, 350));
    expect(apis.recetas.calcular).toHaveBeenCalledWith('r1', 10.12);
  });

  it('impide el doble envío y el cierre mientras se confirma', async () => {
    const { dialogo, apis, cerrar, abrirConfirmacion } = preparar();
    await seleccionarDosRecetas(dialogo);
    const pendiente = new Subject<LoteProduccion>();
    apis.lotes.planificar.mockImplementationOnce(() => pendiente);

    const envio = dialogo['enviar'](true);
    await dialogo['enviar'](true);
    dialogo['cerrar']();

    expect(apis.lotes.planificar).toHaveBeenCalledTimes(1);
    expect(cerrar).not.toHaveBeenCalled();
    expect(abrirConfirmacion).not.toHaveBeenCalled();

    pendiente.next(lote('r1', 'PLANIFICADA'));
    pendiente.complete();
    await envio;
    expect(dialogo['terminado']()).toBe(true);
  });

  describe('al cerrar', () => {
    it('sin nada elegido cierra sin preguntar y sin resultado', () => {
      const { dialogo, cerrar, abrirConfirmacion } = preparar();

      dialogo['cerrar']();

      expect(abrirConfirmacion).not.toHaveBeenCalled();
      expect(cerrar).toHaveBeenCalledWith(undefined);
    });

    it('con una selección sin enviar pide confirmación con ConfirmDialog y solo cierra si se confirma', async () => {
      const { dialogo, cerrar, abrirConfirmacion, confirmacion } = preparar();
      await seleccionarDosRecetas(dialogo);

      dialogo['cerrar']();
      expect(abrirConfirmacion).toHaveBeenCalledTimes(1);
      expect(cerrar).not.toHaveBeenCalled();

      confirmacion.next(false);
      expect(cerrar).not.toHaveBeenCalled();

      confirmacion.next(true);
      expect(cerrar).toHaveBeenCalledWith(undefined);
    });

    it('termina con todo completado: cierra sin preguntar y devuelve los lotes, el modo y completo=true', async () => {
      const { dialogo, cerrar, abrirConfirmacion } = preparar();
      await seleccionarDosRecetas(dialogo);
      await dialogo['enviar'](true);

      dialogo['cerrar']();

      expect(abrirConfirmacion).not.toHaveBeenCalled();
      const resultado: ProduccionMultipleResultado = cerrar.mock.calls[0][0];
      expect(resultado.lotes.map((l) => l.id)).toEqual(['r1', 'r2']);
      expect(resultado.iniciar).toBe(true);
      expect(resultado.completo).toBe(true);
    });

    it('con operaciones pendientes pregunta y, al confirmar, devuelve lo guardado con completo=false', async () => {
      const { dialogo, apis, cerrar, abrirConfirmacion, confirmacion } = preparar();
      await seleccionarDosRecetas(dialogo);
      apis.lotes.iniciar.mockImplementationOnce((id) => of(lote(id, 'EN_PRODUCCION')));
      apis.lotes.iniciar.mockImplementationOnce(ERROR_RED);
      await dialogo['enviar'](true);

      dialogo['cerrar']();
      expect(abrirConfirmacion).toHaveBeenCalledTimes(1);
      confirmacion.next(true);

      const resultado: ProduccionMultipleResultado = cerrar.mock.calls[0][0];
      expect(resultado.lotes.map((l) => l.id)).toEqual(['r1', 'r2']);
      expect(resultado.completo).toBe(false);
    });
  });
});
