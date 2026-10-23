import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { AnalisisCalidad } from '../../../calidad/data-access/calidad.models';
import { AjusteCalidadEntregaResponse, LineaPagoResponse } from '../../data-access/pago.models';
import { PrecioCalidadDialog } from './precio-calidad-dialog';

const base = environment.apiBaseUrl;

const linea: LineaPagoResponse = {
  registroAcopioId: 'r-1', fechaHora: '2026-10-15T06:00:00', litrosOriginales: 100, litrosLiquidados: 100, litrosContabilizados: 100,
  litrosEfectivosActuales: 100, precioBase: 1, precioAplicado: 0.9, correccionAplicadaId: null, precioPropioDeCalidad: true,
  analisisCalidadId: 'a-0', motivoAjusteCalidad: 'Primer análisis'
};

const analisis = (id: string, folio: string, resultado = 'OBSERVADO'): AnalisisCalidad => ({
  id, registroAcopioId: 'r-1', folioMuestra: folio, agua: null, proteina: null, lactosa: null, densidad: null, temperatura: null, ph: null,
  aguaAnadida: false, resultado, creadoEn: '2026-10-15T07:00:00'
});

const respuesta: AjusteCalidadEntregaResponse = {
  id: 'ac-1', pagoId: 'pg-1', registroAcopioId: 'r-1', analisisCalidadId: 'a-1', analisisFolio: 'F-001', analisisResultado: 'OBSERVADO',
  litrosLiquidados: 100, precioNormal: 1, precioAnterior: 0.9, precioLitroNuevo: 0.8, efectoEnElTotal: -20, motivo: 'Agua', usuarioNombre: 'Admin',
  creadoEn: '2026-10-21T10:00:00'
};

function setup(analisisDeLaEntrega: AnalisisCalidad[] | 'error' = [analisis('a-1', 'F-001'), analisis('a-2', 'F-002', 'RECHAZADO')]) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { pagoId: 'pg-1', proveedorNombre: 'Alejandro Terrones', linea } },
      { provide: DialogRef, useValue: { close } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(PrecioCalidadDialog);
  const req = http.expectOne(`${base}/analisis-calidad/registro/r-1`);
  expect(req.request.method).toBe('GET');
  if (analisisDeLaEntrega === 'error') {
    req.flush({ mensaje: 'Error' }, { status: 500, statusText: 'Server Error' });
  } else {
    req.flush(analisisDeLaEntrega);
  }
  f.detectChanges();
  return { f, http, close };
}

const texto = (f: ComponentFixture<unknown>) => ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
const boton = (f: ComponentFixture<unknown>, etiqueta: string) =>
  Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes(etiqueta)) as HTMLButtonElement | undefined;
const comp = (f: ComponentFixture<PrecioCalidadDialog>) => f.componentInstance as unknown as Record<string, any>;

describe('PrecioCalidadDialog', () => {
  afterEach(() => vi.restoreAllMocks());

  it('muestra los datos reales de la entrega que informa el servidor sin calcular nada', () => {
    const { f, http } = setup();
    const t = texto(f);
    expect(t).toContain('Alejandro Terrones');
    expect(t).toContain('100 L');
    expect(t).toContain('Precio normal del pagoS/ 1.00');           // precio normal
    expect(t).toContain('Precio aplicado hoy a esta entregaS/ 0.90'); // precio aplicado hoy
    http.verify();
  });

  it('ofrece solo los análisis de ESA entrega (pedidos por registro) con folio y resultado', () => {
    const { f, http } = setup();
    const opciones = Array.from((f.nativeElement as HTMLElement).querySelectorAll('#analisisCalidadId option')).map((o) => o.textContent ?? '');
    expect(opciones.some((o) => o.includes('F-001') && o.includes('OBSERVADO'))).toBe(true);
    expect(opciones.some((o) => o.includes('F-002') && o.includes('RECHAZADO'))).toBe(true);
    http.verify();
  });

  it('sin análisis explica que no se puede fijar un precio de calidad y no muestra el formulario', () => {
    const { f, http } = setup([]);
    expect(texto(f)).toContain('no tiene análisis de calidad');
    expect((f.nativeElement as HTMLElement).querySelector('form')).toBeNull();
    http.verify();
  });

  it('si fallan los análisis muestra el error y permite reintentar', () => {
    const { f, http } = setup('error');
    expect(comp(f)['errorAnalisis']()).not.toBeNull();
    expect((f.nativeElement as HTMLElement).querySelector('form')).toBeNull();
    comp(f)['cargarAnalisis']();
    http.expectOne(`${base}/analisis-calidad/registro/r-1`).flush([analisis('a-1', 'F-001')]);
    f.detectChanges();
    expect(comp(f)['errorAnalisis']()).toBeNull();
    expect((f.nativeElement as HTMLElement).querySelector('form')).not.toBeNull();
    http.verify();
  });

  it('no deja guardar sin análisis, sin motivo (ni solo espacios) o con un precio inválido', () => {
    const { f, http } = setup();
    const form = comp(f)['form'];
    const guardar = () => boton(f, 'Fijar precio de calidad')!;

    form.setValue({ analisisCalidadId: '', precioLitroNuevo: 0.8, motivo: 'Motivo' }); // sin análisis
    f.detectChanges();
    expect(guardar().disabled).toBe(true);

    form.setValue({ analisisCalidadId: 'a-1', precioLitroNuevo: 0.8, motivo: '   ' }); // motivo en blanco
    f.detectChanges();
    expect(guardar().disabled).toBe(true);

    for (const precio of [0, -1, 0.8001, 1000, null]) {
      form.setValue({ analisisCalidadId: 'a-1', precioLitroNuevo: precio, motivo: 'Motivo' });
      f.detectChanges();
      expect(guardar().disabled, String(precio)).toBe(true);
    }

    form.setValue({ analisisCalidadId: 'a-1', precioLitroNuevo: 0.8, motivo: 'Motivo' });
    f.detectChanges();
    expect(guardar().disabled).toBe(false);
    http.verify();
  });

  it('no deja fijar el mismo precio que ya tiene la entrega', () => {
    const { f, http } = setup();
    comp(f)['form'].setValue({ analisisCalidadId: 'a-1', precioLitroNuevo: 0.9, motivo: 'Sin cambio' });
    f.detectChanges();
    expect(boton(f, 'Fijar precio de calidad')!.disabled).toBe(true);
    expect((f.nativeElement as HTMLElement).querySelector('[data-testid="sin-cambio"]')).not.toBeNull();
    comp(f)['guardar']();
    http.expectNone(`${base}/pagos/pg-1/lineas/r-1/ajuste-calidad`);
    http.verify();
  });

  it('guardar envía análisis, precio y motivo (recortado) a la entrega correcta y cierra con la respuesta del servidor', () => {
    const { f, http, close } = setup();
    comp(f)['form'].setValue({ analisisCalidadId: 'a-1', precioLitroNuevo: 0.8, motivo: '  Agua añadida  ' });

    comp(f)['guardar']();
    const req = http.expectOne(`${base}/pagos/pg-1/lineas/r-1/ajuste-calidad`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ precioLitroNuevo: 0.8, analisisCalidadId: 'a-1', motivo: 'Agua añadida' });
    req.flush(respuesta);

    expect(close).toHaveBeenCalledWith(respuesta);
    http.verify();
  });

  it('un error del servidor se muestra en el formulario, conserva lo tecleado y no cierra el diálogo', () => {
    const { f, http, close } = setup();
    comp(f)['form'].setValue({ analisisCalidadId: 'a-2', precioLitroNuevo: 0.8, motivo: 'Motivo' });
    comp(f)['guardar']();
    http.expectOne(`${base}/pagos/pg-1/lineas/r-1/ajuste-calidad`)
      .flush({ mensaje: 'El analisis de calidad indicado no corresponde a esta entrega' }, { status: 400, statusText: 'Bad Request' });
    f.detectChanges();

    expect(comp(f)['errorServidor']()).toContain('no corresponde a esta entrega');
    expect(texto(f)).toContain('no corresponde a esta entrega');
    expect(comp(f)['form'].getRawValue()).toEqual({ analisisCalidadId: 'a-2', precioLitroNuevo: 0.8, motivo: 'Motivo' });
    expect(comp(f)['guardando']()).toBe(false);
    expect(close).not.toHaveBeenCalled();
    http.verify();
  });

  it('evita un doble envío mientras guarda', () => {
    const { f, http } = setup();
    comp(f)['form'].setValue({ analisisCalidadId: 'a-1', precioLitroNuevo: 0.8, motivo: 'Motivo' });
    comp(f)['guardar']();
    comp(f)['guardar']();
    http.expectOne(`${base}/pagos/pg-1/lineas/r-1/ajuste-calidad`).flush(respuesta);
    http.verify();
  });
});
