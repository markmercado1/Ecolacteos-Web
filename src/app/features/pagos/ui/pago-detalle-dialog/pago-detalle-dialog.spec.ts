import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { AjusteCalidadEntregaResponse, AjustePagoResponse, AjustePrecioPagoResponse, PagoResponse } from '../../data-access/pago.models';
import { EntregasPagoDialog } from '../entregas-pago-dialog/entregas-pago-dialog';
import { PagoDetalleDialog } from './pago-detalle-dialog';

const base = environment.apiBaseUrl;

/** 100 L a S/ 1.00 = S/ 100 (el ejemplo del negocio). */
const pagoBase: PagoResponse = {
  id: 'pg-1', proveedorId: 'p-1', proveedorNombre: 'Alejandro Terrones Huamán',
  semanaInicio: '2026-10-14', semanaFin: '2026-10-21', litrosTotales: 100, precioLitro: 1, total: 100,
  comprobanteGenerado: false, registroAcopioIds: ['r-1'], precioLitroEfectivo: 1, totalAPagar: 100, ajusteCalidad: 0
};

const pagoAjustado: PagoResponse = { ...pagoBase, precioLitroEfectivo: 1.2, totalAPagar: 120 };

const ajusteHistorial: AjustePrecioPagoResponse = {
  id: 'ap-1', pagoId: 'pg-1', precioLitroAnterior: 1, precioLitroNuevo: 1.2, totalAnterior: 100, totalNuevo: 120,
  motivo: 'Reconocimiento por calidad', usuarioNombre: 'Administrador', creadoEn: '2026-10-21T10:30:00'
};

function setup(pago: PagoResponse, esAdmin = true) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { pago, esAdmin } },
      { provide: DialogRef, useValue: { close } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(PagoDetalleDialog);
  http.expectOne(`${base}/pagos/${pago.id}/ajustes`).flush([]);
  return { f, http, close };
}

function cargarHistorial(http: HttpTestingController, historial: AjustePrecioPagoResponse[] = []): void {
  http.expectOne(`${base}/pagos/pg-1/ajustes-precio`).flush(historial);
}

const texto = (f: ComponentFixture<unknown>) => ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
const boton = (f: ComponentFixture<unknown>, etiqueta: string) =>
  Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes(etiqueta)) as HTMLButtonElement | undefined;
const comp = (f: ComponentFixture<PagoDetalleDialog>) => f.componentInstance as unknown as Record<string, any>;

describe('PagoDetalleDialog · ajuste de precio y boleta', () => {
  afterEach(() => vi.restoreAllMocks());

  it('un pago sin ajustes muestra precio y total y no muestra «Total a pagar»', () => {
    const { f, http } = setup(pagoBase);
    cargarHistorial(http);
    f.detectChanges();
    const t = texto(f);
    expect(t).toContain('S/ 1.00');
    expect(t).toContain('S/ 100.00');
    expect(t).not.toContain('Total a pagar');
    expect(t).toContain('El precio de este pago no se ha ajustado.');
    http.verify();
  });

  it('un pago ajustado muestra original, precio ajustado y el total a pagar', () => {
    const { f, http } = setup(pagoAjustado);
    cargarHistorial(http, [ajusteHistorial]);
    f.detectChanges();
    const t = texto(f);
    expect(t).toContain('Precio por litro original');
    expect(t).toContain('Total original');
    expect(t).toContain('Precio por litro ajustado');
    expect((f.nativeElement as HTMLElement).querySelector('[data-testid="total-a-pagar"]')?.textContent).toContain('S/ 120.00');
    expect(t).toContain('S/ 1.00 → S/ 1.20');
    expect(t).toContain('Reconocimiento por calidad');
    expect(t).toContain('Administrador');
    http.verify();
  });

  it('solo ADMIN ve «Ajustar pago»; RECEPCION puede ver el historial pero no ajustar', () => {
    const admin = setup(pagoBase, true);
    cargarHistorial(admin.http);
    admin.f.detectChanges();
    expect(boton(admin.f, 'Ajustar pago')).toBeDefined();
    admin.http.verify();

    TestBed.resetTestingModule();
    const recepcion = setup(pagoBase, false);
    cargarHistorial(recepcion.http);
    recepcion.f.detectChanges();
    expect(boton(recepcion.f, 'Ajustar pago')).toBeUndefined();
    expect(boton(recepcion.f, 'Ver boleta')).toBeDefined(); // RECEPCION sí puede ver la boleta
    recepcion.http.verify();
  });

  it('la vista previa recalcula el total al teclear el nuevo precio (100 L: 1.00 → 1.20 = S/ 120.00)', () => {
    const { f, http } = setup(pagoBase);
    cargarHistorial(http);
    comp(f)['abrirAjuste']();
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('[data-testid="vista-previa"]')).toBeNull(); // sin precio, sin vista

    comp(f)['form'].patchValue({ precioLitroNuevo: 1.2 });
    f.detectChanges();
    const vista = texto(f);
    expect(vista).toContain('100 L × S/ 1.20 = S/ 120.00');
    expect(vista).toContain('+S/ 20.00 frente al total a pagar actual (S/ 100.00)');
    http.verify();
  });

  it('un precio a la baja muestra la diferencia en negativo', () => {
    const { f, http } = setup(pagoBase);
    cargarHistorial(http);
    comp(f)['abrirAjuste']();
    comp(f)['form'].patchValue({ precioLitroNuevo: 0.8 });
    f.detectChanges();
    expect(texto(f)).toContain('100 L × S/ 0.80 = S/ 80.00');
    expect(texto(f)).toContain('−S/ 20.00 frente al total a pagar actual');
    http.verify();
  });

  it('no deja aplicar sin motivo, con precio cero/negativo o con más de 3 decimales', () => {
    const { f, http } = setup(pagoBase);
    cargarHistorial(http);
    comp(f)['abrirAjuste']();
    const form = comp(f)['form'];

    form.setValue({ precioLitroNuevo: 1.2, motivo: '   ' }); // motivo en blanco
    f.detectChanges();
    expect(boton(f, 'Aplicar ajuste')!.disabled).toBe(true);

    for (const precio of [0, -1, 1.2345, 1000, null]) {
      form.setValue({ precioLitroNuevo: precio, motivo: 'Motivo' });
      f.detectChanges();
      expect(boton(f, 'Aplicar ajuste')!.disabled, String(precio)).toBe(true);
    }

    form.setValue({ precioLitroNuevo: 1.2, motivo: 'Motivo' });
    f.detectChanges();
    expect(boton(f, 'Aplicar ajuste')!.disabled).toBe(false);
    http.verify();
  });

  it('no deja aplicar el mismo precio que ya tiene el pago', () => {
    const { f, http } = setup(pagoAjustado); // efectivo 1.20
    cargarHistorial(http, [ajusteHistorial]);
    comp(f)['abrirAjuste']();
    comp(f)['form'].setValue({ precioLitroNuevo: 1.2, motivo: 'Sin cambio' });
    f.detectChanges();
    expect(boton(f, 'Aplicar ajuste')!.disabled).toBe(true);
    expect(texto(f)).toContain('Ese ya es el precio de este pago.');
    comp(f)['aplicarAjuste']();
    http.expectNone(`${base}/pagos/pg-1/ajuste-precio`);
    http.verify();
  });

  it('aplicar envía precio y motivo (sin espacios sobrantes) y luego relee el pago y el historial del servidor', () => {
    const { f, http } = setup(pagoBase);
    const exito = vi.spyOn(TestBed.inject(ToastService), 'exito');
    cargarHistorial(http);
    comp(f)['abrirAjuste']();
    comp(f)['form'].setValue({ precioLitroNuevo: 1.2, motivo: '  Reconocimiento por calidad  ' });

    comp(f)['aplicarAjuste']();
    const post = http.expectOne(`${base}/pagos/pg-1/ajuste-precio`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ precioLitroNuevo: 1.2, motivo: 'Reconocimiento por calidad' });
    post.flush(ajusteHistorial);

    http.expectOne(`${base}/pagos/pg-1`).flush(pagoAjustado); // el total lo calcula el servidor
    http.expectOne(`${base}/pagos/pg-1/ajustes-precio`).flush([ajusteHistorial]);
    f.detectChanges();

    expect(comp(f)['pago']().totalAPagar).toBe(120);
    expect(comp(f)['cambiado']()).toBe(true); // la lista de pagos se recargará al cerrar
    expect(comp(f)['ajustando']()).toBe(false);
    expect((f.nativeElement as HTMLElement).querySelector('[data-testid="total-a-pagar"]')?.textContent).toContain('S/ 120.00');
    expect(exito).toHaveBeenCalledWith('Precio del pago ajustado.');
    http.verify();
  });

  it('un error del servidor se muestra en el formulario y conserva lo tecleado', () => {
    const { f, http } = setup(pagoBase);
    cargarHistorial(http);
    comp(f)['abrirAjuste']();
    comp(f)['form'].setValue({ precioLitroNuevo: 1.2, motivo: 'Motivo' });
    comp(f)['aplicarAjuste']();
    http.expectOne(`${base}/pagos/pg-1/ajuste-precio`).flush({ mensaje: 'El motivo es obligatorio' }, { status: 400, statusText: 'Bad Request' });
    f.detectChanges();

    expect(comp(f)['errorAjuste']()).toContain('motivo');
    expect(comp(f)['ajustando']()).toBe(true);
    expect(comp(f)['form'].getRawValue()).toEqual({ precioLitroNuevo: 1.2, motivo: 'Motivo' });
    expect(comp(f)['cambiado']()).toBe(false);
    http.verify();
  });

  it('Ver boleta pide el PDF con la sesión (blob) y lo abre en la pestaña ya abierta', () => {
    const ventana = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(ventana as unknown as Window);
    const crearUrl = vi.fn().mockReturnValue('blob:boleta-1');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: crearUrl, revokeObjectURL: vi.fn() }));
    const { f, http } = setup(pagoAjustado);
    cargarHistorial(http, [ajusteHistorial]);

    comp(f)['verBoleta']();
    const req = http.expectOne(`${base}/pagos/pg-1/boleta`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));

    expect(window.open).toHaveBeenCalledWith('', '_blank'); // se abre en el mismo clic: sin bloqueo de emergentes
    expect(crearUrl).toHaveBeenCalled();
    expect(ventana.location.href).toBe('blob:boleta-1');
    expect(comp(f)['abriendoBoleta']()).toBe(false);
    http.verify();
  });

  it('si el navegador bloquea la ventana avisa en vez de fallar en silencio', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const { f, http } = setup(pagoBase);
    cargarHistorial(http);
    const toast = vi.spyOn(TestBed.inject(ToastService), 'error');

    comp(f)['verBoleta']();
    http.expectOne(`${base}/pagos/pg-1/boleta`).flush(new Blob(['x'], { type: 'application/pdf' }));

    expect(toast).toHaveBeenCalledWith(expect.stringContaining('bloqueó'));
    http.verify();
  });

  it('si la boleta falla cierra la pestaña vacía y muestra el error', () => {
    const ventana = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(ventana as unknown as Window);
    const { f, http } = setup(pagoBase);
    cargarHistorial(http);
    const toast = vi.spyOn(TestBed.inject(ToastService), 'error');

    comp(f)['verBoleta']();
    http.expectOne(`${base}/pagos/pg-1/boleta`).flush(new Blob(), { status: 404, statusText: 'Not Found' });

    expect(ventana.close).toHaveBeenCalled();
    expect(toast).toHaveBeenCalled();
    expect(comp(f)['abriendoBoleta']()).toBe(false);
    http.verify();
  });

  it('ya no muestra el texto técnico del endpoint', () => {
    const { f, http } = setup(pagoBase);
    cargarHistorial(http);
    f.detectChanges();
    expect(texto(f)).not.toContain('GET /api/pagos');
    http.verify();
  });
});


// ---------------------------------------------------------------- Fases B y C: litros, ajustes y precios de calidad

/** 600 L a S/ 1.00 con 100 L a S/ 0.90: el servidor devuelve el total reconocido y el ajuste de calidad. */
const pagoConCalidad: PagoResponse = { ...pagoBase, litrosTotales: 600, total: 600, totalAPagar: 590, ajusteCalidad: -10 };

const ajustePendiente: AjustePagoResponse = {
  id: 'aj-1', pagoId: 'pg-1', registroAcopioId: 'r-1', correccionRegistroId: 'c-1', litrosDiferencia: -5, precioLitro: 0.9, monto: -4.5,
  estado: 'PENDIENTE', creadoEn: '2026-10-22T09:00:00', precioLitroAlCrear: 1, montoAlCrear: -5
};
const ajusteLiquidado: AjustePagoResponse = {
  ...ajustePendiente, id: 'aj-2', estado: 'LIQUIDADO', precioLitro: 1, monto: -5, precioLitroAlCrear: 1, montoAlCrear: -5
};

const calidad: AjusteCalidadEntregaResponse = {
  id: 'ac-1', pagoId: 'pg-1', registroAcopioId: 'aaaaaaaa-0000-0000-0000-00000000abc123', analisisCalidadId: 'a-1', analisisFolio: 'F-0042',
  analisisResultado: 'OBSERVADO', litrosLiquidados: 100, precioNormal: 1, precioAnterior: 1, precioLitroNuevo: 0.9, efectoEnElTotal: -10,
  motivo: 'Agua en la leche', usuarioNombre: 'Administrador', creadoEn: '2026-10-21T10:30:00'
};

function setupConDatos(pago: PagoResponse, extra: Record<string, unknown>, ajustes: AjustePagoResponse[] = [], dialogOpen = vi.fn()) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { pago, ...extra } },
      { provide: DialogRef, useValue: { close } },
      { provide: Dialog, useValue: { open: dialogOpen } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(PagoDetalleDialog);
  http.expectOne(`${base}/pagos/${pago.id}/ajustes`).flush(ajustes);
  http.expectOne(`${base}/pagos/${pago.id}/ajustes-precio`).flush([]);
  return { f, http, close, dialogOpen };
}

describe('PagoDetalleDialog · desglose del total y precios de calidad', () => {
  afterEach(() => vi.restoreAllMocks());

  it('con un ajuste de calidad muestra el total original, el ajuste y el total a pagar que devuelve el servidor', () => {
    const { f, http } = setupConDatos(pagoConCalidad, { esAdmin: true }, []);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="ajuste-calidad"]')?.textContent).toContain('−S/ 10.00');
    expect(el.querySelector('[data-testid="total-a-pagar"]')?.textContent).toContain('S/ 590.00');
    expect(texto(f)).toContain('Total original');
    expect(texto(f)).toContain('S/ 600.00');
    expect(el.querySelector('[data-testid="nota-total"]')?.textContent).toContain('El servidor calcula el total');
    http.verify();
  });

  it('un ajuste de calidad positivo se muestra con signo +, y sin ajuste de calidad no hay línea de ajuste', () => {
    const positivo = setupConDatos({ ...pagoConCalidad, totalAPagar: 610, ajusteCalidad: 10 }, { esAdmin: true });
    positivo.f.detectChanges();
    expect((positivo.f.nativeElement as HTMLElement).querySelector('[data-testid="ajuste-calidad"]')?.textContent).toContain('+S/ 10.00');
    positivo.http.verify();

    TestBed.resetTestingModule();
    const sin = setupConDatos(pagoBase, { esAdmin: true });
    sin.f.detectChanges();
    expect((sin.f.nativeElement as HTMLElement).querySelector('[data-testid="ajuste-calidad"]')).toBeNull();
    expect(texto(sin.f)).not.toContain('Total a pagar');
    sin.http.verify();
  });

  it('el panel no recalcula: muestra tal cual el total a pagar del servidor aunque no coincida con litros × precio', () => {
    const { f, http } = setupConDatos({ ...pagoConCalidad, totalAPagar: 123.45, ajusteCalidad: -476.55 }, { esAdmin: true });
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('[data-testid="total-a-pagar"]')?.textContent).toContain('S/ 123.45');
    http.verify();
  });

  it('los ajustes de litros muestran su estado y, pendiente, el precio vigente; liquidado, el congelado', () => {
    const { f, http } = setupConDatos(pagoBase, { esAdmin: true }, [ajustePendiente, ajusteLiquidado]);
    f.detectChanges();
    const items = Array.from((f.nativeElement as HTMLElement).querySelectorAll('[data-testid="ajuste-litros"]')) as HTMLElement[];
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('PENDIENTE');
    expect(items[0].textContent).toContain('S/ -4.50');
    expect(items[0].querySelector('[data-testid="ajuste-precio-litro"]')?.textContent).toContain('Precio vigente S/ 0.90');
    expect(items[0].textContent).toContain('sigue al precio de su entrega');
    expect(items[0].textContent).toContain('Al crearlo valía S/ 1.00 (S/ -5.00)');
    expect(items[1].textContent).toContain('LIQUIDADO');
    expect(items[1].querySelector('[data-testid="ajuste-precio-litro"]')?.textContent).toContain('Precio congelado al liquidar S/ 1.00');
    expect(items[1].textContent).not.toContain('Al crearlo valía'); // el congelado coincide con el de creación
    http.verify();
  });

  it('el historial de precios de calidad solo se pide y se muestra a quien puede consultarlo', () => {
    const sin = setupConDatos(pagoBase, { esAdmin: false, puedeVerHistorialCalidad: false });
    sin.f.detectChanges();
    expect(texto(sin.f)).not.toContain('Historial de precios de calidad');
    sin.http.expectNone(`${base}/pagos/pg-1/ajustes-calidad`);
    sin.http.verify();

    TestBed.resetTestingModule();
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: { pago: pagoConCalidad, esAdmin: false, puedeVerHistorialCalidad: true } },
        { provide: DialogRef, useValue: { close } }
      ]
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(PagoDetalleDialog);
    http.expectOne(`${base}/pagos/pg-1/ajustes`).flush([]);
    http.expectOne(`${base}/pagos/pg-1/ajustes-precio`).flush([]);
    http.expectOne(`${base}/pagos/pg-1/ajustes-calidad`).flush([calidad]);
    f.detectChanges();

    const item = (f.nativeElement as HTMLElement).querySelector('[data-testid="ajuste-calidad-item"]')!;
    expect(item.textContent).toContain('S/ 1.00 → S/ 0.90');
    expect(item.textContent).toContain('−S/ 10.00');
    expect(item.textContent).toContain('F-0042 (OBSERVADO)');
    expect(item.textContent).toContain('Agua en la leche');
    expect(item.textContent).toContain('Administrador');
    expect(item.textContent).toContain('21/10/2026 10:30');
    http.verify();
  });

  it('sin precios de calidad el historial dice que ninguna entrega tiene precio propio', () => {
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: { pago: pagoBase, esAdmin: true, puedeVerHistorialCalidad: true } },
        { provide: DialogRef, useValue: { close } }
      ]
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(PagoDetalleDialog);
    http.expectOne(`${base}/pagos/pg-1/ajustes`).flush([]);
    http.expectOne(`${base}/pagos/pg-1/ajustes-precio`).flush([]);
    http.expectOne(`${base}/pagos/pg-1/ajustes-calidad`).flush([]);
    f.detectChanges();
    expect(texto(f)).toContain('Ninguna entrega de este pago tiene un precio de calidad propio.');
    http.verify();
  });

  it('un error al leer el historial de calidad se muestra y permite reintentar sin ocultar el resto del detalle', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: { pago: pagoConCalidad, esAdmin: true, puedeVerHistorialCalidad: true } },
        { provide: DialogRef, useValue: { close: vi.fn() } }
      ]
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(PagoDetalleDialog);
    http.expectOne(`${base}/pagos/pg-1/ajustes`).flush([]);
    http.expectOne(`${base}/pagos/pg-1/ajustes-precio`).flush([]);
    http.expectOne(`${base}/pagos/pg-1/ajustes-calidad`).flush({ mensaje: 'Sin permiso' }, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect(comp(f)['errorCalidad']()).not.toBeNull();
    expect(texto(f)).toContain('S/ 590.00'); // el total sigue visible
    comp(f)['cargarAjustesCalidad']();
    http.expectOne(`${base}/pagos/pg-1/ajustes-calidad`).flush([calidad]);
    expect(comp(f)['errorCalidad']()).toBeNull();
    http.verify();
  });

  it('«Ver entregas» abre el diálogo de entregas con el pago y el rol; si se fijó un precio relee pago, ajustes e historial', () => {
    const abrir = vi.fn(() => ({ closed: of(true) }));
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: { pago: pagoBase, esAdmin: true, puedeVerHistorialCalidad: true } },
        { provide: DialogRef, useValue: { close } },
        { provide: Dialog, useValue: { open: abrir } }
      ]
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(PagoDetalleDialog);
    http.expectOne(`${base}/pagos/pg-1/ajustes`).flush([]);
    http.expectOne(`${base}/pagos/pg-1/ajustes-precio`).flush([]);
    http.expectOne(`${base}/pagos/pg-1/ajustes-calidad`).flush([]);
    f.detectChanges();

    boton(f, 'Ver entregas y precios de calidad')!.click();

    expect(abrir).toHaveBeenCalledWith(EntregasPagoDialog, expect.objectContaining({ data: { pago: pagoBase, esAdmin: true } }));
    http.expectOne(`${base}/pagos/pg-1`).flush(pagoConCalidad); // el total lo calcula el servidor
    http.expectOne(`${base}/pagos/pg-1/ajustes`).flush([ajustePendiente]);
    http.expectOne(`${base}/pagos/pg-1/ajustes-calidad`).flush([calidad]);
    f.detectChanges();
    expect(comp(f)['pago']().totalAPagar).toBe(590);
    expect(comp(f)['cambiado']()).toBe(true); // la lista de pagos se recargará al cerrar
    expect((f.nativeElement as HTMLElement).querySelector('[data-testid="total-a-pagar"]')?.textContent).toContain('S/ 590.00');
    http.verify();
  });

  it('si el diálogo de entregas se cierra sin cambios no se vuelve a leer nada', () => {
    const abrir = vi.fn(() => ({ closed: of(false) }));
    const { f, http } = setupConDatos(pagoBase, { esAdmin: false }, [], abrir);
    f.detectChanges();
    boton(f, 'Ver entregas y precios de calidad')!.click();
    expect(abrir).toHaveBeenCalled();
    expect(comp(f)['cambiado']()).toBe(false);
    http.verify();
  });
});
