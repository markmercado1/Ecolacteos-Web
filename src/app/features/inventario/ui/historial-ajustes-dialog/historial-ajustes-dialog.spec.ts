import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { HistorialAjustesDialog, HistorialAjustesDialogData } from './historial-ajustes-dialog';
import { AjusteInventarioResponse } from '../../data-access/inventario.models';
import { PaginaResponse } from '../../../../shared/models/pagina-response';

const base = environment.apiBaseUrl;

function pagina(contenido: AjusteInventarioResponse[], paginaActual = 0, totalElementos = contenido.length): PaginaResponse<AjusteInventarioResponse> {
  return { contenido, paginaActual, tamanoPagina: 10, totalElementos, totalPaginas: Math.ceil(totalElementos / 10) };
}

function ajuste(datos: Partial<AjusteInventarioResponse> & { id: string }): AjusteInventarioResponse {
  return {
    presentacionId: 'pres-1', presentacionNombre: 'Botella 1 L', productoNombre: 'Yogurt de fresa',
    cantidadAnterior: 100, cantidadCorregida: 95, delta: -5, motivo: 'Conteo físico', usuarioNombre: 'Ana Admin',
    creadoEn: '2026-09-28T10:00:00',
    ...datos
  };
}

function crear(data: HistorialAjustesDialogData) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(HistorialAjustesDialog);
  return { c: f.componentInstance, http };
}

const DATA: HistorialAjustesDialogData = {
  presentacionId: 'pres-1',
  presentacionNombre: 'Botella 1 L',
  productoNombre: 'Yogurt de fresa'
};

describe('HistorialAjustesDialog', () => {
  it('consulta el historial de solo esa presentación', () => {
    const { http } = crear(DATA);
    const req = http.expectOne((r) => r.url === `${base}/inventario/ajustes`);
    expect(req.request.params.get('presentacionId')).toBe('pres-1');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    req.flush(pagina([]));
    http.verify();
  });

  it('muestra estado de carga mientras espera la respuesta', () => {
    const { c, http } = crear(DATA);
    expect(c['cargando']()).toBe(true);
    http.expectOne((r) => r.url === `${base}/inventario/ajustes`).flush(pagina([]));
    expect(c['cargando']()).toBe(false);
  });

  it('un error del servidor se muestra y permite reintentar', () => {
    const { c, http } = crear(DATA);
    http.expectOne((r) => r.url === `${base}/inventario/ajustes`).flush(
      { mensaje: 'Error de servidor' },
      { status: 500, statusText: 'Server Error' }
    );
    expect(c['error']()).toBeTruthy();
    expect(c['cargando']()).toBe(false);

    c['cargar']();
    http.expectOne((r) => r.url === `${base}/inventario/ajustes`).flush(pagina([]));
    expect(c['error']()).toBeNull();
    http.verify();
  });

  it('sin ajustes registrados muestra la lista vacía', () => {
    const { c, http } = crear(DATA);
    http.expectOne((r) => r.url === `${base}/inventario/ajustes`).flush(pagina([]));
    expect(c['ajustes']()).toEqual([]);
  });

  it('conserva el orden y los datos que devuelve el servidor (más reciente primero, ya ordenado en backend)', () => {
    const { c, http } = crear(DATA);
    const ajustes = [
      ajuste({ id: 'aj-2', cantidadAnterior: 95, cantidadCorregida: 105, delta: 10 }),
      ajuste({ id: 'aj-1', cantidadAnterior: 100, cantidadCorregida: 95, delta: -5 })
    ];
    http.expectOne((r) => r.url === `${base}/inventario/ajustes`).flush(pagina(ajustes));

    expect(c['ajustes']().map((a) => a.id)).toEqual(['aj-2', 'aj-1']);
    http.verify();
  });

  it('pagina en el servidor, conserva el total y no pide páginas fuera de rango', () => {
    const { c, http } = crear(DATA);
    http.expectOne((r) => r.url === `${base}/inventario/ajustes`).flush(pagina([ajuste({ id: 'aj-1' })], 0, 23));
    expect(c['totalElementos']()).toBe(23);
    expect(c['totalPaginas']()).toBe(3);

    c['irAPagina'](2);
    const req = http.expectOne((r) => r.url === `${base}/inventario/ajustes`);
    expect(req.request.params.get('page')).toBe('2');
    req.flush(pagina([ajuste({ id: 'aj-21' })], 2, 23));
    c['irAPagina'](3);
    http.expectNone((r) => r.url === `${base}/inventario/ajustes`);
    http.verify();
  });
});
