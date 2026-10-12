import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { PanelPage } from './panel-page';
import { PanelEconomico } from '../../../calidad/data-access/calidad.models';

const base = environment.apiBaseUrl;

const panelCompleto: PanelEconomico = {
  zonaId: 'z1',
  litrosEnRiesgoValorizados: 150.5,
  forecastSemana: {
    zonaId: 'z1',
    semanaInicio: '2026-09-21',
    litrosEstimados: 1000,
    litrosReales: null,
    recomendacionMezcla: 'Mantener mezcla actual',
    flujoCajaProyectado: 3500,
    alertaCapacidad: false,
  },
  margenPorCanal: [
    { tipoCliente: 'MAYORISTA', totalVentas: 500 },
    { tipoCliente: 'PROVEEDOR', totalVentas: 200 },
    { tipoCliente: 'PUBLICO', totalVentas: 80 },
  ],
  pctRechazoSiScoreSube10: null,
};

function crear() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(PanelPage);
  http.expectOne(`${base}/admin/zonas`).flush([
    { id: 'z1', nombre: 'Zona Norte', activa: true },
    { id: 'z2', nombre: 'Zona Sur', activa: true },
  ]);
  return { f, http, c: f.componentInstance };
}

describe('PanelPage', () => {
  it('no consulta ningún panel hasta que se elige una zona', () => {
    const { http } = crear();
    http.verify();
  });

  it('al elegir una zona, carga el panel completo con zonaId exacto', () => {
    const { f, http, c } = crear();
    c['cambiarZona']('z1');
    const req = http.expectOne((r) => r.url === `${base}/innovacion/panel-economico`);
    expect(req.request.params.get('zonaId')).toBe('z1');
    req.flush(panelCompleto);
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('150.5');
    expect(f.nativeElement.textContent).toContain('Mantener mezcla actual');
    expect(c['datosVentasCanal']()).toEqual([
      { etiqueta: 'Mayorista', valor: 500 },
      { etiqueta: 'Proveedor', valor: 200 },
      { etiqueta: 'Público', valor: 80 },
    ]);
    http.verify();
  });

  it('pctRechazoSiScoreSube10 null se muestra como "No calculado", nunca como 0%', () => {
    const { f, http, c } = crear();
    c['cambiarZona']('z1');
    http.expectOne((r) => r.url === `${base}/innovacion/panel-economico`).flush(panelCompleto);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No calculado');
    expect(f.nativeElement.textContent).not.toContain('0.00% de rechazo');
  });

  it('un 404 cuyo mensaje indica falta de proyección se muestra como "Sin proyección disponible"', () => {
    const { f, http, c } = crear();
    c['cambiarZona']('z1');
    http
      .expectOne((r) => r.url === `${base}/innovacion/panel-economico`)
      .flush({ mensaje: 'Sin prediccion calculada aun para la zona: z1' }, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    expect(c['sinProyeccion']()).toBe(true);
    expect(c['error']()).toBeNull();
    expect(f.nativeElement.textContent).toContain('Sin proyección disponible');
  });

  it('un 404 de "zona no encontrada" NO se muestra como "Sin proyección disponible"', () => {
    const { f, http, c } = crear();
    c['cambiarZona']('z1');
    http
      .expectOne((r) => r.url === `${base}/innovacion/panel-economico`)
      .flush({ mensaje: 'Zona no encontrada: z1' }, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    expect(c['sinProyeccion']()).toBe(false);
    expect(c['error']()?.status).toBe(404);
    expect(f.nativeElement.textContent).toContain('Zona no encontrada');
  });

  it('un error 500 se muestra como error real, no como "Sin proyección" ni lista vacía', () => {
    const { f, http, c } = crear();
    c['cambiarZona']('z1');
    http.expectOne((r) => r.url === `${base}/innovacion/panel-economico`).flush({}, { status: 500, statusText: 'Server Error' });
    f.detectChanges();
    expect(c['sinProyeccion']()).toBe(false);
    expect(c['error']()?.tipo).toBe('servidor');
  });

  it('un error 403 se muestra como error de permisos', () => {
    const { f, http, c } = crear();
    c['cambiarZona']('z1');
    http.expectOne((r) => r.url === `${base}/innovacion/panel-economico`).flush({}, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect(c['error']()?.tipo).toBe('permiso');
  });

  it('cambiar de zona limpia el panel anterior y vuelve a consultar', () => {
    const { c, http } = crear();
    c['cambiarZona']('z1');
    http.expectOne((r) => r.url === `${base}/innovacion/panel-economico`).flush(panelCompleto);
    expect(c['panel']()).not.toBeNull();

    c['cambiarZona']('z2');
    expect(c['panel']()).toBeNull();
    const req = http.expectOne((r) => r.url === `${base}/innovacion/panel-economico`);
    expect(req.request.params.get('zonaId')).toBe('z2');
    req.flush({ ...panelCompleto, zonaId: 'z2' });
    http.verify();
  });
});
