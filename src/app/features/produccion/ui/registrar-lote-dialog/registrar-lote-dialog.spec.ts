import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { TokenStoreService } from '../../../../core/auth/token-store.service';
import { UsuarioMeResponse } from '../../../../core/auth/auth.models';
import { RegistrarLoteDialog } from './registrar-lote-dialog';

const base = environment.apiBaseUrl;
const presentaciones = [{ id: 'pr1', productoId: 't1', nombre: 'Pieza', contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza', activo: true }];

function usuarioCon(rolNombre: UsuarioMeResponse['rolNombre']): UsuarioMeResponse {
  return { id: 'u-1', nombre: 'Ana', email: 'ana@ecolacteos.pe', rolNombre, activo: true, unidadesResponsable: [] };
}

function crear(rol: UsuarioMeResponse['rolNombre'] = 'PRODUCCION') {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DialogRef, useValue: { close: vi.fn() } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const tokenStore = TestBed.inject(TokenStoreService);
  tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon(rol) });
  const f = TestBed.createComponent(RegistrarLoteDialog);
  return { f, http, c: f.componentInstance };
}

/** Responde el saldo de leche y el catálogo de tipos de queso -- ambos se piden en el constructor,
 *  independientes uno del otro (ni el paso "leche" ni "Leche disponible" dependen del orden). */
function flushCargaInicial(http: HttpTestingController, opciones?: { saldo?: number; tipos?: unknown[] }) {
  http.expectOne(`${base}/inventario/leche/saldo`).flush({ litrosDisponibles: opciones?.saldo ?? 300 });
  http.expectOne(`${base}/sync/cambios`).flush({
    productos: opciones?.tipos ?? [{ id: 't1', nombre: 'Fresco', rendimientoEsperadoPct: 15, cicloCapital: 'RAPIDO', activo: true, presentaciones }],
  });
}

function llenarFormularioValido(c: RegistrarLoteDialog) {
  c['form'].controls.productoId.setValue('t1');
  c['form'].controls.litrosUsados.setValue(80);
  c['agregarFila']();
  c['detalles'].at(0).setValue({ presentacionId: 'pr1', cantidadObtenida: 40 });
}

describe('RegistrarLoteDialog', () => {
  afterEach(() => localStorage.clear());

  it('bloquea litros superiores al saldo y precisión no representable en el servidor', () => {
    const { c, http } = crear();
    flushCargaInicial(http, { saldo: 50 });
    llenarFormularioValido(c);
    c['continuarARevision']();
    expect(c['paso']()).toBe('leche');
    expect(c['errorRevision']()).toContain('supera el saldo');
    c['form'].controls.litrosUsados.setValue(1.001);
    expect(c['form'].controls.litrosUsados.invalid).toBe(true);
    http.expectNone(`${base}/lotes-produccion`);
    http.verify();
  });

  it('exige motivo fuera de rango y conserva ese motivo en reintentos inciertos', () => {
    const { c, http } = crear();
    flushCargaInicial(http, { tipos: [{
      id: 't1', nombre: 'Fresco', activo: true, presentaciones,
      rendimientoEsperadoPct: null, rangoRendimiento: { minimo: 10, maximo: 20, unidad: 'UNIDAD' }
    }] });
    llenarFormularioValido(c);
    c['continuarARevision']();
    expect(c['revision']().fueraDeRango).toBe(true);
    c['motivoRendimiento'].setValue('   ');
    c['confirmar']();
    http.expectNone(`${base}/lotes-produccion`);
    expect(c['errorEnvio']()).toContain('motivo');
    c['motivoRendimiento'].setValue('Producción excepcional comprobada');
    c['confirmar']();
    const original = http.expectOne(`${base}/lotes-produccion`);
    expect(original.request.body.motivoRendimiento).toBe('Producción excepcional comprobada');
    original.error(new ProgressEvent('error'));
    c['motivoRendimiento'].setValue('Modificación posterior');
    c['confirmar']();
    const reintento = http.expectOne(`${base}/lotes-produccion`);
    expect(reintento.request.body).toEqual(original.request.body);
    reintento.flush({ id: 'l1', detalles: [] });
    http.verify();
  });

  it('no permite confirmar sin haber revisado el resumen', () => {
    const { c, http } = crear();
    flushCargaInicial(http);
    llenarFormularioValido(c);
    c['confirmar']();
    http.expectNone(`${base}/lotes-produccion`);
    http.verify();
  });

  it('muestra la leche disponible consultada al abrir el diálogo', () => {
    const { c, http } = crear();
    flushCargaInicial(http, { saldo: 123.5 });
    expect(c['saldoDisponible']()).toBe(123.5);
    expect(c['cargandoSaldo']()).toBe(false);
    http.verify();
  });

  it('un error al consultar el saldo no bloquea el resto del formulario', () => {
    const { c, http } = crear();
    http.expectOne(`${base}/inventario/leche/saldo`).flush({}, { status: 500, statusText: 'Server Error' });
    http.expectOne(`${base}/sync/cambios`).flush({ productos: [{ id: 't1', nombre: 'Fresco', rendimientoEsperadoPct: 15, cicloCapital: 'RAPIDO', activo: true, presentaciones }] });
    expect(c['errorSaldo']()).toBeTruthy();
    expect(c['cargandoProductos']()).toBe(false); // el resto del formulario sigue funcionando
    http.verify();
  });

  it('PRODUCCION carga el catálogo de tipos de queso desde /sync/cambios, no desde /admin', () => {
    const { http } = crear('PRODUCCION');
    flushCargaInicial(http);
    http.verify();
  });

  it('ADMIN carga el catálogo desde /admin/productos', () => {
    const { http } = crear('ADMIN');
    http.expectOne(`${base}/inventario/leche/saldo`).flush({ litrosDisponibles: 300 });
    http.expectOne(`${base}/admin/productos`).flush([{ id: 't1', nombre: 'Fresco', rendimientoEsperadoPct: 15, cicloCapital: 'RAPIDO', activo: true, presentaciones }]);
    http.verify();
  });

  it('el formulario exige tipo de queso, litros y unidades válidos antes de avanzar al resumen', () => {
    const { c, http } = crear();
    flushCargaInicial(http);

    c['continuarARevision']();
    expect(c['paso']()).toBe('leche');
    expect(c['form'].controls.productoId.invalid).toBe(true);

    llenarFormularioValido(c);
    c['continuarARevision']();
    expect(c['paso']()).toBe('resumen');
    http.verify();
  });

  it('una fecha futura es inválida y bloquea el avance', () => {
    const { c, http } = crear();
    flushCargaInicial(http);
    const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    c['form'].controls.fecha.setValue(manana);
    llenarFormularioValido(c);
    c['continuarARevision']();
    expect(c['paso']()).toBe('leche');
    expect(c['form'].controls.fecha.errors?.['fechaFutura']).toBe(true);
    http.verify();
  });

  it('litrosUsados con más de 7 dígitos enteros es inválido (columna real precision=9,scale=2)', () => {
    const { c, http } = crear();
    flushCargaInicial(http);
    c['form'].controls.productoId.setValue('t1');
    c['form'].controls.litrosUsados.setValue(12345678);
    c['agregarFila']();
  c['detalles'].at(0).setValue({ presentacionId: 'pr1', cantidadObtenida: 40 });
    c['continuarARevision']();
    expect(c['paso']()).toBe('leche');
    expect(c['form'].controls.litrosUsados.errors?.['maxDigitosEnteros']).toBe(true);
    http.verify();
  });

  // Refactor de Producción, fase 2/4: litrosUsados=0 ya NO es válido (el modelo anterior lo admitía como
  // "sin cálculo de rendimiento"; en el nuevo modelo una producción siempre consume leche real > 0).
  it('litrosUsados=0 es inválido (el nuevo modelo exige consumir leche real, mayor que 0)', () => {
    const { c, http } = crear();
    flushCargaInicial(http);
    c['form'].controls.productoId.setValue('t1');
    c['form'].controls.litrosUsados.setValue(0);
    c['form'].controls.sinRendimiento.setValue(true);
    c['continuarARevision']();
    expect(c['paso']()).toBe('leche');
    expect(c['form'].controls.litrosUsados.errors?.['mayorQueCero']).toBe(true);
    http.verify();
  });

  it('sin rendimiento explícito sigue siendo válido (una producción real puede resultar en 0 unidades)', () => {
    const { c, http } = crear();
    flushCargaInicial(http);
    c['form'].controls.productoId.setValue('t1');
    c['form'].controls.litrosUsados.setValue(80);
    c['form'].controls.sinRendimiento.setValue(true);
    c['continuarARevision']();
    expect(c['paso']()).toBe('resumen');
    http.verify();
  });

  it('"unidades esperadas" se recalcula en vivo con el tipo de queso y los litros elegidos', () => {
    const { c, http } = crear();
    flushCargaInicial(http, { tipos: [{ id: 't1', nombre: 'Fresco', rendimientoEsperadoPct: 150, cicloCapital: 'RAPIDO', activo: true, presentaciones }] });

    expect(c['unidadesEsperadas']()).toBeNull(); // sin tipo/litros aun

    c['form'].controls.productoId.setValue('t1');
    c['form'].controls.litrosUsados.setValue(150);
    c['agregarFila']();
    c['detalles'].at(0).setValue({ presentacionId: 'pr1', cantidadObtenida: 225 });
    expect(c['unidadesEsperadas']()).toBe(225); // 150 L * 1.5 unidades/L (150%)

    c['form'].controls.litrosUsados.setValue(100);
    expect(c['unidadesEsperadas']()).toBe(150); // se actualiza al cambiar los litros, no queda "pegado"
    http.verify();
  });

  it('confirmar() envía uuidCliente sin registroAcopioIds y avanza a "resultado" con la respuesta del servidor', () => {
    const { c, http } = crear();
    flushCargaInicial(http);
    llenarFormularioValido(c);
    c['continuarARevision']();

    c['confirmar']();
    const req = http.expectOne(`${base}/lotes-produccion`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      uuidCliente: c['uuidCliente'],
      fecha: c['form'].controls.fecha.value,
      productoId: 't1',
      litrosUsados: 80,
      detalles: [{ presentacionId: 'pr1', cantidadObtenida: 40 }], motivoRendimiento: null, insumos: [],
    });
    req.flush({
      id: 'l1', fecha: c['form'].controls.fecha.value, productoNombre: 'Fresco', litrosUsados: 80,
      detalles: [{ presentacionId: 'pr1', cantidadObtenida: 40 }], motivoRendimiento: null, rendimientoPct: 50, rendimientoEsperadoPct: 15, registroAcopioIds: [],
      unidadesEsperadas: 12, rendimientoEsperadoPctSnapshot: 15,
      recepcionesConsumidas: [{ recepcionPlantaId: 'rp1', litrosConsumidos: 80 }],
    });

    expect(c['paso']()).toBe('resultado');
    expect(c['resultado']()?.id).toBe('l1');
    http.verify();
  });

  it('un doble clic en confirmar mientras se envía no duplica la petición', () => {
    const { c, http } = crear();
    flushCargaInicial(http);
    llenarFormularioValido(c);
    c['continuarARevision']();

    c['confirmar']();
    c['confirmar']();
    const req = http.expectOne(`${base}/lotes-produccion`);
    req.flush({
      id: 'l1', fecha: '2026-09-18', productoNombre: 'Fresco', litrosUsados: 80, detalles: [{ presentacionId: 'pr1', cantidadObtenida: 40 }], motivoRendimiento: null,
      rendimientoPct: 50, rendimientoEsperadoPct: 15, registroAcopioIds: [], unidadesEsperadas: 12,
      rendimientoEsperadoPctSnapshot: 15, recepcionesConsumidas: [],
    });
    http.verify();
  });

  it('un fallo de red reintenta con el payload congelado idéntico (mismo uuid, sin tomar cambios posteriores del formulario)', () => {
    const { c, http } = crear();
    flushCargaInicial(http);
    llenarFormularioValido(c);
    c['continuarARevision']();

    c['confirmar']();
    const primero = http.expectOne(`${base}/lotes-produccion`);
    primero.error(new ProgressEvent('network error'), { status: 0, statusText: 'Unknown Error' });
    expect(c['incierto']()).toBe(true);

    // El usuario cambia el formulario después del fallo de red -- no debe afectar el reintento.
    c['form'].controls.litrosUsados.setValue(999);

    c['confirmar']();
    const segundo = http.expectOne(`${base}/lotes-produccion`);
    expect(segundo.request.body.litrosUsados).toBe(80);
    expect(segundo.request.body.uuidCliente).toBe(c['uuidCliente']);
    segundo.flush({
      id: 'l1', fecha: '2026-09-18', productoNombre: 'Fresco', litrosUsados: 80, detalles: [{ presentacionId: 'pr1', cantidadObtenida: 40 }], motivoRendimiento: null,
      rendimientoPct: 50, rendimientoEsperadoPct: 15, registroAcopioIds: [], unidadesEsperadas: 12,
      rendimientoEsperadoPctSnapshot: 15, recepcionesConsumidas: [],
    });
    http.verify();
  });

  it('un error de saldo insuficiente (no red) libera el payload y muestra el mensaje real', () => {
    const { c, http } = crear();
    flushCargaInicial(http);
    llenarFormularioValido(c);
    c['continuarARevision']();

    c['confirmar']();
    http.expectOne(`${base}/lotes-produccion`).flush(
      { mensaje: 'Leche disponible insuficiente: se solicitaron 80 L, disponibles 50 L' },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(c['incierto']()).toBe(false);
    expect(c['errorEnvio']()).toBe('Leche disponible insuficiente: se solicitaron 80 L, disponibles 50 L');
    http.verify();
  });

  // ---- Asistente por pasos: 1 leche -> 2 insumos -> 3 producto obtenido -> 4 resumen ----

  it('recorre los pasos y envía los insumos usados junto con el lote', () => {
    const { c, http } = crear();
    flushCargaInicial(http);
    c['form'].controls.productoId.setValue('t1');
    c['form'].controls.litrosUsados.setValue(80);

    c['siguiente']();
    expect(c['paso']()).toBe('insumos');
    http.expectOne(`${base}/sync/cambios`).flush({
      insumos: [{ id: 'i1', nombre: 'Cuajo', unidadMedida: 'ml', activo: true }],
    });

    c['insumoParaAgregar'].set('i1');
    c['agregarInsumo']();
    c['actualizarCantidadInsumo']('i1', '25');
    c['siguiente']();
    expect(c['paso']()).toBe('obtenido');

    c['agregarFila']();
    c['detalles'].at(0).setValue({ presentacionId: 'pr1', cantidadObtenida: 40 });
    c['siguiente']();
    expect(c['paso']()).toBe('resumen');

    c['confirmar']();
    const req = http.expectOne(`${base}/lotes-produccion`);
    expect(req.request.body.insumos).toEqual([{ insumoId: 'i1', cantidad: 25 }]);
    http.verify();
  });

  it('sin insumos en el catálogo se puede continuar y registrar el lote igual', () => {
    const { c, http } = crear();
    flushCargaInicial(http);
    c['form'].controls.productoId.setValue('t1');
    c['form'].controls.litrosUsados.setValue(80);
    c['siguiente']();
    http.expectOne(`${base}/sync/cambios`).flush({ insumos: [] });

    c['siguiente']();
    expect(c['paso']()).toBe('obtenido');
    http.verify();
  });

  it('un insumo agregado sin cantidad bloquea el avance', () => {
    const { c, http } = crear();
    flushCargaInicial(http);
    c['form'].controls.productoId.setValue('t1');
    c['form'].controls.litrosUsados.setValue(80);
    c['siguiente']();
    http.expectOne(`${base}/sync/cambios`).flush({
      insumos: [{ id: 'i1', nombre: 'Sal', unidadMedida: 'kg', activo: true }],
    });
    c['insumoParaAgregar'].set('i1');
    c['agregarInsumo']();

    c['siguiente']();
    expect(c['paso']()).toBe('insumos');
    expect(c['errorPasoInsumos']()).toContain('cantidad');
    http.verify();
  });

  it('"Ver detalle" y "Cerrar" cierran el diálogo con el resultado correcto', () => {
    const { c, http } = crear();
    flushCargaInicial(http);
    llenarFormularioValido(c);
    c['continuarARevision']();
    c['confirmar']();
    http.expectOne(`${base}/lotes-produccion`).flush({
      id: 'l1', fecha: '2026-09-18', productoNombre: 'Fresco', litrosUsados: 80, detalles: [{ presentacionId: 'pr1', cantidadObtenida: 40 }], motivoRendimiento: null,
      rendimientoPct: 50, rendimientoEsperadoPct: 15, registroAcopioIds: [], unidadesEsperadas: 12,
      rendimientoEsperadoPctSnapshot: 15, recepcionesConsumidas: [],
    });

    const cerrar = vi.spyOn(c['dialogRef'], 'close');
    c['verDetalle']();
    expect(cerrar).toHaveBeenCalledWith({ lote: c['resultado'](), verDetalle: true });
    http.verify();
  });
});

