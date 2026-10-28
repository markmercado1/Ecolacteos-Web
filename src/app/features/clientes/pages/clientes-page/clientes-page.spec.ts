import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { Subject } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/auth/auth.service';
import { ImportarExcelDialog } from '../../../../shared/ui/importar-excel/importar-excel-dialog';
import { ClienteResponse } from '../../data-access/cliente.models';
import { ClienteDetalleDialog } from '../../ui/cliente-detalle-dialog/cliente-detalle-dialog';
import { ClientesPage } from './clientes-page';

const base = environment.apiBaseUrl;
const sinAutorizar = { vigente: false, estado: null, medios: [], forma: null, desde: null, avisoVersion: null, avisoCompleto: false };

function cliente(id: string, reservas: ClienteResponse['reservas']): ClienteResponse {
  return {
    id, tipoPersona: 'NATURAL', nombre: 'Cliente ' + id, razonSocial: null, dni: null, ruc: null, correo: null, telefonos: ['••• ••• 321'],
    mayorista: false, tiposHabilitados: [], activo: true, fusionadoEnId: null, creadoEn: '2026-10-24T10:00:00', datosCompletos: false,
    registro: { ...sinAutorizar, vigente: true }, comunicaciones: sinAutorizar, canalHabitual: 'PUBLICO', reservas
  };
}

const pagina = (contenido: ClienteResponse[]) => ({ contenido, paginaActual: 0, tamanoPagina: 20, totalElementos: contenido.length, totalPaginas: 1 });

function crear(rol: string) {
  const cerrado = new Subject<unknown>();
  const open = vi.fn(() => ({ closed: cerrado }));
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { usuario: signal({ rolNombre: rol }) } },
      { provide: Dialog, useValue: { open } }
    ]
  });
  const f = TestBed.createComponent(ClientesPage);
  const http = TestBed.inject(HttpTestingController);
  f.detectChanges();
  return { f, http, open, cerrado, comp: f.componentInstance as unknown as Record<string, any> };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const listado = (http: HttpTestingController) => http.expectOne((r) => r.url === `${base}/clientes`);

describe('ClientesPage (refactor: reservas en la tabla y Excel)', () => {
  it('muestra el resumen de reservas activas con acceso a la ficha, y un guion si no hay', () => {
    const { f, http, open } = crear('VENTAS');
    listado(http).flush(pagina([
      cliente('a', { pendientes: 1, confirmadas: 1, activas: 2, total: 2, proximoRetiro: '2026-10-26' }),
      cliente('b', { pendientes: 0, confirmadas: 0, activas: 0, total: 3, proximoRetiro: null }),
      cliente('c', { pendientes: 0, confirmadas: 0, activas: 0, total: 0, proximoRetiro: null })
    ]));
    f.detectChanges();
    const texto = el(f).textContent ?? '';
    const activas = el(f).querySelector('[data-testid="reservas-activas"]') as HTMLButtonElement;
    expect(activas.textContent).toContain('2 activas');
    expect(texto).toContain('retiro 26/10');
    expect(texto).toContain('Ninguna activa (3)');
    // un solo registro por ficha: no se duplican clientes por tener varias reservas
    expect(el(f).querySelectorAll('[data-testid="reservas-activas"]').length).toBe(1);
    activas.click();
    expect(open).toHaveBeenCalledWith(ClienteDetalleDialog, expect.objectContaining({ data: { id: 'a', esAdmin: false } }));
    http.verify();
  });

  it('al cerrar la ficha con cambios recarga la tabla (resumen actualizado)', () => {
    const { f, http, cerrado, comp } = crear('VENTAS');
    listado(http).flush(pagina([cliente('a', { pendientes: 0, confirmadas: 1, activas: 1, total: 1, proximoRetiro: '2026-10-26' })]));
    f.detectChanges();
    comp['abrir'](cliente('a', { pendientes: 0, confirmadas: 1, activas: 1, total: 1, proximoRetiro: '2026-10-26' }));
    cerrado.next(true);
    listado(http).flush(pagina([cliente('a', { pendientes: 0, confirmadas: 0, activas: 0, total: 1, proximoRetiro: null })]));
    f.detectChanges();
    expect(el(f).textContent).toContain('Ninguna activa (1)');
    http.verify();
  });

  it('VENTAS no ve exportar ni importar (endpoints solo ADMIN)', () => {
    const { f, http } = crear('VENTAS');
    listado(http).flush(pagina([]));
    f.detectChanges();
    expect(el(f).querySelector('ui-exportar-excel')).toBeNull();
    expect(el(f).textContent).not.toContain('Importar desde Excel');
    http.verify();
  });

  it('ADMIN exporta con los mismos filtros y búsqueda de la tabla e importa con el diálogo común', () => {
    const { f, http, open, comp } = crear('ADMIN');
    listado(http).flush(pagina([]));
    comp['cambiarFiltro']('CON_PROMOCIONES');
    const req = listado(http);
    expect(req.request.params.get('conComunicaciones')).toBe('true');
    req.flush(pagina([]));
    comp['buscar']('rosa');
    listado(http).flush(pagina([]));
    f.detectChanges();
    expect(el(f).querySelector('ui-exportar-excel')).toBeTruthy();
    expect(comp['filtroExportacion']()).toEqual({ activo: true, mayorista: undefined, conComunicaciones: true, busqueda: 'rosa' });
    comp['importarExcel']();
    expect(open).toHaveBeenCalledWith(ImportarExcelDialog, expect.objectContaining({ data: { tipo: 'clientes', nombre: 'clientes' } }));
    http.verify();
  });
});
