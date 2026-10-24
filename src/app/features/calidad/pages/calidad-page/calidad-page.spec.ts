import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { Dialog } from '@angular/cdk/dialog';
import { CalidadPage } from './calidad-page';
import { PreciosCalidadEntregaDialog } from '../../ui/precios-calidad-entrega-dialog/precios-calidad-entrega-dialog';
import { HistorialConsolidadoDialog } from '../../../historial-proveedor/ui/historial-consolidado-dialog/historial-consolidado-dialog';

const base = environment.apiBaseUrl;

function crear() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(CalidadPage);
  http.expectOne(`${base}/zonas/operativo`).flush([{ id: 'z1', nombre: 'Zona 1', activa: true }]);
  http.expectOne(`${base}/proveedores/operativo`).flush([
    { id: 'p1', nombre: 'Productor Uno', zonaActualId: 'z1', zonaActualNombre: 'Zona 1', codigoQr: 'QR1' },
  ]);
  http.expectOne((r) => r.url === `${base}/registros-acopio`).flush([]);
  http.expectOne((r) => r.url === `${base}/analisis-calidad/bandeja`).flush([]);
  return { f, http, c: f.componentInstance };
}

describe('CalidadPage', () => {
  it('carga pendientes (sinAnalisis=true) y bandeja del día al iniciar', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(CalidadPage);
    http.expectOne(`${base}/zonas/operativo`).flush([]);
    http.expectOne(`${base}/proveedores/operativo`).flush([]);
    const pendientes = http.expectOne((r) => r.url === `${base}/registros-acopio`);
    expect(pendientes.request.params.get('sinAnalisis')).toBe('true');
    pendientes.flush([
      {
        id: 'r1',
        uuidCliente: 'u1',
        proveedorId: 'p1',
        proveedorNombre: 'Productor Uno',
        unidadId: 'un1',
        fechaHora: '2026-09-17T08:00:00',
        litros: 10,
        gpsLat: null,
        gpsLng: null,
        motivoObservacion: null,
        litrosPorVoz: null,
        sincronizadoEn: null,
        fotoUrl: null,
        disponibleParaLote: null,
        jornadaId: null,
      },
    ]);
    const bandeja = http.expectOne((r) => r.url === `${base}/analisis-calidad/bandeja`);
    expect(bandeja.request.params.get('fecha')).toBe(f.componentInstance['fechaBandeja']());
    bandeja.flush([]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Productor Uno');
    http.verify();
  });

  it('conserva el error 403 de pendientes en vez de vaciar la lista silenciosamente', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    TestBed.createComponent(CalidadPage);
    http.expectOne(`${base}/zonas/operativo`).flush([]);
    http.expectOne(`${base}/proveedores/operativo`).flush([]);
    http.expectOne((r) => r.url === `${base}/registros-acopio`).flush({}, { status: 403, statusText: 'Forbidden' });
    http.expectOne((r) => r.url === `${base}/analisis-calidad/bandeja`).flush([]);
    http.verify();
  });

  it('busca análisis por folio y muestra las mediciones devueltas', () => {
    const { f, http, c } = crear();
    c['pestana'].set('consulta');
    c['tipoBusqueda'].set('folio');
    c['textoBusqueda'].set('F-001');
    c['buscarConsulta']();
    const req = http.expectOne(`${base}/analisis-calidad/folio/F-001`);
    req.flush([
      {
        id: 'a1',
        registroAcopioId: 'r1',
        folioMuestra: 'F-001',
        agua: 2.5,
        proteina: 3.1,
        lactosa: 4.6,
        densidad: 1.03,
        temperatura: 4,
        ph: 6.7,
        aguaAnadida: false,
        resultado: 'APROBADO',
        creadoEn: '2026-09-17T09:00:00',
      },
    ]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('F-001');
    expect(f.nativeElement.textContent).toContain('APROBADO');
    http.verify();
  });

  it('desde un pendiente, "Ver análisis" salta a consulta y busca por ese registro', () => {
    const { c, http } = crear();
    c['verAnalisisDeRegistro']('r1');
    expect(c['pestana']()).toBe('consulta');
    expect(c['tipoBusqueda']()).toBe('registro');
    const req = http.expectOne(`${base}/analisis-calidad/registro/r1`);
    req.flush([]);
    http.verify();
  });

  it('alertasPorZona se consulta al elegir una zona, con zonaId exacto', () => {
    const { c, http } = crear();
    c['cambiarZonaAlertas']('z1');
    const req = http.expectOne((r) => r.url === `${base}/innovacion/alertas`);
    expect(req.request.params.get('zonaId')).toBe('z1');
    req.flush([
      { id: 'al1', registroAcopioId: 'r1', proveedorId: 'p1', proveedorNombre: 'Productor Uno', tipo: 'VOLUMEN_ATIPICO', zScore: 2.4, severidad: 'MEDIA', creadoEn: '2026-09-17T10:00:00' },
    ]);
    expect(c['alertas']()?.length).toBe(1);
    http.verify();
  });

  it('score 404 se muestra como "sin cálculo todavía", no como error ni como cero', () => {
    const { c, http } = crear();
    c['cambiarProveedorScore']('p1');
    const reqScore = http.expectOne(`${base}/innovacion/score/p1`);
    reqScore.flush({ mensaje: 'Sin score calculado aun para el proveedor: p1' }, { status: 404, statusText: 'Not Found' });
    const reqPrediccion = http.expectOne(`${base}/innovacion/prediccion/p1`);
    reqPrediccion.flush({ proveedorId: 'p1', fechaPrevista: '2026-09-24', litrosEstimadosMin: 8, litrosEstimadosMax: 15 });

    expect(c['sinScore']()).toBe(true);
    expect(c['errorScore']()).toBeNull();
    expect(c['score']()).toBeNull();
    expect(c['prediccion']()?.litrosEstimadosMax).toBe(15);
    http.verify();
  });

  it('un error real de score (no 404) se muestra como error, no como "sin cálculo"', () => {
    const { c, http } = crear();
    c['cambiarProveedorScore']('p1');
    const reqScore = http.expectOne(`${base}/innovacion/score/p1`);
    reqScore.flush({}, { status: 500, statusText: 'Server Error' });
    http.expectOne(`${base}/innovacion/prediccion/p1`).flush({ proveedorId: 'p1', fechaPrevista: '2026-09-24', litrosEstimadosMin: 8, litrosEstimadosMax: 15 });

    expect(c['sinScore']()).toBe(false);
    expect(c['errorScore']()?.status).toBe(500);
    http.verify();
  });

  describe('precios de calidad (acceso de CALIDAD sin pasar por pagos)', () => {
    function crearConDialogo() {
      const abrir = vi.fn();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Dialog, useValue: { open: abrir } }]
      });
      const http = TestBed.inject(HttpTestingController);
      const f = TestBed.createComponent(CalidadPage);
      http.expectOne(`${base}/zonas/operativo`).flush([]);
      http.expectOne(`${base}/proveedores/operativo`).flush([]);
      http.expectOne((r) => r.url === `${base}/registros-acopio`).flush([]);
      http.expectOne((r) => r.url === `${base}/analisis-calidad/bandeja`).flush([
        { registroAcopioId: 'r-9', proveedorId: 'p1', proveedorNombre: 'Productor Uno', fechaHora: '2026-09-17T08:00:00', litros: 10, resultado: 'RECHAZADO' }
      ]);
      return { f, http, abrir };
    }

    it('cada entrega de la bandeja ofrece «Precios de calidad», que abre el historial de esa entrega', () => {
      const { f, http, abrir } = crearConDialogo();
      f.componentInstance['pestana'].set('bandeja');
      f.detectChanges();
      const boton = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Precios de calidad'))!;
      expect(boton).toBeDefined();
      boton.click();
      expect(abrir).toHaveBeenCalledWith(PreciosCalidadEntregaDialog, expect.objectContaining({
        data: { registroAcopioId: 'r-9', proveedorNombre: 'Productor Uno' }
      }));
      http.verify();
    });

    it('cada entrega de la bandeja ofrece «Historial», que abre el historial consolidado del proveedor', () => {
      const { f, http, abrir } = crearConDialogo();
      f.componentInstance['pestana'].set('bandeja');
      f.detectChanges();
      const boton = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Historial')!;
      expect(boton).toBeDefined();
      boton.click();
      expect(abrir).toHaveBeenCalledWith(HistorialConsolidadoDialog, expect.objectContaining({
        data: { proveedorId: 'p1', proveedorNombre: 'Productor Uno' }
      }));
      http.verify();
    });

    it('desde la consulta por registro también se puede ver, con el id del registro', () => {
      const { f, http, abrir } = crearConDialogo();
      f.componentInstance['verPreciosDeCalidad']('r-7');
      expect(abrir).toHaveBeenCalledWith(PreciosCalidadEntregaDialog, expect.objectContaining({
        data: { registroAcopioId: 'r-7', proveedorNombre: undefined }
      }));
      http.verify();
    });
  });
});
