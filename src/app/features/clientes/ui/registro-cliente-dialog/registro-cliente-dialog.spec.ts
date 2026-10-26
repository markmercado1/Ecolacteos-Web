import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/auth/auth.service';
import { AvisoPrivacidadResponse } from '../../data-access/cliente.models';
import { RegistroClienteDialog } from './registro-cliente-dialog';

const base = environment.apiBaseUrl;

const aviso: AvisoPrivacidadResponse = {
  version: '2026-10-24', completo: false, faltantes: ['RUC del responsable'], responsable: null, ruc: null, domicilio: null, contacto: null,
  avisoReserva: ['Usamos tu nombre solo para la reserva.'],
  avisoRegistro: ['Registrarte como cliente es voluntario.', 'Registrarte no significa aceptar publicidad.'],
  textoComunicaciones: '¿Autorizas promociones? Es opcional.'
};

function crear(data: Record<string, string> = {}, rol = 'VENTAS') {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data }, { provide: DialogRef, useValue: { close } },
      { provide: AuthService, useValue: { usuario: signal({ rolNombre: rol }) } }
    ]
  });
  const f = TestBed.createComponent(RegistroClienteDialog);
  const http = TestBed.inject(HttpTestingController);
  http.expectOne(`${base}/catalogo/privacidad`).flush(aviso);
  f.detectChanges();
  return { f, http, close, comp: f.componentInstance as unknown as Record<string, any> };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const boton = (f: ComponentFixture<unknown>, texto: string) =>
  Array.from(el(f).querySelectorAll('button')).find((b) => b.textContent?.includes(texto)) as HTMLButtonElement | undefined;

describe('RegistroClienteDialog (registro voluntario en un solo paso)', () => {
  it('muestra el aviso sin casillas de autorización redundantes y sin promociones marcadas', () => {
    const { f, http } = crear({ nombre: 'Rosa', telefono: '987654321' });
    expect(el(f).textContent).toContain('Registrarte como cliente es voluntario.');
    expect(el(f).querySelector('[data-testid="aviso-incompleto"]')?.textContent).toContain('RUC del responsable');
    // la acción de registrar ES la autorización: no hay casilla «autoriza» ni botón «No se registra»
    expect(el(f).querySelector('[data-testid="autoriza-registro"]')).toBeNull();
    expect(boton(f, 'No se registra')).toBeUndefined();
    expect(boton(f, 'Registrar cliente')).toBeTruthy();
    expect(el(f).textContent).toContain('queda constancia');
    const medios = Array.from(el(f).querySelectorAll('[data-testid="medios-promociones"] input')) as HTMLInputElement[];
    expect(medios.length).toBe(4);
    expect(medios.every((m) => !m.checked)).toBe(true);
    expect((el(f).querySelector('#rc-nombre') as HTMLInputElement).value).toBe('Rosa');
    http.verify();
  });

  it('un clic en Registrar deja la autorización del registro (una sola vez) y sin medios no hay promociones', () => {
    const { comp, http, close } = crear({ nombre: 'Rosa', telefono: '987654321' });
    comp['enviar']();
    http.expectOne(`${base}/compradores/sugerencias`).flush([]);
    const req = http.expectOne(`${base}/clientes`);
    expect(req.request.body.autorizacionRegistro).toEqual({ otorgada: true, forma: 'VERBAL_PRESENCIAL' });
    expect(req.request.body.comunicaciones).toBeNull();
    expect(req.request.body.avisoVersion).toBe('2026-10-24');
    expect(req.request.body.confirmadoSinCoincidencia).toBe(false);
    expect(req.request.body.mayorista).toBe(false);
    expect(req.request.body.canalHabitual).toBe('PUBLICO');
    req.flush({ id: 'c-1', nombre: 'Rosa', mayorista: false, canalHabitual: 'PUBLICO' });
    expect(close).toHaveBeenCalledWith({ tipo: 'CLIENTE', id: 'c-1', nombre: 'Rosa', mayorista: false, canalHabitual: 'PUBLICO' });
    http.verify();
  });

  it('marcar medios es la autorización de promociones, aparte del registro', () => {
    const { comp, http } = crear({ nombre: 'Rosa', telefono: '987654321' });
    comp['alternarMedio']('WHATSAPP');
    comp['form'].patchValue({ forma: 'ESCRITO' });
    comp['enviar']();
    http.expectOne(`${base}/compradores/sugerencias`).flush([]);
    const req = http.expectOne(`${base}/clientes`);
    expect(req.request.body.comunicaciones).toEqual({ otorgada: true, medios: ['WHATSAPP'], forma: 'ESCRITO' });
    expect(req.request.body.autorizacionRegistro).toEqual({ otorgada: true, forma: 'ESCRITO' });
    req.flush({ id: 'c-1', nombre: 'Rosa', mayorista: false });
    http.verify();
  });

  it('valida en el formulario y muestra cada error junto a su campo, sin llamar al servidor', () => {
    const { f, comp, http } = crear({ nombre: '', telefono: '12345' });
    comp['form'].patchValue({ dni: '123', correo: 'no-es-correo' });
    comp['enviar']();
    f.detectChanges();
    expect(el(f).querySelector('#rc-nombre-error')?.textContent).toContain('obligatorio');
    expect(el(f).querySelector('#rc-telefono-error')?.textContent).toContain('celular peruano');
    expect(el(f).querySelector('#rc-dni-error')?.textContent).toContain('8 dígitos');
    expect(el(f).querySelector('#rc-correo-error')?.textContent).toContain('no es válido');
    http.expectNone(`${base}/compradores/sugerencias`);
    http.expectNone(`${base}/clientes`);
    // al corregir un campo, su error desaparece sin volver a enviar
    comp['form'].patchValue({ telefono: '987654321' });
    f.detectChanges();
    expect(el(f).querySelector('#rc-telefono-error')).toBeNull();
    expect(el(f).querySelector('#rc-nombre-error')).toBeTruthy();
    http.verify();
  });

  it('empresa: muestra razón social y RUC obligatorios y no envía DNI', () => {
    const { f, comp, http } = crear({ telefono: '987654321' });
    comp['form'].patchValue({ tipoPersona: 'EMPRESA' });
    comp['cambioTipoPersona']();
    f.detectChanges();
    expect(el(f).querySelector('#rc-razon')).toBeTruthy();
    expect(el(f).querySelector('#rc-dni')).toBeNull();
    comp['enviar']();
    f.detectChanges();
    expect(el(f).querySelector('#rc-razon-error')).toBeTruthy();
    expect(el(f).querySelector('#rc-ruc-error')).toBeTruthy();
    comp['form'].patchValue({ razonSocial: 'Bodega El Sol S.A.C.', ruc: '20123456789' });
    comp['enviar']();
    http.expectOne(`${base}/compradores/sugerencias`).flush([]);
    const req = http.expectOne(`${base}/clientes`);
    expect(req.request.body).toMatchObject({ tipoPersona: 'EMPRESA', razonSocial: 'Bodega El Sol S.A.C.', ruc: '20123456789', dni: null, nombre: 'Bodega El Sol S.A.C.' });
    req.flush({ id: 'c-2', nombre: 'Bodega El Sol S.A.C.', mayorista: false });
    http.verify();
  });

  it('VENTAS no puede elegir mayorista y el canal mayorista queda deshabilitado', () => {
    const { f, http } = crear({ nombre: 'Rosa', telefono: '987654321' });
    const tipo = el(f).querySelector('#rc-tipo-cliente option[value="MAYORISTA"]') as HTMLOptionElement;
    const canal = el(f).querySelector('#rc-canal option[value="MAYORISTA"]') as HTMLOptionElement;
    expect(tipo.disabled).toBe(true);
    expect(tipo.textContent).toContain('solo ADMIN');
    expect(canal.disabled).toBe(true);
    http.verify();
  });

  it('ADMIN: mayorista exige motivo (campo dinámico) y permite el canal mayorista', () => {
    const { f, comp, http } = crear({ nombre: 'Bodega', telefono: '987654321' }, 'ADMIN');
    comp['form'].patchValue({ tipoCliente: 'MAYORISTA' });
    comp['cambioTipoCliente']();
    f.detectChanges();
    expect(el(f).querySelector('#rc-motivo')).toBeTruthy();
    expect((el(f).querySelector('#rc-canal option[value="MAYORISTA"]') as HTMLOptionElement).disabled).toBe(false);
    comp['enviar']();
    f.detectChanges();
    expect(el(f).querySelector('#rc-motivo-error')?.textContent).toContain('obligatorio');
    http.expectNone(`${base}/clientes`);
    comp['form'].patchValue({ motivoMayorista: 'Compra por mayor', canalHabitual: 'MAYORISTA' });
    comp['enviar']();
    http.expectOne(`${base}/compradores/sugerencias`).flush([]);
    const req = http.expectOne(`${base}/clientes`);
    expect(req.request.body).toMatchObject({ mayorista: true, motivoMayorista: 'Compra por mayor', canalHabitual: 'MAYORISTA' });
    req.flush({ id: 'c-3', nombre: 'Bodega', mayorista: true, canalHabitual: 'MAYORISTA' });
    http.verify();
  });

  it('volver a regular devuelve el canal a Público', () => {
    const { comp, http } = crear({}, 'ADMIN');
    comp['form'].patchValue({ tipoCliente: 'MAYORISTA' });
    comp['cambioTipoCliente']();
    comp['form'].patchValue({ canalHabitual: 'MAYORISTA', motivoMayorista: 'x' });
    comp['form'].patchValue({ tipoCliente: 'REGULAR' });
    comp['cambioTipoCliente']();
    expect(comp['form'].controls.canalHabitual.value).toBe('PUBLICO');
    expect(comp['form'].controls.motivoMayorista.value).toBe('');
    http.verify();
  });

  it('si el teléfono ya figura en otra ficha, el trabajador elige: es esa persona o es otra (nada se une solo)', () => {
    const { f, comp, http, close } = crear({ nombre: 'Luis', telefono: '987654321' });
    comp['enviar']();
    http.expectOne(`${base}/compradores/sugerencias`).flush([
      { tipo: 'CLIENTE', id: 'c-9', nombre: 'Ana Ruiz', telefono: '••• ••• 321', documento: null, mayorista: false, activo: true, coincidencia: 'TELEFONO', canalHabitual: 'PUBLICO' }
    ]);
    f.detectChanges();
    expect(el(f).querySelector('[data-testid="coincidencias"]')?.textContent).toContain('Ana Ruiz');
    http.expectNone(`${base}/clientes`);
    comp['registrarIgual']();
    const req = http.expectOne(`${base}/clientes`);
    expect(req.request.body.confirmadoSinCoincidencia).toBe(true);
    req.flush({ id: 'c-10', nombre: 'Luis', mayorista: false, canalHabitual: 'PUBLICO' });
    expect(close).toHaveBeenCalledWith({ tipo: 'CLIENTE', id: 'c-10', nombre: 'Luis', mayorista: false, canalHabitual: 'PUBLICO' });
    http.verify();
  });

  it('si es una ficha existente, la usa sin crear otra', () => {
    const { f, comp, http, close } = crear({ nombre: 'Juan', telefono: '987654321' });
    comp['enviar']();
    http.expectOne(`${base}/compradores/sugerencias`).flush([
      { tipo: 'PROVEEDOR', id: 'p-1', nombre: 'Juan Proveedor', telefono: '••• ••• 321', documento: '••••5678', mayorista: false, activo: true, coincidencia: 'TELEFONO', canalHabitual: null }
    ]);
    f.detectChanges();
    boton(f, 'Es esta persona')!.click();
    expect(close).toHaveBeenCalledWith({ tipo: 'PROVEEDOR', id: 'p-1', nombre: 'Juan Proveedor', mayorista: false, canalHabitual: null });
    http.expectNone(`${base}/clientes`);
    http.verify();
  });
});
