import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { Kardex } from '../../data-access/kardex.models';
import { KardexVistaComponent } from './kardex-vista';

const url = `${environment.apiBaseUrl}/inventario/kardex/insumos/i1`;

function kardex(paginaActual = 0, totalPaginas = 1): Kardex {
  return {
    tipoItem: 'INSUMO', itemId: 'i1', itemNombre: 'Sal', unidadMedida: 'kg', desde: '2026-10-01', hasta: '2026-10-31',
    saldoInicial: 20, totalEntradas: 5, totalSalidas: 10, saldoFinal: 15,
    movimientos: {
      contenido: [
        { id: 'm1', fecha: '2026-10-01T08:00:00', tipoMovimiento: 'INGRESO', entrada: 5, salida: null, saldo: 25,
          documentoTipo: 'INGRESO', documentoId: null, documentoFecha: null, referencia: 'Guía 77', usuarioNombre: 'Ana', motivo: null },
        { id: 'm2', fecha: '2026-10-02T09:30:00', tipoMovimiento: 'SALIDA_PRODUCCION', entrada: null, salida: 10, saldo: 15,
          documentoTipo: 'LOTE', documentoId: 'l1', documentoFecha: '2026-10-02', referencia: 'Lote de producción · Queso Andino', usuarioNombre: 'Luis', motivo: null }
      ],
      paginaActual, tamanoPagina: 50, totalElementos: 2, totalPaginas
    }
  };
}

function crear() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(KardexVistaComponent);
  f.componentRef.setInput('tipo', 'INSUMO');
  f.componentRef.setInput('itemId', 'i1');
  f.detectChanges();
  return { f, http, c: f.componentInstance };
}

describe('KardexVistaComponent', () => {
  it('por defecto consulta el mes actual y muestra totales, saldo por fila y documento de origen', () => {
    const { f, http } = crear();
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.params.get('desde')).toMatch(/^\d{4}-\d{2}-01$/);
    expect(req.request.params.get('hasta')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    req.flush(kardex());
    f.detectChanges();
    const texto = f.nativeElement.textContent;
    expect(texto).toContain('Saldo inicial');
    expect(texto).toContain('Saldo final');
    expect(texto).toContain('Ingreso');
    expect(texto).toContain('Consumo en producción');
    expect(texto).toContain('Lote de producción · Queso Andino');
    expect(texto).toContain('Guía 77');
    expect(texto).toContain('sin costos');
    http.verify();
  });

  it('"Todo el historial" consulta sin período y reinicia la página', () => {
    const { c, http } = crear();
    http.expectOne((r) => r.url === url).flush(kardex(0, 3));
    c['irA'](1);
    expect(http.expectOne((r) => r.url === url).request.params.get('page')).toBe('1');
    c['todoElHistorial']();
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.params.has('desde')).toBe(false);
    expect(req.request.params.has('hasta')).toBe(false);
    expect(req.request.params.get('page')).toBe('0');
  });

  it('valida el período en el cliente sin consultar', () => {
    const { c, http } = crear();
    http.expectOne((r) => r.url === url).flush(kardex());
    c['desde'].set('2026-10-20');
    c['hasta'].set('2026-10-01');
    c['aplicar']();
    http.expectNone((r) => r.url === url);
    expect(c['errorFiltro']()).toContain('no puede ser posterior');
  });

  it('un error se muestra con reintento, no como kardex vacío', () => {
    const { f, http } = crear();
    http.expectOne((r) => r.url === url).flush({ mensaje: 'No tiene permisos' }, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect(f.componentInstance['error']()?.status).toBe(403);
    expect(f.nativeElement.textContent).not.toContain('No hay movimientos');
  });
});
