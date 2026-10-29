import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { PanelPage } from './panel-page';
import { PanelEconomico } from '../../../calidad/data-access/calidad.models';

const base = environment.apiBaseUrl;
const urlPanel = (r: { url: string }) => r.url === `${base}/innovacion/panel-economico`;

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

const panelZona2: PanelEconomico = {
  ...panelCompleto,
  zonaId: 'z2',
  litrosEnRiesgoValorizados: 49.5,
  forecastSemana: { ...panelCompleto.forecastSemana, zonaId: 'z2', litrosEstimados: 500.5, flujoCajaProyectado: 1500.25, alertaCapacidad: true },
  pctRechazoSiScoreSube10: 12.5,
};

const ZONAS = [
  { id: 'z1', nombre: 'Zona Norte', activa: true },
  { id: 'z2', nombre: 'Zona Sur', activa: true },
  { id: 'z3', nombre: 'Zona Vieja', activa: false },
];

/** Tipos de precio que el panel consulta para poner nombre a los canales del gráfico de ventas. */
const TIPOS_PRECIO = [{ codigo: 'RESTAURANT_111', nombre: 'Restaurante' }] as never[];

/** Crea la página y responde las zonas. Al abrir, la vista inicial es el consolidado: una petición por zona ACTIVA. */
function abrir() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(PanelPage);
  http.expectOne(`${base}/admin/zonas`).flush(ZONAS);
  http.expectOne((r) => r.url === `${base}/tipos-precio`).flush(TIPOS_PRECIO);
  return { f, http, c: f.componentInstance };
}

const peticion = (http: HttpTestingController, zonaId: string): TestRequest =>
  http.expectOne((r) => urlPanel(r) && r.params.get('zonaId') === zonaId);

/** Para las pruebas del detalle de una zona: abre y resuelve el consolidado inicial sin interés. */
function crear() {
  const x = abrir();
  peticion(x.http, 'z1').flush(panelCompleto);
  peticion(x.http, 'z2').flush(panelZona2);
  return x;
}

const texto = (f: { nativeElement: HTMLElement }) => (f.nativeElement.textContent ?? '').replace(/\s+/g, ' ');
const q = (f: { nativeElement: HTMLElement }, testid: string) => f.nativeElement.querySelector(`[data-testid="${testid}"]`)?.textContent?.replace(/\s+/g, ' ').trim();

describe('PanelPage · vista consolidada (inicial)', () => {
  it('al abrir pide el panel de cada zona ACTIVA (no de las inactivas) y no hay selección de zona', () => {
    const { http, c } = abrir();
    const reqs = http.match(urlPanel);
    expect(reqs.map((r) => r.request.params.get('zonaId')).sort()).toEqual(['z1', 'z2']);
    expect(c['esConsolidado']()).toBe(true);
    reqs.forEach((r) => r.flush(panelCompleto));
    http.verify();
  });

  it('el gráfico de ventas muestra el nombre del tipo de precio y no su código interno (RESTAURANT_111 → Restaurante)', () => {
    const { f, http, c } = abrir();
    const conTipoNuevo = { ...panelCompleto, margenPorCanal: [...panelCompleto.margenPorCanal, { tipoCliente: 'RESTAURANT_111', totalVentas: 11 }] };
    peticion(http, 'z1').flush(conTipoNuevo);
    peticion(http, 'z2').flush(conTipoNuevo);
    f.detectChanges();
    const etiquetas = (c['datosVentasConsolidado']() as { etiqueta: string }[]).map((d) => d.etiqueta);
    expect(etiquetas).toContain('Restaurante');
    expect(etiquetas).not.toContain('RESTAURANT_111');
  });

  it('suma riesgo, litros estimados y flujo de caja de las zonas con datos y cuenta las alertas de capacidad', () => {
    const { f, http } = abrir();
    peticion(http, 'z1').flush(panelCompleto);
    peticion(http, 'z2').flush(panelZona2);
    f.detectChanges();

    expect(q(f, 'kpi-riesgo')).toBe('S/ 200.00'); // 150.5 + 49.5
    expect(q(f, 'kpi-litros')).toBe('1,500.5 L'); // 1000 + 500.5
    expect(q(f, 'kpi-flujo')).toBe('S/ 5,000.25'); // 3500 + 1500.25
    expect(q(f, 'kpi-alertas')).toBe('1 de 2');
    expect(q(f, 'barra-consolidado')).toContain('Consolidado · todas las zonas activas');
    expect(q(f, 'barra-consolidado')).toContain('Datos de 2 de 2 zonas');
    http.verify();
  });

  it('la tabla lista cada zona activa con su rechazo estimado y «No calculado» cuando es null', () => {
    const { f, http } = abrir();
    peticion(http, 'z1').flush(panelCompleto);
    peticion(http, 'z2').flush(panelZona2);
    f.detectChanges();
    const tabla = (f.nativeElement.querySelector('ui-data-table')?.textContent ?? '').replace(/\s+/g, ' ');
    expect(tabla).toContain('Zona Norte');
    expect(tabla).toContain('Zona Sur');
    expect(tabla).not.toContain('Zona Vieja'); // inactiva: no entra en el consolidado (sí figura en el selector, marcada)
    expect(tabla).toContain('No calculado'); // z1: pct null, nunca 0%
    expect(tabla).toContain('12.5%'); // z2
    expect(texto(f)).toContain('Zona Vieja (inactiva)'); // en el selector, para poder ver su detalle
    http.verify();
  });

  it('una zona sin proyección se lista como «Sin proyección» y NO entra en las sumas', () => {
    const { f, http, c } = abrir();
    peticion(http, 'z1').flush(panelCompleto);
    peticion(http, 'z2').flush({ mensaje: 'Sin prediccion calculada aun para la zona: z2' }, { status: 404, statusText: 'Not Found' });
    f.detectChanges();

    expect(q(f, 'kpi-riesgo')).toBe('S/ 150.50'); // solo z1
    expect(q(f, 'barra-consolidado')).toContain('Datos de 1 de 2 zonas');
    expect(q(f, 'barra-consolidado')).toContain('1 sin proyección');
    expect(texto(f)).toContain('Sin proyección');
    expect(c['consolidado']().zonasSinProyeccion).toBe(1);
    http.verify();
  });

  it('un error real de una zona se marca como error (no como «sin proyección») y no tumba a las demás', () => {
    const { f, http, c } = abrir();
    peticion(http, 'z1').flush(panelCompleto);
    peticion(http, 'z2').flush({}, { status: 500, statusText: 'Server Error' });
    f.detectChanges();

    expect(c['consolidado']().zonasConError).toBe(1);
    expect(c['consolidado']().zonasSinProyeccion).toBe(0);
    expect(q(f, 'barra-consolidado')).toContain('1 con error');
    expect(q(f, 'kpi-riesgo')).toBe('S/ 150.50');
    http.verify();
  });

  it('un 404 que NO es por falta de proyección (p. ej. zona inexistente) es un error, no «sin proyección»', () => {
    const { http, c } = abrir();
    peticion(http, 'z1').flush({ mensaje: 'Zona no encontrada: z1' }, { status: 404, statusText: 'Not Found' });
    peticion(http, 'z2').flush(panelZona2);
    expect(c['consolidado']().zonasConError).toBe(1);
    expect(c['consolidado']().zonasSinProyeccion).toBe(0);
    http.verify();
  });

  it('si ninguna zona tiene datos no muestra totales en cero: lo dice y deja ver el estado de cada zona', () => {
    const { f, http } = abrir();
    const sin = { mensaje: 'Sin prediccion calculada aun' };
    peticion(http, 'z1').flush(sin, { status: 404, statusText: 'Not Found' });
    peticion(http, 'z2').flush(sin, { status: 404, statusText: 'Not Found' });
    f.detectChanges();

    expect(q(f, 'kpi-riesgo')).toBeUndefined();
    expect(texto(f)).toContain('Ninguna zona tiene datos para consolidar');
    expect(texto(f)).toContain('Zona Norte');
    http.verify();
  });

  it('avisa cuando las proyecciones son de semanas distintas', () => {
    const { f, http } = abrir();
    peticion(http, 'z1').flush(panelCompleto);
    peticion(http, 'z2').flush({ ...panelZona2, forecastSemana: { ...panelZona2.forecastSemana, semanaInicio: '2026-09-28' } });
    f.detectChanges();
    expect(q(f, 'aviso-semanas')).toContain('2026-09-21, 2026-09-28');
    http.verify();
  });

  it('con una sola semana no muestra el aviso', () => {
    const { f, http } = crear();
    f.detectChanges();
    expect(q(f, 'aviso-semanas')).toBeUndefined();
    http.verify();
  });

  it('las ventas por canal se toman una sola vez (son globales), no se suman por zona', () => {
    const { c } = crear();
    expect(c['datosVentasConsolidado']()).toEqual([
      { etiqueta: 'Mayorista', valor: 500 },
      { etiqueta: 'Proveedor', valor: 200 },
      { etiqueta: 'Público', valor: 80 },
    ]);
  });

  it('sin zonas activas no consulta nada y lo dice', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(PanelPage);
    http.expectOne(`${base}/admin/zonas`).flush([{ id: 'z3', nombre: 'Zona Vieja', activa: false }]);
    http.expectOne((r) => r.url === `${base}/tipos-precio`).flush([]);
    f.detectChanges();
    http.expectNone(urlPanel);
    expect(texto(f)).toContain('No hay zonas activas para consolidar');
  });

  it('«Ver zona» pasa al detalle y «← Todas las zonas» vuelve al consolidado', () => {
    const { f, http, c } = crear();
    c['cambiarZona']('z1');
    peticion(http, 'z1').flush(panelCompleto);
    f.detectChanges();
    expect(c['esConsolidado']()).toBe(false);
    expect(q(f, 'barra-zona')).toContain('Zona: Zona Norte');
    expect(q(f, 'barra-zona')).toContain('Todas las zonas');
    expect(q(f, 'barra-consolidado')).toBeUndefined();

    c['cambiarZona']('todas');
    peticion(http, 'z1').flush(panelCompleto);
    peticion(http, 'z2').flush(panelZona2);
    f.detectChanges();
    expect(c['esConsolidado']()).toBe(true);
    expect(q(f, 'kpi-riesgo')).toBe('S/ 200.00');
    http.verify();
  });

  it('si el usuario cambia de vista mientras carga el consolidado, se descarta esa carga', () => {
    const { http, c } = abrir();
    const pendientes = http.match(urlPanel);
    c['cambiarZona']('z1');
    pendientes.forEach((r) => expect(r.cancelled).toBe(true));
    peticion(http, 'z1').flush(panelCompleto);
    expect(c['resultados']()).toEqual([]); // nada del consolidado cancelado llegó a la pantalla
  });

  it('si no se pueden cargar las zonas lo dice con «Reintentar»', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(PanelPage);
    http.expectOne(`${base}/admin/zonas`).flush({}, { status: 500, statusText: 'Server Error' });
    http.expectOne((r) => r.url === `${base}/tipos-precio`).flush([]);
    f.detectChanges();
    expect(texto(f)).toContain('No se pudieron cargar las zonas');
    http.verify();
  });
});

describe('PanelPage · detalle de una zona', () => {
  it('al elegir una zona, carga el panel completo con zonaId exacto', () => {
    const { f, http, c } = crear();
    c['cambiarZona']('z1');
    const req = http.expectOne(urlPanel);
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
    http.expectOne(urlPanel).flush(panelCompleto);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No calculado');
    expect(f.nativeElement.textContent).not.toContain('0.00% de rechazo');
  });

  it('un 404 cuyo mensaje indica falta de proyección se muestra como "Sin proyección disponible"', () => {
    const { f, http, c } = crear();
    c['cambiarZona']('z1');
    http.expectOne(urlPanel).flush({ mensaje: 'Sin prediccion calculada aun para la zona: z1' }, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    expect(c['sinProyeccion']()).toBe(true);
    expect(c['error']()).toBeNull();
    expect(f.nativeElement.textContent).toContain('Sin proyección disponible');
  });

  it('un 404 de "zona no encontrada" NO se muestra como "Sin proyección disponible"', () => {
    const { f, http, c } = crear();
    c['cambiarZona']('z1');
    http.expectOne(urlPanel).flush({ mensaje: 'Zona no encontrada: z1' }, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    expect(c['sinProyeccion']()).toBe(false);
    expect(c['error']()?.status).toBe(404);
    expect(f.nativeElement.textContent).toContain('Zona no encontrada');
  });

  it('un error 500 se muestra como error real, no como "Sin proyección" ni lista vacía', () => {
    const { f, http, c } = crear();
    c['cambiarZona']('z1');
    http.expectOne(urlPanel).flush({}, { status: 500, statusText: 'Server Error' });
    f.detectChanges();
    expect(c['sinProyeccion']()).toBe(false);
    expect(c['error']()?.tipo).toBe('servidor');
  });

  it('un error 403 se muestra como error de permisos', () => {
    const { f, http, c } = crear();
    c['cambiarZona']('z1');
    http.expectOne(urlPanel).flush({}, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect(c['error']()?.tipo).toBe('permiso');
  });

  it('cambiar de zona limpia el panel anterior y vuelve a consultar', () => {
    const { c, http } = crear();
    c['cambiarZona']('z1');
    http.expectOne(urlPanel).flush(panelCompleto);
    expect(c['panel']()).not.toBeNull();

    c['cambiarZona']('z2');
    expect(c['panel']()).toBeNull();
    const req = http.expectOne(urlPanel);
    expect(req.request.params.get('zonaId')).toBe('z2');
    req.flush({ ...panelCompleto, zonaId: 'z2' });
    http.verify();
  });
});
