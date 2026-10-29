import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { TokenStoreService } from '../../../../core/auth/token-store.service';
import { UsuarioMeResponse } from '../../../../core/auth/auth.models';
import { LoteDetalleDialog } from './lote-detalle-dialog';
import { LoteProduccion } from '../../data-access/lote-produccion.models';
import { Acopio } from '../../../acopios/acopios.api';
import { RecepcionPlanta } from '../../../recepcion/data-access/recepcion.models';

const base = environment.apiBaseUrl;

const registro: Acopio = {
  id: 'r1',
  uuidCliente: 'movil1',
  proveedorId: 'p1',
  proveedorNombre: 'Productor Uno',
  unidadId: 'u1',
  fechaHora: '2026-09-17T08:00:00',
  litros: 50,
  gpsLat: null,
  gpsLng: null,
  motivoObservacion: null,
  litrosPorVoz: null,
  sincronizadoEn: null,
  fotoUrl: null,
  disponibleParaLote: false,
  jornadaId: null,
};

const recepcion: RecepcionPlanta = {
  id: 'rp1',
  fecha: '2026-09-20',
  turno: 'UNICO',
  unidadId: 'u1',
  litrosCampo: 300,
  litrosPlanta: 300,
  diferenciaPct: 0,
  estado: 'OK',
  litrosRegistradosAcopio: 300,
  registroAcopioIds: [],
  jornadaId: null,
  horaLlegada: null,
  diferenciaLitros: 0,
  observacion: null,
};

/** Lote "viejo" (anterior al refactor de fase 2): trazabilidad por registroAcopioIds, sin snapshot. */
const loteViejo: LoteProduccion = {
  id: 'l1',
  fecha: '2026-09-17',
  productoId: 't1', productoNombre: 'Fresco',
  litrosUsados: 100,
  detalles: [{ presentacionId: 'pr1', presentacionNombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza', cantidadObtenida: 12 }],
  rendimientoPct: 12,
  rendimientoEsperadoPct: 15,
  registroAcopioIds: ['r1'],
  unidadesEsperadas: null,
  rendimientoEsperadoPctSnapshot: null,
  recepcionesConsumidas: [],
};

/** Lote "nuevo" (creado bajo el refactor de fase 2): trazabilidad por recepcionesConsumidas, con snapshot. */
const loteNuevo: LoteProduccion = {
  id: 'l1',
  fecha: '2026-09-20',
  productoId: 't1', productoNombre: 'Fresco',
  litrosUsados: 150,
  detalles: [{ presentacionId: 'pr1', presentacionNombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza', cantidadObtenida: 218 }],
  rendimientoPct: 145.33,
  rendimientoEsperadoPct: 150,
  registroAcopioIds: [],
  unidadesEsperadas: 225,
  rendimientoEsperadoPctSnapshot: 150,
  recepcionesConsumidas: [{ recepcionPlantaId: 'rp1', litrosConsumidos: 150 }],
};

function usuarioCon(rolNombre: UsuarioMeResponse['rolNombre']): UsuarioMeResponse {
  return { id: 'u-1', nombre: 'Ana', email: 'ana@ecolacteos.pe', rolNombre, activo: true, unidadesResponsable: [] };
}

/** Fase 2: al cargar un lote EN_PRODUCCION se consulta qué productos controlan vencimiento. */
function flushControl(http: HttpTestingController, productoIds: string[] = []): void {
  http.expectOne(`${base}/control-vencimiento/productos`).flush({ productoIds });
}

function setup(rol?: UsuarioMeResponse['rolNombre']) {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { id: 'l1' } },
      { provide: DialogRef, useValue: { close: vi.fn() } },
    ],
  });
  if (rol) {
    TestBed.inject(TokenStoreService).establecer({
      token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon(rol),
    });
  }
  return TestBed.inject(HttpTestingController);
}

describe('LoteDetalleDialog', () => {
  afterEach(() => localStorage.clear());

  it('muestra litros/unidades/rendimiento y resuelve la trazabilidad vieja a proveedor/fecha/litros', () => {
    const http = setup();
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush(loteViejo);
    http.expectOne(`${base}/registros-acopio/r1`).flush(registro);
    f.detectChanges();
    const texto = f.nativeElement.textContent;
    expect(texto).toContain('Fresco');
    expect(texto).toContain('12');
    expect(texto).toContain('15');
    expect(texto).toContain('Productor Uno');
    expect(f.componentInstance['datosRendimiento']()).toEqual([
      { etiqueta: 'Obtenido', valor: 12 },
      { etiqueta: 'Esperado', valor: 15 }, // sin snapshot: usa el rendimientoEsperadoPct actual del catálogo
    ]);
    http.verify();
  });

  it('muestra de qué lotes de insumo salió cada insumo (trazabilidad hacia atrás)', () => {
    const http = setup();
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush({
      ...loteNuevo,
      insumos: [{ insumoId: 'i1', insumoNombre: 'Azúcar', unidadMedida: 'kg', cantidad: 10, lotes: [
        { loteId: 'a', codigo: 'AZU-20261029-01', codigoProveedor: 'P-77', proveedorNombre: 'Distribuidora Andina', fechaVencimiento: '2027-01-31', cantidad: 7 },
        { loteId: 'b', codigo: 'INICIAL', codigoProveedor: null, proveedorNombre: null, fechaVencimiento: null, cantidad: 3 }
      ] }]
    });
    f.detectChanges();
    const texto = f.nativeElement.textContent;
    expect(texto).toContain('Lote AZU-20261029-01');
    expect(texto).toContain('Distribuidora Andina');
    expect(texto).toContain('vence 2027-01-31');
    expect(texto).toContain('Lote INICIAL');
  });

  it('rendimiento null se muestra como "Sin cálculo", no como 0%', () => {
    const http = setup();
    const f = TestBed.createComponent(LoteDetalleDialog);
    const lote: LoteProduccion = { ...loteViejo, litrosUsados: 0, detalles: [{ presentacionId: 'pr1', presentacionNombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza', cantidadObtenida: 0 }], rendimientoPct: null, registroAcopioIds: [] };
    http.expectOne(`${base}/lotes-produccion/l1`).flush(lote);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Sin cálculo');
    expect(f.nativeElement.textContent).not.toContain('0%');
    http.verify();
  });

  it('conserva el error 404 en vez de un detalle vacío', () => {
    const http = setup();
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush({}, { status: 404, statusText: 'Not Found' });
    expect(f.componentInstance['error']()?.status).toBe(404);
    http.verify();
  });

  it('un error al resolver la trazabilidad vieja no oculta litros/rendimiento ya cargados', () => {
    const http = setup();
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush(loteViejo);
    http.expectOne(`${base}/registros-acopio/r1`).flush({}, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Fresco');
    expect(f.nativeElement.textContent).toContain('12');
    expect(f.componentInstance['errorTrazabilidad']()?.status).toBe(403);
    http.verify();
  });

  // ---- Refactor de Producción, fase 4: trazabilidad nueva (recepcionesConsumidas) ----

  it('ADMIN resuelve la trazabilidad nueva a fecha/litros de cada recepción', () => {
    const http = setup('ADMIN');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush(loteNuevo);
    http.expectOne(`${base}/recepcion-planta/rp1`).flush(recepcion);
    f.detectChanges();
    const texto = f.nativeElement.textContent;
    expect(texto).toContain('2026-09-20');
    expect(texto).toContain('225'); // unidades esperadas
    expect(f.componentInstance['datosRendimiento']()).toEqual([
      { etiqueta: 'Obtenido', valor: 145.33 },
      { etiqueta: 'Esperado', valor: 150 }, // usa el snapshot, no el rendimientoEsperadoPct actual
    ]);
    http.verify();
  });

  it('PRODUCCION ve la trazabilidad nueva sin llamar a GET /recepcion-planta/{id} (no autorizado para ese rol)', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush(loteNuevo);
    f.detectChanges();
    // Ninguna llamada a /recepcion-planta/rp1 -- http.verify() falla si quedó una petición sin resolver.
    expect(f.nativeElement.textContent).toContain('150'); // litrosConsumidos, ya viene en la respuesta del lote
    expect(f.componentInstance['recepcionesConsumidas']()[0].recepcion).toBeNull();
    http.verify();
  });

  it('un error al resolver la trazabilidad nueva (ADMIN) degrada a mostrar solo litrosConsumidos', () => {
    const http = setup('ADMIN');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush(loteNuevo);
    http.expectOne(`${base}/recepcion-planta/rp1`).flush({}, { status: 500, statusText: 'Server Error' });
    f.detectChanges();
    expect(f.componentInstance['recepcionesConsumidas']()[0].recepcion).toBeNull();
    expect(f.nativeElement.textContent).toContain('150'); // litrosConsumidos sigue visible
    http.verify();
  });
});

// ---- V18: ciclo de vida de una producción planificada desde receta ----

const lotePlanificado: LoteProduccion = {
  id: 'l1', fecha: '2026-09-30', productoId: 'p1', productoNombre: 'Queso Andino', litrosUsados: 1000,
  detalles: [], rendimientoPct: null, rendimientoEsperadoPct: null, registroAcopioIds: [],
  unidadesEsperadas: null, rendimientoEsperadoPctSnapshot: null, recepcionesConsumidas: [],
  insumos: [
    { insumoId: 'i1', insumoNombre: 'Cuajo', unidadMedida: 'g', cantidad: 10 },
    { insumoId: 'i2', insumoNombre: 'Sal', unidadMedida: 'kg', cantidad: 10 }
  ],
  estado: 'PLANIFICADA', recetaId: 'r1', recetaNombre: 'Receta estándar', cantidadEsperada: 10,
  presentacionEsperadaId: 'pr1', presentacionEsperadaNombre: 'Pieza', diferencia: null,
  iniciadoEn: null, finalizadoEn: null, canceladoEn: null
};

const linea = (nombre: string, unidad: string, requerido: number, disponible: number) => ({
  insumoId: nombre === 'Leche' ? null : nombre, nombre, unidadMedida: unidad, requerido, disponible,
  faltante: Math.max(0, requerido - disponible), suficiente: disponible >= requerido
});

function disponibilidad(salDisponible: number) {
  const insumos = [linea('Cuajo', 'g', 10, 15), linea('Sal', 'kg', 10, salDisponible)];
  const leche = linea('Leche', 'L', 1000, 1500);
  return {
    litrosSolicitados: 1000, factor: null, leche, insumos, cantidadEsperada: 10, presentacionNombre: 'Pieza',
    unidadConteo: 'pieza', todoDisponible: insumos.every((l) => l.suficiente), litrosMaximos: null,
    cantidadEsperadaMaxima: null
  };
}

function boton(f: { nativeElement: HTMLElement }, texto: string): HTMLButtonElement {
  return Array.from(f.nativeElement.querySelectorAll('button')).find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;
}

describe('LoteDetalleDialog — producción planificada', () => {
  afterEach(() => localStorage.clear());

  it('PLANIFICADA: muestra la validación de stock y deshabilita Iniciar si falta sal, con el faltante exacto', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush(lotePlanificado);
    http.expectOne(`${base}/lotes-produccion/l1/disponibilidad`).flush(disponibilidad(6));
    f.detectChanges();

    const texto = f.nativeElement.textContent;
    expect(texto).toContain('Planificada');
    expect(texto).toContain('Aún no registrada'); // esperado ≠ real
    expect(texto).toContain('Faltan 4 kg de Sal');
    expect(boton(f, 'Iniciar producción').disabled).toBe(true);
    http.verify();
  });

  it('PLANIFICADA con todo disponible: Iniciar llama al backend y muestra el nuevo estado', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush(lotePlanificado);
    http.expectOne(`${base}/lotes-produccion/l1/disponibilidad`).flush(disponibilidad(20));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Todos los insumos están disponibles');

    boton(f, 'Iniciar producción').click();
    const req = http.expectOne(`${base}/lotes-produccion/l1/iniciar`);
    expect(req.request.method).toBe('POST');
    req.flush({ ...lotePlanificado, estado: 'EN_PRODUCCION', iniciadoEn: '2026-09-30T10:00:00' });
    flushControl(http); // al pasar a EN_PRODUCCION se consulta si el producto controla vencimiento
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('En producción');
    expect(f.nativeElement.textContent).toContain('Finalizar producción');
    http.verify();
  });

  it('si iniciar falla (stock cambió), muestra el error del servidor y vuelve a validar', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush(lotePlanificado);
    http.expectOne(`${base}/lotes-produccion/l1/disponibilidad`).flush(disponibilidad(20));
    f.componentInstance['iniciarProduccion']();
    http.expectOne(`${base}/lotes-produccion/l1/iniciar`).flush(
      { mensaje: 'Stock insuficiente de Sal: cambió mientras se procesaba la producción.' },
      { status: 400, statusText: 'Bad Request' }
    );
    http.expectOne(`${base}/lotes-produccion/l1/disponibilidad`).flush(disponibilidad(3));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('cambió mientras se procesaba');
    expect(f.nativeElement.textContent).toContain('Planificada');
    http.verify();
  });

  it('EN_PRODUCCION: finaliza con la cantidad REAL (distinta de la esperada) en la presentación de la receta', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush({ ...lotePlanificado, estado: 'EN_PRODUCCION' });
    flushControl(http);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Materia prima realmente utilizada'); // consumida al iniciar, no se edita

    f.componentInstance['cantidadObtenida'].setValue(9);
    f.componentInstance['finalizarProduccion']();
    const req = http.expectOne(`${base}/lotes-produccion/l1/finalizar`);
    expect(req.request.body).toEqual({ detalles: [{ presentacionId: 'pr1', cantidadObtenida: 9 }], motivoRendimiento: null });
    req.flush({
      ...lotePlanificado, estado: 'FINALIZADA', diferencia: -1,
      detalles: [{ presentacionId: 'pr1', presentacionNombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza', cantidadObtenida: 9 }]
    });
    f.detectChanges();

    const texto = f.nativeElement.textContent;
    expect(texto).toContain('Producción finalizada correctamente. Esperado: 10 · Obtenido: 9.');
    expect(texto).toContain('-1');
    expect(f.componentInstance['datosEsperadoObtenido']()).toEqual([
      { etiqueta: 'Esperado', valor: 10 },
      { etiqueta: 'Obtenido', valor: 9 }
    ]);
    http.verify();
  });

  it('EN_PRODUCCION: el CLIC real en "Finalizar producción" envía la petición (regresión: el form no emitía ngSubmit)', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush({ ...lotePlanificado, estado: 'EN_PRODUCCION' });
    flushControl(http);
    f.detectChanges();
    const input = f.nativeElement.querySelector('#cantidad-obtenida') as HTMLInputElement;
    input.value = '10';
    input.dispatchEvent(new Event('input'));
    f.detectChanges();

    boton(f, 'Finalizar producción').click();

    const req = http.expectOne(`${base}/lotes-produccion/l1/finalizar`);
    expect(req.request.body.detalles).toEqual([{ presentacionId: 'pr1', cantidadObtenida: 10 }]);
    req.flush({
      ...lotePlanificado, estado: 'FINALIZADA', diferencia: 0,
      detalles: [{ presentacionId: 'pr1', presentacionNombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza', cantidadObtenida: 10 }]
    });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Finalizada');
    http.verify();
  });

  it('EN_PRODUCCION: 0 obtenido se envía como lista vacía (lote perdido), nunca una línea en cero', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush({ ...lotePlanificado, estado: 'EN_PRODUCCION' });
    flushControl(http);
    f.componentInstance['cantidadObtenida'].setValue(0);
    f.componentInstance['finalizarProduccion']();
    expect(http.expectOne(`${base}/lotes-produccion/l1/finalizar`).request.body.detalles).toEqual([]);
  });

  it('EN_PRODUCCION: no envía una cantidad inválida', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush({ ...lotePlanificado, estado: 'EN_PRODUCCION' });
    flushControl(http);
    f.componentInstance['cantidadObtenida'].setValue(2.5);
    f.componentInstance['finalizarProduccion']();
    http.expectNone(`${base}/lotes-produccion/l1/finalizar`);
    f.componentInstance['cantidadObtenida'].setValue(null);
    f.componentInstance['finalizarProduccion']();
    http.expectNone(`${base}/lotes-produccion/l1/finalizar`);
  });

  // ---- Fase 2: producto con control de vencimiento ----

  it('Fase 2: un producto con control pide la fecha de vencimiento y la envía con la salida', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush({ ...lotePlanificado, estado: 'EN_PRODUCCION' });
    flushControl(http, ['p1']);
    f.detectChanges();
    expect(f.nativeElement.querySelector('#fecha-vencimiento')).not.toBeNull();

    f.componentInstance['cantidadObtenida'].setValue(9);
    f.componentInstance['fechaVencimiento'].setValue('2026-11-15');
    f.componentInstance['finalizarProduccion']();

    const req = http.expectOne(`${base}/lotes-produccion/l1/finalizar`);
    expect(req.request.body).toEqual({
      detalles: [{ presentacionId: 'pr1', cantidadObtenida: 9 }],
      motivoRendimiento: null,
      vencimientos: [{ presentacionId: 'pr1', fechaVencimiento: '2026-11-15' }]
    });
  });

  it('Fase 2: sin fecha de vencimiento un producto con control no se envía y se avisa en el formulario', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush({ ...lotePlanificado, estado: 'EN_PRODUCCION' });
    flushControl(http, ['p1']);

    f.componentInstance['cantidadObtenida'].setValue(9);
    f.componentInstance['finalizarProduccion']();
    f.detectChanges();

    http.expectNone(`${base}/lotes-produccion/l1/finalizar`);
    expect(f.componentInstance['faltaFecha']()).toBe(true);
    expect(f.nativeElement.textContent).toContain('Indica la fecha de vencimiento');
  });

  it('Fase 2: con control y 0 obtenido no hace falta fecha: se envía lista vacía de salidas y de vencimientos', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush({ ...lotePlanificado, estado: 'EN_PRODUCCION' });
    flushControl(http, ['p1']);

    f.componentInstance['cantidadObtenida'].setValue(0);
    f.componentInstance['finalizarProduccion']();

    const body = http.expectOne(`${base}/lotes-produccion/l1/finalizar`).request.body;
    expect(body.detalles).toEqual([]);
    expect(body.vencimientos).toEqual([]);
  });

  it('Fase 2: un producto SIN control no muestra el campo ni envía vencimientos (el backend los rechazaría)', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush({ ...lotePlanificado, estado: 'EN_PRODUCCION' });
    flushControl(http, ['otro-producto']);
    f.detectChanges();
    expect(f.nativeElement.querySelector('#fecha-vencimiento')).toBeNull();

    f.componentInstance['cantidadObtenida'].setValue(9);
    f.componentInstance['finalizarProduccion']();

    const body = http.expectOne(`${base}/lotes-produccion/l1/finalizar`).request.body;
    expect('vencimientos' in body).toBe(false);
  });

  it('Fase 2: mientras no se sabe si el producto controla vencimiento no se puede finalizar', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush({ ...lotePlanificado, estado: 'EN_PRODUCCION' });
    const pendiente = http.expectOne(`${base}/control-vencimiento/productos`);
    f.detectChanges();
    expect(boton(f, 'Finalizar producción').disabled).toBe(true);

    f.componentInstance['cantidadObtenida'].setValue(9);
    f.componentInstance['finalizarProduccion']();
    http.expectNone(`${base}/lotes-produccion/l1/finalizar`);
    expect(f.componentInstance['errorAccion']()).toContain('Todavía no se pudo verificar');

    pendiente.flush({ productoIds: [] });
    f.detectChanges();
    expect(boton(f, 'Finalizar producción').disabled).toBe(false);
  });

  it('Fase 2: si falla la consulta del control, se muestra el error con reintento y no se finaliza a ciegas', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush({ ...lotePlanificado, estado: 'EN_PRODUCCION' });
    http.expectOne(`${base}/control-vencimiento/productos`).flush({ mensaje: 'caído' }, { status: 500, statusText: 'Server Error' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No se pudo verificar si este producto controla vencimiento');
    expect(boton(f, 'Finalizar producción').disabled).toBe(true);

    boton(f, 'Reintentar').click();
    flushControl(http, []);
    f.detectChanges();
    expect(boton(f, 'Finalizar producción').disabled).toBe(false);
  });

  it('al cerrar tras un cambio de estado informa a la lista que debe recargarse', () => {
    const http = setup('PRODUCCION');
    const f = TestBed.createComponent(LoteDetalleDialog);
    const ref = TestBed.inject(DialogRef) as unknown as { close: ReturnType<typeof vi.fn> };
    http.expectOne(`${base}/lotes-produccion/l1`).flush(lotePlanificado);
    http.expectOne(`${base}/lotes-produccion/l1/disponibilidad`).flush(disponibilidad(20));
    f.componentInstance['iniciarProduccion']();
    http.expectOne(`${base}/lotes-produccion/l1/iniciar`).flush({ ...lotePlanificado, estado: 'EN_PRODUCCION' });
    f.componentInstance['cerrar']();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('un lote de un solo paso (sin estado en la respuesta) se trata como FINALIZADO', () => {
    const http = setup();
    const f = TestBed.createComponent(LoteDetalleDialog);
    http.expectOne(`${base}/lotes-produccion/l1`).flush({ ...loteViejo, registroAcopioIds: [] });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Finalizada');
    expect(boton(f, 'Iniciar producción')).toBeUndefined();
    http.verify();
  });
});

