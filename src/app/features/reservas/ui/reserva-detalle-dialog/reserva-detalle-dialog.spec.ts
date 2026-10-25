import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { CampoUnicoDialog, CampoUnicoDialogData } from '../../../../shared/ui/dialog/campo-unico-dialog';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { VentaDetalleDialog } from '../../../ventas/ui/venta-detalle-dialog/venta-detalle-dialog';
import { ReservaResponse } from '../../data-access/reserva.models';
import { AceptacionPrecioDialog } from '../aceptacion-precio-dialog/aceptacion-precio-dialog';
import { ReservaDetalleDialog } from './reserva-detalle-dialog';

const base = `${environment.apiBaseUrl}/reservas`;

function reserva(parcial: Partial<ReservaResponse> = {}): ReservaResponse {
  return {
    id: 'r-1', codigo: 'ABCD234567', estado: 'PENDIENTE', nombreCliente: 'Rosa Quispe', telefono: '987654321',
    correo: 'rosa@correo.pe', notaCliente: 'Paso a las 5', fechaRetiro: '2026-10-13', fechaMaximaRetiro: '2026-10-14',
    creadoEn: '2026-10-11T09:30:00', expiraEn: '2026-10-12T09:30:00', total: 60, precioAConfirmar: false,
    requiereAceptacion: false, aceptacion: { totalAceptado: null, aceptadoEn: null, medio: null, nota: null, registradoPor: null },
    sinCobertura: false, ventaId: null,
    lineas: [
      { presentacionId: 'p-1', producto: 'Queso Fresco', presentacion: 'Bloque 1 kg', unidadConteo: 'unidad', cantidad: 4, precioUnitario: 15, subtotal: 60 }
    ],
    eventos: [{ tipo: 'CREADA', usuario: null, motivo: null, creadoEn: '2026-10-11T09:30:00' }],
    ...parcial
  };
}

function crear() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: { id: 'r-1' } },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const dialogRef = TestBed.inject(DialogRef) as unknown as { close: ReturnType<typeof vi.fn> };
  const toast = TestBed.inject(ToastService);
  const dialog = TestBed.inject(Dialog);
  const abiertos: Array<{ componente: unknown; config: { data?: unknown }; closed: Subject<unknown> }> = [];
  vi.spyOn(dialog, 'open').mockImplementation(((componente: unknown, config: { data?: unknown }) => {
    const closed = new Subject<unknown>();
    abiertos.push({ componente, config, closed });
    return { closed } as never;
  }) as never);
  const fixture: ComponentFixture<ReservaDetalleDialog> = TestBed.createComponent(ReservaDetalleDialog);
  fixture.detectChanges();
  return { fixture, http, dialogRef, toast, abiertos };
}

function cargar(r: ReservaResponse) {
  const ctx = crear();
  ctx.http.expectOne(`${base}/r-1`).flush(r);
  ctx.fixture.detectChanges();
  return ctx;
}

const texto = (f: ComponentFixture<unknown>) => ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
const botones = (f: ComponentFixture<unknown>) =>
  Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.dialog-foot button'));
const boton = (f: ComponentFixture<unknown>, etiqueta: string) => botones(f).find((b) => b.textContent?.trim() === etiqueta);

describe('ReservaDetalleDialog', () => {
  afterEach(() => vi.restoreAllMocks());

  it('muestra productos, presentaciones, cantidades, precios, total, fechas y el historial', () => {
    const { fixture, http } = cargar(reserva({
      eventos: [
        { tipo: 'CREADA', usuario: null, motivo: null, creadoEn: '2026-10-11T09:30:00' },
        { tipo: 'PRECIOS_RECOTIZADOS', usuario: 'Ana Ventas', motivo: null, creadoEn: '2026-10-11T10:00:00' }
      ]
    }));
    const t = texto(fixture);
    expect(t).toContain('Reserva ABCD234567');
    expect(t).toContain('Pendiente');
    expect(t).toContain('Rosa Quispe');
    expect(t).toContain('987654321');
    expect(t).toContain('Queso Fresco');
    expect(t).toContain('Bloque 1 kg');
    expect(t).toContain('S/ 15.00');
    expect(t).toContain('S/ 60.00');
    expect(t).toContain('Total: S/ 60.00');
    expect(t).toContain('13/10/2026'); // fecha de retiro
    expect(t).toContain('14/10/2026'); // plazo máximo
    expect(t).toContain('12/10/2026 09:30'); // vencimiento
    expect(t).toContain('Solicitud recibida');
    expect(t).toContain('Precios recotizados');
    expect(t).toContain('Ana Ventas');
    http.verify();
  });

  it('un precio a confirmar se muestra como «A confirmar» y el total no se inventa', () => {
    const { fixture } = cargar(reserva({
      total: null, precioAConfirmar: true, requiereAceptacion: true,
      lineas: [{ presentacionId: 'p-1', producto: 'Queso', presentacion: 'Bloque', unidadConteo: 'unidad', cantidad: 2, precioUnitario: null, subtotal: null }]
    }));
    const t = texto(fixture);
    expect(t).toContain('A confirmar');
    expect(t).toContain('Total: a confirmar');
    expect(t).not.toContain('S/ 0.00');
    expect(t).toContain('precio a confirmar');
    // No se puede registrar la aceptación de un importe que todavía no existe: primero hay que recotizar.
    expect(boton(fixture, 'Registrar aceptación')?.disabled).toBe(true);
  });

  it('avisa cuando la reserva está sin cobertura de inventario y cuando está vencida', () => {
    const sin = cargar(reserva({ sinCobertura: true, estado: 'CONFIRMADA' }));
    expect(texto(sin.fixture)).toContain('Sin cobertura de inventario');
    TestBed.resetTestingModule();
    const vencida = cargar(reserva({ estado: 'VENCIDA' }));
    expect(texto(vencida.fixture)).toContain('Reserva vencida');
    expect(botones(vencida.fixture).map((b) => b.textContent?.trim())).toEqual(['Cerrar']);
  });

  it('muestra la aceptación del cliente con su constancia', () => {
    const { fixture } = cargar(reserva({
      requiereAceptacion: true,
      aceptacion: { totalAceptado: 60, aceptadoEn: '2026-10-11T11:00:00', medio: 'WHATSAPP', nota: 'Escribió al chat', registradoPor: 'Ana Ventas' }
    }));
    const t = texto(fixture);
    expect(t).toContain('Aceptó S/ 60.00 por WhatsApp');
    expect(t).toContain('registrado por Ana Ventas');
    expect(boton(fixture, 'Registrar aceptación')).toBeUndefined();
  });

  it('según el estado ofrece solo las acciones que corresponden', () => {
    const pendiente = cargar(reserva());
    expect(botones(pendiente.fixture).map((b) => b.textContent?.trim())).toEqual(['Cerrar', 'Recotizar precios', 'Rechazar', 'Confirmar reserva']);
    TestBed.resetTestingModule();
    const confirmada = cargar(reserva({ estado: 'CONFIRMADA' }));
    expect(botones(confirmada.fixture).map((b) => b.textContent?.trim())).toEqual(['Cerrar', 'Cancelar reserva', 'Registrar retiro']);
    TestBed.resetTestingModule();
    const retirada = cargar(reserva({ estado: 'RETIRADA', ventaId: 'v-9' }));
    expect(botones(retirada.fixture).map((b) => b.textContent?.trim())).toEqual(['Cerrar']);
    expect(texto(retirada.fixture)).toContain('Venta del retiro');
  });

  it('«Ver venta» abre el detalle de la venta asociada al retiro', () => {
    const { fixture, abiertos } = cargar(reserva({ estado: 'RETIRADA', ventaId: 'v-9' }));
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.row-link')!.click();
    expect(abiertos[0].componente).toBe(VentaDetalleDialog);
    expect(abiertos[0].config.data).toEqual({ id: 'v-9' });
  });

  it('confirmar pide confirmación y no llama al servidor si se cancela', () => {
    const { fixture, http, abiertos } = cargar(reserva());
    boton(fixture, 'Confirmar reserva')!.click();
    expect(abiertos[0].componente).toBe(ConfirmDialog);
    abiertos[0].closed.next(false);
    http.expectNone(`${base}/r-1/confirmar`);
  });

  it('confirmar llama a PUT /confirmar, muestra la reserva que devuelve el servidor y avisa que hubo cambios al cerrar', () => {
    const { fixture, http, abiertos, toast, dialogRef } = cargar(reserva());
    const exito = vi.spyOn(toast, 'exito');
    boton(fixture, 'Confirmar reserva')!.click();
    abiertos[0].closed.next(true);

    const req = http.expectOne(`${base}/r-1/confirmar`);
    expect(req.request.method).toBe('PUT');
    req.flush(reserva({ estado: 'CONFIRMADA' }));
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Confirmada');
    expect(exito).toHaveBeenCalledWith('Reserva ABCD234567 confirmada.');
    expect(boton(fixture, 'Registrar retiro')).toBeDefined();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.close')!.click();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('el panel no decide si se puede confirmar: si el servidor lo rechaza, muestra su motivo y vuelve a leer la reserva', () => {
    const { fixture, http, abiertos } = cargar(reserva({ requiereAceptacion: true }));
    expect(boton(fixture, 'Confirmar reserva')?.disabled).toBe(false); // aunque falte la aceptación, decide el servidor
    boton(fixture, 'Confirmar reserva')!.click();
    abiertos[0].closed.next(true);

    http.expectOne(`${base}/r-1/confirmar`).flush(
      { mensaje: 'El cliente debe aceptar el importe antes de confirmar.' }, { status: 409, statusText: 'Conflict' });
    http.expectOne(`${base}/r-1`).flush(reserva({ requiereAceptacion: true }));
    fixture.detectChanges();

    expect(texto(fixture)).toContain('El cliente debe aceptar el importe antes de confirmar.');
    expect(texto(fixture)).toContain('Pendiente');
    expect(boton(fixture, 'Confirmar reserva')?.disabled).toBe(false);
  });

  it('una reserva sin cobertura rechazada por el servidor deja el mensaje del servidor a la vista', () => {
    const { fixture, http, abiertos } = cargar(reserva({ sinCobertura: true }));
    boton(fixture, 'Confirmar reserva')!.click();
    abiertos[0].closed.next(true);
    http.expectOne(`${base}/r-1/confirmar`).flush(
      { mensaje: 'La reserva ya no tiene cobertura de inventario.' }, { status: 409, statusText: 'Conflict' });
    http.expectOne(`${base}/r-1`).flush(reserva({ sinCobertura: true }));
    fixture.detectChanges();
    expect(texto(fixture)).toContain('La reserva ya no tiene cobertura de inventario.');
  });

  it('rechazar solicita el motivo, lo envía recortado y actualiza la reserva', () => {
    const { fixture, http, abiertos, toast } = cargar(reserva());
    const exito = vi.spyOn(toast, 'exito');
    boton(fixture, 'Rechazar')!.click();
    expect(abiertos[0].componente).toBe(CampoUnicoDialog);
    const data = abiertos[0].config.data as CampoUnicoDialogData;
    expect(data.titulo).toBe('Rechazar reserva ABCD234567');

    let devuelta: unknown;
    data.guardar('  Sin stock para ese día  ').subscribe((r) => (devuelta = r));
    const req = http.expectOne(`${base}/r-1/rechazar`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ motivo: 'Sin stock para ese día' });
    const rechazada = reserva({ estado: 'RECHAZADA', eventos: [
      { tipo: 'CREADA', usuario: null, motivo: null, creadoEn: '2026-10-11T09:30:00' },
      { tipo: 'RECHAZADA', usuario: 'Ana Ventas', motivo: 'Sin stock para ese día', creadoEn: '2026-10-11T12:00:00' }
    ] });
    req.flush(rechazada);
    abiertos[0].closed.next(devuelta);
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Rechazada');
    expect(texto(fixture)).toContain('«Sin stock para ese día»');
    expect(exito).toHaveBeenCalledWith('Reserva ABCD234567 rechazada.');
    expect(botones(fixture).map((b) => b.textContent?.trim())).toEqual(['Cerrar']);
  });

  it('cancelar una reserva confirmada solicita el motivo y llama a PUT /cancelar', () => {
    const { fixture, http, abiertos } = cargar(reserva({ estado: 'CONFIRMADA' }));
    boton(fixture, 'Cancelar reserva')!.click();
    const data = abiertos[0].config.data as CampoUnicoDialogData;
    let devuelta: unknown;
    data.guardar('El cliente no viene').subscribe((r) => (devuelta = r));
    const req = http.expectOne(`${base}/r-1/cancelar`);
    expect(req.request.body).toEqual({ motivo: 'El cliente no viene' });
    req.flush(reserva({ estado: 'CANCELADA' }));
    abiertos[0].closed.next(devuelta);
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Cancelada');
  });

  it('cerrar el motivo sin guardar no cambia nada', () => {
    const { fixture, http, abiertos } = cargar(reserva());
    boton(fixture, 'Rechazar')!.click();
    abiertos[0].closed.next(undefined);
    http.expectNone(`${base}/r-1/rechazar`);
    expect(texto(fixture)).toContain('Pendiente');
  });

  it('recotizar pide confirmación y llama a PUT /recotizar; el nuevo importe queda pendiente de aceptar', () => {
    const { fixture, http, abiertos } = cargar(reserva({
      total: null, precioAConfirmar: true, requiereAceptacion: true,
      lineas: [{ presentacionId: 'p-1', producto: 'Queso', presentacion: 'Bloque', unidadConteo: 'unidad', cantidad: 2, precioUnitario: null, subtotal: null }]
    }));
    boton(fixture, 'Recotizar precios')!.click();
    expect(abiertos[0].componente).toBe(ConfirmDialog);
    abiertos[0].closed.next(true);
    const req = http.expectOne(`${base}/r-1/recotizar`);
    expect(req.request.method).toBe('PUT');
    req.flush(reserva({ total: 30, precioAConfirmar: false, requiereAceptacion: true,
      lineas: [{ presentacionId: 'p-1', producto: 'Queso', presentacion: 'Bloque', unidadConteo: 'unidad', cantidad: 2, precioUnitario: 15, subtotal: 30 }] }));
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Total: S/ 30.00');
    expect(texto(fixture)).toContain('El cliente debe aceptar el importe');
    expect(boton(fixture, 'Registrar aceptación')?.disabled).toBe(false);
  });

  it('registrar la aceptación abre su diálogo con el importe vigente y aplica la reserva actualizada', () => {
    const { fixture, abiertos, toast } = cargar(reserva({ total: 30, requiereAceptacion: true }));
    const exito = vi.spyOn(toast, 'exito');
    boton(fixture, 'Registrar aceptación')!.click();
    expect(abiertos[0].componente).toBe(AceptacionPrecioDialog);
    expect(abiertos[0].config.data).toEqual({ reservaId: 'r-1', codigo: 'ABCD234567', total: 30 });

    abiertos[0].closed.next(reserva({
      total: 30, requiereAceptacion: true,
      aceptacion: { totalAceptado: 30, aceptadoEn: '2026-10-11T11:00:00', medio: 'TELEFONO', nota: null, registradoPor: 'Ana Ventas' }
    }));
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Aceptó S/ 30.00 por Teléfono');
    expect(exito).toHaveBeenCalledWith('Aceptación del cliente registrada en ABCD234567.');
    expect(boton(fixture, 'Registrar aceptación')).toBeUndefined();
  });

  it('el retiro llama a POST /retirar, muestra la reserva RETIRADA con su venta y reutiliza el uuid si se reintenta tras un fallo', () => {
    const { fixture, http, abiertos, toast } = cargar(reserva({ estado: 'CONFIRMADA' }));
    const exito = vi.spyOn(toast, 'exito');
    boton(fixture, 'Registrar retiro')!.click();
    abiertos[0].closed.next(true);

    const primero = http.expectOne(`${base}/r-1/retirar`);
    expect(primero.request.method).toBe('POST');
    const uuid = (primero.request.body as { uuidCliente: string }).uuidCliente;
    expect(uuid).toMatch(/^[0-9a-f-]{36}$/);
    primero.flush({ mensaje: 'Stock comprometido por reservas de Bloque' }, { status: 400, statusText: 'Bad Request' });
    http.expectOne(`${base}/r-1`).flush(reserva({ estado: 'CONFIRMADA' }));
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Stock comprometido por reservas de Bloque');
    expect(boton(fixture, 'Registrar retiro')?.disabled).toBe(false);

    // Reintento: misma clave de idempotencia, para no duplicar la venta si la primera sí llegó a registrarse.
    boton(fixture, 'Registrar retiro')!.click();
    abiertos[1].closed.next(true);
    const segundo = http.expectOne(`${base}/r-1/retirar`);
    expect((segundo.request.body as { uuidCliente: string }).uuidCliente).toBe(uuid);
    segundo.flush({ id: 'v-9', fecha: '2026-10-13', tipoCliente: 'PUBLICO', detalles: [], total: 60 });
    http.expectOne(`${base}/r-1`).flush(reserva({ estado: 'RETIRADA', ventaId: 'v-9' }));
    fixture.detectChanges();

    expect(exito).toHaveBeenCalledWith('Retiro registrado. Venta por S/ 60.00.');
    expect(texto(fixture)).toContain('Retirada');
    expect(texto(fixture)).toContain('Venta del retiro');
    expect(botones(fixture).map((b) => b.textContent?.trim())).toEqual(['Cerrar']);
  });

  it('un error al cargar permite reintentar', () => {
    const { fixture, http } = crear();
    http.expectOne(`${base}/r-1`).flush({ mensaje: 'Reserva no encontrada' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Reserva no encontrada');
    (fixture.componentInstance as unknown as Record<string, () => void>)['cargar']();
    http.expectOne(`${base}/r-1`).flush(reserva());
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Rosa Quispe');
  });
});

describe('ReservaDetalleDialog — Fase H: comprador confirmado', () => {
  it('sin comprador vinculado explica que al retirar no se crea ninguna ficha y ofrece identificarlo', () => {
    const { fixture, http } = cargar(reserva({ estado: 'CONFIRMADA' }));
    const seccion = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="comprador-reserva"]')?.textContent ?? '';
    expect(seccion).toContain('no se crea ninguna ficha');
    expect(seccion).toContain('Identificar comprador');
    http.verify();
  });

  it('vincular el comprador elegido llama al servidor y muestra el comprador confirmado', () => {
    const { fixture, http } = cargar(reserva({ estado: 'CONFIRMADA' }));
    const comp = fixture.componentInstance as unknown as Record<string, any>;
    comp['vincular'](reserva({ estado: 'CONFIRMADA' }), { tipo: 'CLIENTE', id: 'c-1', nombre: 'Rosa Quispe', mayorista: false });
    const req = http.expectOne(`${base}/r-1/comprador`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ tipo: 'CLIENTE', id: 'c-1' });
    req.flush(reserva({ estado: 'CONFIRMADA', comprador: { tipo: 'CLIENTE', id: 'c-1', nombre: 'Rosa Quispe', ruc: null } }));
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Al retirar, la venta queda a su nombre');
    http.verify();
  });

  it('en una reserva retirada el comprador ya no se cambia', () => {
    const { fixture, http } = cargar(reserva({ estado: 'RETIRADA', ventaId: 'v-1' }));
    expect(texto(fixture)).not.toContain('Identificar comprador');
    http.verify();
  });
});
