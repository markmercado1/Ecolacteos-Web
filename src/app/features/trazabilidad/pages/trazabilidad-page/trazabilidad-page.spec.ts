import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/auth/auth.service';
import { TrazabilidadPage } from './trazabilidad-page';

const base = `${environment.apiBaseUrl}`;
const lote = {
  id: 'l1', insumoId: 'i1', insumoNombre: 'azucar', unidadMedida: 'kg', codigo: 'AZU-20261029-01', codigoProveedor: 'P-77', fechaIngreso: '2026-10-29',
  fechaVencimiento: '2026-12-31', proveedorId: 'p1', proveedorNombre: 'Distribuidora Andina', proveedorRuc: '20100070970', documentoIngresoId: 'd1',
  tipoDocumento: 'FACTURA', numeroDocumento: 'F001-0234', cantidadInicial: 100, cantidadDisponible: 90, estado: 'VIGENTE', diasParaVencer: 60
};
const respuesta = {
  consulta: 'AZU',
  lotesInsumo: [{
    lote,
    documento: { id: 'd1', tipo: 'FACTURA', numero: 'F001-0234', fecha: '2026-10-28', proveedorNombre: 'Distribuidora Andina', proveedorRuc: '20100070970', usuarioNombre: 'Ana', creadoEn: '2026-10-29T10:00:00' },
    adjuntos: [{ id: 'a1', entidadTipo: 'DOCUMENTO_INGRESO', entidadId: 'd1', nombreOriginal: 'recibo.jpg', contentType: 'image/jpeg', tamanoBytes: 20480, subidoPorNombre: 'Ana', subidoEn: '2026-10-29T10:01:00', urlContenido: '/api/adjuntos/a1/contenido' }],
    movimientos: [
      { fecha: '2026-10-29T10:00:00', tipo: 'INGRESO', cantidad: 100, usuarioNombre: 'Ana', motivo: null, referencia: 'Factura F001-0234' },
      { fecha: '2026-10-30T09:00:00', tipo: 'SALIDA_PRODUCCION', cantidad: -10, usuarioNombre: 'Luis', motivo: null, referencia: null }
    ],
    producciones: [{ loteProduccionId: 'lp1', fecha: '2026-10-30', productoNombre: 'Yogurt de guanábana', cantidad: 10 }]
  }],
  lotesProduccion: []
};

function crear(rol: string) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { usuario: () => ({ rolNombre: rol }) } }]
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(TrazabilidadPage);
  f.detectChanges();
  return { f, c: f.componentInstance as any, http };
}

describe('TrazabilidadPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('pide al menos 2 caracteres y no llama al servidor con menos', () => {
    const { c, http } = crear('PRODUCCION');
    c['texto'].set('a');
    c['buscar']();
    expect(c['aviso']()).toContain('2 caracteres');
    http.expectNone((r) => r.url.includes('/trazabilidad/'));
  });

  it('muestra el origen del lote: proveedor, documento, recibo, movimientos y producciones donde se usó', () => {
    const { f, c, http } = crear('PRODUCCION');
    c['texto'].set(' AZU ');
    c['buscar']();
    const req = http.expectOne((r) => r.url === `${base}/inventario/trazabilidad/lotes` && r.params.get('q') === 'AZU');
    req.flush(respuesta);
    f.detectChanges();
    const t = f.nativeElement.textContent as string;
    for (const x of ['AZU-20261029-01', 'Distribuidora Andina', 'RUC 20100070970', 'F001-0234', 'recibo.jpg', 'Ingreso', 'Consumo en producción', 'Yogurt de guanábana', 'P-77']) {
      expect(t).toContain(x);
    }
  });

  it('un lote sin resultados lo dice, y una producción lista los lotes de insumo que consumió', () => {
    const { f, c, http } = crear('CALIDAD');
    c['texto'].set('zzz');
    c['buscar']();
    http.expectOne((r) => r.url.endsWith('/trazabilidad/lotes')).flush({ consulta: 'zzz', lotesInsumo: [], lotesProduccion: [] });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No hay lotes con «zzz»');

    c['texto'].set('lp1-id');
    c['buscar']();
    http.expectOne((r) => r.url.endsWith('/trazabilidad/lotes')).flush({
      consulta: 'lp1-id', lotesInsumo: [], lotesProduccion: [{ id: 'lp1', fecha: '2026-10-30', productoNombre: 'Yogurt', insumos: [
        { insumoNombre: 'azucar', unidadMedida: 'kg', lotes: [{ loteId: 'l1', codigo: 'AZU-1', codigoProveedor: null, proveedorNombre: 'Dist', fechaVencimiento: null, cantidad: 7 }] }] }]
    });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('AZU-1');
    expect(f.nativeElement.textContent).toContain('azucar');
  });

  it('solo PRODUCCION y ADMIN pueden adjuntar; CALIDAD solo consulta', () => {
    for (const [rol, puede] of [['PRODUCCION', true], ['ADMIN', true], ['CALIDAD', false]] as const) {
      TestBed.resetTestingModule();
      const { f, c, http } = crear(rol);
      c['texto'].set('AZU');
      c['buscar']();
      http.expectOne((r) => r.url.endsWith('/trazabilidad/lotes')).flush(respuesta);
      f.detectChanges();
      expect(f.nativeElement.textContent.includes('Adjuntar recibo'), rol).toBe(puede);
    }
  });

  it('adjuntar valida el archivo (tamaño y tipo) antes de subir, y sube al documento del lote', () => {
    const { f, c, http } = crear('PRODUCCION');
    c['texto'].set('AZU');
    c['buscar']();
    http.expectOne((r) => r.url.endsWith('/trazabilidad/lotes')).flush(respuesta);
    f.detectChanges();
    const t = respuesta.lotesInsumo[0];
    const entrada = (archivo: File) => ({ files: [archivo], value: 'x' }) as unknown as HTMLInputElement;

    c['adjuntar'](t, entrada(new File(['hola'], 'nota.txt', { type: 'text/plain' })));          // tipo no permitido
    http.expectNone((r) => r.url.endsWith('/adjuntos'));
    c['adjuntar'](t, entrada(new File([new Uint8Array(11 * 1024 * 1024)], 'grande.pdf', { type: 'application/pdf' })));   // más de 10 MB
    http.expectNone((r) => r.url.endsWith('/adjuntos'));

    c['adjuntar'](t, entrada(new File([new Uint8Array([1, 2, 3])], 'recibo2.jpg', { type: 'image/jpeg' })));
    const req = http.expectOne(`${base}/inventario/ingresos/d1/adjuntos`);
    expect(req.request.method).toBe('POST');
    expect((req.request.body as FormData).get('file')).toBeInstanceOf(File);
    req.flush({ id: 'a2' }, { status: 201, statusText: 'Created' });
    http.expectOne((r) => r.url.endsWith('/trazabilidad/lotes')).flush(respuesta);     // recarga el resultado
  });

  it('ver baja el recibo con la sesión y lo abre con una dirección temporal', () => {
    const { c, http } = crear('PRODUCCION');
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    (URL as any).createObjectURL = vi.fn(() => 'blob:temporal');
    (URL as any).revokeObjectURL = vi.fn();
    c['ver'](respuesta.lotesInsumo[0].adjuntos[0]);
    const req = http.expectOne(`${base}/adjuntos/a1/contenido`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x'], { type: 'image/jpeg' }));
    expect(abrir).toHaveBeenCalledWith('blob:temporal', '_blank', 'noopener');
    abrir.mockRestore();
  });
});
