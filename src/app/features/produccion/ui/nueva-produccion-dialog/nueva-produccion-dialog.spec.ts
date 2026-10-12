import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DialogRef } from '@angular/cdk/dialog';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { DisponibilidadProduccion, RecetaResponse } from '../../../catalogos/data-access/receta.models';
import { LoteProduccion } from '../../data-access/lote-produccion.models';
import { NuevaProduccionDialog } from './nueva-produccion-dialog';

const base = environment.apiBaseUrl;

const receta: RecetaResponse = {
  id: 'r1', nombre: 'Receta estándar', productoId: 'p1', productoNombre: 'Queso Andino', presentacionId: 'pr1',
  presentacionNombre: 'Pieza', unidadConteo: 'pieza', litrosBase: 100, rendimientoBase: 1, activo: true,
  insumos: [
    { insumoId: 'i1', insumoNombre: 'Cuajo', unidadMedida: 'g', cantidad: 1, insumoActivo: true },
    { insumoId: 'i2', insumoNombre: 'Sal', unidadMedida: 'kg', cantidad: 1, insumoActivo: true }
  ]
};

const linea = (insumoId: string | null, nombre: string, unidad: string, requerido: number, disponible: number) => ({
  insumoId, nombre, unidadMedida: unidad, requerido, disponible,
  faltante: Math.max(0, requerido - disponible), suficiente: disponible >= requerido
});

/** Respuesta de GET /recetas/r1/calculo para 1000 L con el stock indicado. */
function calculo(lecheDisponible: number, salDisponible: number): DisponibilidadProduccion {
  const leche = linea(null, 'Leche', 'L', 1000, lecheDisponible);
  const insumos = [linea('i1', 'Cuajo', 'g', 10, 15), linea('i2', 'Sal', 'kg', 10, salDisponible)];
  return {
    litrosSolicitados: 1000, factor: 10, leche, insumos, cantidadEsperada: 10, presentacionNombre: 'Pieza',
    unidadConteo: 'pieza', todoDisponible: leche.suficiente && insumos.every((l) => l.suficiente),
    litrosMaximos: Math.min(lecheDisponible, salDisponible * 100, 1500), cantidadEsperadaMaxima: 6
  };
}

const lote = (estado: LoteProduccion['estado']): LoteProduccion => ({
  id: 'l1', fecha: '2026-09-30', productoId: 'p1', productoNombre: 'Queso Andino', litrosUsados: 1000, detalles: [],
  rendimientoPct: null, rendimientoEsperadoPct: null, registroAcopioIds: [], unidadesEsperadas: null,
  rendimientoEsperadoPctSnapshot: null, recepcionesConsumidas: [], estado, recetaId: 'r1',
  recetaNombre: 'Receta estándar', cantidadEsperada: 10, presentacionEsperadaId: 'pr1', presentacionEsperadaNombre: 'Pieza'
});

function setup() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: DialogRef, useValue: { close } }]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(NuevaProduccionDialog);
  http.expectOne((r) => r.url === `${base}/recetas`).flush([receta, { ...receta, id: 'r2', activo: false }]);
  f.detectChanges();
  return { f, http, close, c: f.componentInstance };
}

/** Selecciona receta y litros, deja correr el debounce y responde el cálculo del backend. */
async function calcular(ctx: ReturnType<typeof setup>, respuesta: DisponibilidadProduccion) {
  ctx.c['form'].controls.recetaId.setValue('r1');
  ctx.c['form'].controls.litros.setValue(1000);
  await new Promise((r) => setTimeout(r, 350));
  const req = ctx.http.expectOne((r) => r.url === `${base}/recetas/r1/calculo`);
  expect(req.request.params.get('litros')).toBe('1000');
  req.flush(respuesta);
  ctx.f.detectChanges();
}

function boton(f: { nativeElement: HTMLElement }, texto: string): HTMLButtonElement {
  return Array.from(f.nativeElement.querySelectorAll('button')).find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;
}

describe('NuevaProduccionDialog', () => {
  it('solo ofrece recetas activas', () => {
    const { c } = setup();
    expect(c['recetas']().map((r) => r.id)).toEqual(['r1']);
  });

  it('muestra factor, insumos escalados y producción ESPERADA calculados por el backend; con todo disponible habilita Iniciar', async () => {
    const ctx = setup();
    await calcular(ctx, calculo(1500, 20));
    const texto = ctx.f.nativeElement.textContent;
    expect(texto).toContain('Factor de producción');
    expect(texto).toContain('Producción esperada');
    expect(texto).toContain('no una producción real');
    expect(texto).toContain('Todos los insumos están disponibles');
    expect(boton(ctx.f, 'Iniciar producción').disabled).toBe(false);
  });

  it('si falta sal deshabilita Iniciar, informa el faltante y permite guardar solo como planificada', async () => {
    const ctx = setup();
    await calcular(ctx, calculo(1500, 6));
    const texto = ctx.f.nativeElement.textContent;
    expect(texto).toContain('Stock insuficiente');
    expect(texto).toContain('Faltan 4 kg de Sal');
    expect(boton(ctx.f, 'Iniciar producción').disabled).toBe(true);
    expect(boton(ctx.f, 'Guardar como planificada').disabled).toBe(false);
  });

  it('si falta leche muestra solicitado/disponible/faltante y el máximo producible, sin cambiar la cantidad solo', async () => {
    const ctx = setup();
    await calcular(ctx, calculo(650, 20));
    const texto = ctx.f.nativeElement.textContent;
    expect(texto).toContain('Leche — solicitado');
    expect(texto).toContain('Máximo producible con el stock actual');
    expect(ctx.c['form'].controls.litros.value).toBe(1000); // nunca se ajusta en silencio

    boton(ctx.f, 'Usar').click(); // decisión explícita del usuario
    expect(ctx.c['form'].controls.litros.value).toBe(650);
  });

  it('un cálculo viejo no habilita acciones para litros distintos (espera el nuevo cálculo)', async () => {
    const ctx = setup();
    await calcular(ctx, calculo(1500, 20));
    ctx.c['form'].controls.litros.setValue(1200);
    ctx.f.detectChanges();
    expect(ctx.c['calculoVigente']()).toBeNull();
    expect(boton(ctx.f, 'Iniciar producción').disabled).toBe(true);
    await new Promise((r) => setTimeout(r, 350));
    ctx.http.expectOne((r) => r.url === `${base}/recetas/r1/calculo`).flush(calculo(1500, 20));
  });

  it('Guardar como planificada envía solo el plan (no inicia)', async () => {
    const ctx = setup();
    await calcular(ctx, calculo(1500, 6));
    boton(ctx.f, 'Guardar como planificada').click();
    const req = ctx.http.expectOne(`${base}/lotes-produccion/planificar`);
    expect(req.request.body).toEqual(expect.objectContaining({ recetaId: 'r1', litros: 1000 }));
    expect(req.request.body.uuidCliente).toBeTruthy();
    req.flush(lote('PLANIFICADA'));
    ctx.http.expectNone(`${base}/lotes-produccion/l1/iniciar`);
    expect(ctx.close).toHaveBeenCalledWith({ lote: lote('PLANIFICADA'), iniciada: false });
  });

  it('Iniciar planifica y luego inicia', async () => {
    const ctx = setup();
    await calcular(ctx, calculo(1500, 20));
    boton(ctx.f, 'Iniciar producción').click();
    ctx.http.expectOne(`${base}/lotes-produccion/planificar`).flush(lote('PLANIFICADA'));
    ctx.http.expectOne(`${base}/lotes-produccion/l1/iniciar`).flush(lote('EN_PRODUCCION'));
    expect(ctx.close).toHaveBeenCalledWith({ lote: lote('EN_PRODUCCION'), iniciada: true });
  });

  it('si iniciar falla tras planificar, informa que quedó planificada y reintenta sin volver a planificar', async () => {
    const ctx = setup();
    await calcular(ctx, calculo(1500, 20));
    boton(ctx.f, 'Iniciar producción').click();
    ctx.http.expectOne(`${base}/lotes-produccion/planificar`).flush(lote('PLANIFICADA'));
    ctx.http.expectOne(`${base}/lotes-produccion/l1/iniciar`).flush(
      { mensaje: 'Stock insuficiente de Sal' }, { status: 400, statusText: 'Bad Request' });
    ctx.f.detectChanges();
    expect(ctx.f.nativeElement.textContent).toContain('quedó guardada como planificada');
    expect(ctx.close).not.toHaveBeenCalled();

    ctx.c['iniciar']();
    ctx.http.expectNone(`${base}/lotes-produccion/planificar`);
    ctx.http.expectOne(`${base}/lotes-produccion/l1/iniciar`).flush(lote('EN_PRODUCCION'));
    expect(ctx.close).toHaveBeenCalledWith({ lote: lote('EN_PRODUCCION'), iniciada: true });
  });

  it('tras un error de red reintenta con el MISMO uuidCliente y datos', async () => {
    const ctx = setup();
    await calcular(ctx, calculo(1500, 20));
    boton(ctx.f, 'Guardar como planificada').click();
    const primero = ctx.http.expectOne(`${base}/lotes-produccion/planificar`);
    const uuid = primero.request.body.uuidCliente;
    primero.error(new ProgressEvent('error'), { status: 0 });
    expect(ctx.c['form'].disabled).toBe(true); // datos fijos hasta confirmar

    ctx.c['guardarPlanificada']();
    const segundo = ctx.http.expectOne(`${base}/lotes-produccion/planificar`);
    expect(segundo.request.body.uuidCliente).toBe(uuid);
    expect(segundo.request.body.litros).toBe(1000);
    segundo.flush(lote('PLANIFICADA'));
    expect(ctx.close).toHaveBeenCalled();
  });
});
