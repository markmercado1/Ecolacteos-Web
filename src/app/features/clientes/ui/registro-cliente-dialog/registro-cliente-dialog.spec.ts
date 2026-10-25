import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { AvisoPrivacidadResponse } from '../../data-access/cliente.models';
import { RegistroClienteDialog } from './registro-cliente-dialog';

const base = environment.apiBaseUrl;

const aviso: AvisoPrivacidadResponse = {
  version: '2026-10-24', completo: false, faltantes: ['RUC del responsable'], responsable: null, ruc: null, domicilio: null, contacto: null,
  avisoReserva: ['Usamos tu nombre solo para la reserva.'],
  avisoRegistro: ['Registrarte como cliente es voluntario.', 'Registrarte no significa aceptar publicidad.'],
  textoComunicaciones: '¿Autorizas promociones? Es opcional.'
};

function crear(data: Record<string, string> = {}) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DIALOG_DATA, useValue: data }, { provide: DialogRef, useValue: { close } }]
  });
  const f = TestBed.createComponent(RegistroClienteDialog);
  const http = TestBed.inject(HttpTestingController);
  http.expectOne(`${base}/catalogo/privacidad`).flush(aviso);
  f.detectChanges();
  return { f, http, close, comp: f.componentInstance as unknown as Record<string, any> };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;

describe('RegistroClienteDialog (Fase H: registro voluntario)', () => {
  it('muestra el aviso, avisa que está incompleto y no marca ninguna autorización por defecto', () => {
    const { f, http } = crear({ nombre: 'Rosa', telefono: '987654321' });
    expect(el(f).textContent).toContain('Registrarte como cliente es voluntario.');
    expect(el(f).querySelector('[data-testid="aviso-incompleto"]')?.textContent).toContain('RUC del responsable');
    expect((el(f).querySelector('[data-testid="autoriza-registro"]') as HTMLInputElement).checked).toBe(false);
    expect((el(f).querySelector('[data-testid="acepta-promociones"]') as HTMLInputElement).checked).toBe(false);
    expect((el(f).querySelector('#rc-nombre') as HTMLInputElement).value).toBe('Rosa');
    http.verify();
  });

  it('sin la autorización del comprador no envía nada (la venta sigue como cliente varios)', () => {
    const { comp, http } = crear({ nombre: 'Rosa', telefono: '987654321' });
    comp['enviar']();
    expect(comp['error']()).toContain('Sin la autorización');
    http.expectNone(`${base}/clientes`);
    http.expectNone(`${base}/compradores/sugerencias`);
    http.verify();
  });

  it('con autorización y sin promociones registra solo el registro (comunicaciones = null)', () => {
    const { comp, http, close } = crear({ nombre: 'Rosa', telefono: '987654321' });
    comp['form'].patchValue({ autoriza: true });
    comp['enviar']();
    http.expectOne(`${base}/compradores/sugerencias`).flush([]);
    const req = http.expectOne(`${base}/clientes`);
    expect(req.request.body.autorizacionRegistro).toEqual({ otorgada: true, forma: 'VERBAL_PRESENCIAL' });
    expect(req.request.body.comunicaciones).toBeNull();
    expect(req.request.body.avisoVersion).toBe('2026-10-24');
    expect(req.request.body.confirmadoSinCoincidencia).toBe(false);
    req.flush({ id: 'c-1', nombre: 'Rosa', mayorista: false });
    expect(close).toHaveBeenCalledWith({ tipo: 'CLIENTE', id: 'c-1', nombre: 'Rosa', mayorista: false });
    http.verify();
  });

  it('las promociones exigen elegir medios y viajan aparte del registro', () => {
    const { comp, http } = crear({ nombre: 'Rosa', telefono: '987654321' });
    comp['form'].patchValue({ autoriza: true, promociones: true });
    comp['enviar']();
    expect(comp['error']()).toContain('por qué medios');
    comp['alternarMedio']('WHATSAPP');
    comp['enviar']();
    http.expectOne(`${base}/compradores/sugerencias`).flush([]);
    const req = http.expectOne(`${base}/clientes`);
    expect(req.request.body.comunicaciones).toEqual({ otorgada: true, medios: ['WHATSAPP'], forma: 'VERBAL_PRESENCIAL' });
    req.flush({ id: 'c-1', nombre: 'Rosa', mayorista: false });
    http.verify();
  });

  it('si el teléfono ya figura en otra ficha, el trabajador elige: es esa persona o es otra (nada se une solo)', () => {
    const { f, comp, http, close } = crear({ nombre: 'Luis', telefono: '987654321' });
    comp['form'].patchValue({ autoriza: true });
    comp['enviar']();
    http.expectOne(`${base}/compradores/sugerencias`).flush([
      { tipo: 'CLIENTE', id: 'c-9', nombre: 'Ana Ruiz', telefono: '••• ••• 321', documento: null, mayorista: false, activo: true, coincidencia: 'TELEFONO' }
    ]);
    f.detectChanges();
    expect(el(f).querySelector('[data-testid="coincidencias"]')?.textContent).toContain('Ana Ruiz');
    http.expectNone(`${base}/clientes`);
    comp['registrarIgual']();
    const req = http.expectOne(`${base}/clientes`);
    expect(req.request.body.confirmadoSinCoincidencia).toBe(true);
    req.flush({ id: 'c-10', nombre: 'Luis', mayorista: false });
    expect(close).toHaveBeenCalledWith({ tipo: 'CLIENTE', id: 'c-10', nombre: 'Luis', mayorista: false });
    http.verify();
  });

  it('si es una ficha existente, la usa sin crear otra', () => {
    const { f, comp, http, close } = crear({ nombre: 'Juan', telefono: '987654321' });
    comp['form'].patchValue({ autoriza: true });
    comp['enviar']();
    http.expectOne(`${base}/compradores/sugerencias`).flush([
      { tipo: 'PROVEEDOR', id: 'p-1', nombre: 'Juan Proveedor', telefono: '••• ••• 321', documento: '••••5678', mayorista: false, activo: true, coincidencia: 'TELEFONO' }
    ]);
    f.detectChanges();
    (Array.from(el(f).querySelectorAll('button')).find((b) => b.textContent?.includes('Es esta persona')) as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledWith({ tipo: 'PROVEEDOR', id: 'p-1', nombre: 'Juan Proveedor', mayorista: false });
    http.expectNone(`${base}/clientes`);
    http.verify();
  });
});
