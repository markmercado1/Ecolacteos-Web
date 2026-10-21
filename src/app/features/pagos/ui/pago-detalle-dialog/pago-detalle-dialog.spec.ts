import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { AjustePrecioPagoResponse, PagoResponse } from '../../data-access/pago.models';
import { PagoDetalleDialog } from './pago-detalle-dialog';

const base = environment.apiBaseUrl;

/** 100 L a S/ 1.00 = S/ 100 (el ejemplo del negocio). */
const pagoBase: PagoResponse = {
  id: 'pg-1', proveedorId: 'p-1', proveedorNombre: 'Alejandro Terrones Huamán',
  semanaInicio: '2026-10-14', semanaFin: '2026-10-21', litrosTotales: 100, precioLitro: 1, total: 100,
  comprobanteGenerado: false, registroAcopioIds: ['r-1'], precioLitroEfectivo: 1, totalAPagar: 100
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
