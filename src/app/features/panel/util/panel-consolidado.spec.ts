import { HttpErrorResponse } from '@angular/common/http';
import { PanelEconomico } from '../../calidad/data-access/calidad.models';
import { ResultadoZonaPanel, clasificarErrorPanel, consolidar } from './panel-consolidado';

function panel(zonaId: string, riesgo: number, litros: number, flujo: number, alerta = false, semana = '2026-09-21'): PanelEconomico {
  return {
    zonaId,
    litrosEnRiesgoValorizados: riesgo,
    forecastSemana: { zonaId, semanaInicio: semana, litrosEstimados: litros, litrosReales: null, recomendacionMezcla: 'x', flujoCajaProyectado: flujo, alertaCapacidad: alerta },
    margenPorCanal: [{ tipoCliente: 'MAYORISTA', totalVentas: 10 }],
    pctRechazoSiScoreSube10: null,
  };
}

const ok = (id: string, p: PanelEconomico): ResultadoZonaPanel => ({ zona: { id, nombre: id }, estado: 'ok', panel: p, mensaje: null });
const sin = (id: string): ResultadoZonaPanel => ({ zona: { id, nombre: id }, estado: 'sinProyeccion', panel: null, mensaje: null });
const err = (id: string): ResultadoZonaPanel => ({ zona: { id, nombre: id }, estado: 'error', panel: null, mensaje: 'boom' });

describe('consolidar', () => {
  it('suma solo las zonas con datos', () => {
    const c = consolidar([ok('a', panel('a', 100, 1000, 500, true)), ok('b', panel('b', 50.5, 250.25, 99.75)), sin('c'), err('d')]);
    expect(c.zonasTotales).toBe(4);
    expect(c.zonasConDatos).toBe(2);
    expect(c.zonasSinProyeccion).toBe(1);
    expect(c.zonasConError).toBe(1);
    expect(c.riesgoValorizadoTotal).toBe(150.5);
    expect(c.litrosEstimadosTotal).toBe(1250.25);
    expect(c.flujoCajaTotal).toBe(599.75);
    expect(c.zonasConAlertaCapacidad).toBe(1);
  });

  it('suma en céntimos: 0.1 + 0.2 da 0.3, sin arrastrar error de coma flotante', () => {
    const c = consolidar([ok('a', panel('a', 0.1, 0.1, 0.1)), ok('b', panel('b', 0.2, 0.2, 0.2))]);
    expect(c.riesgoValorizadoTotal).toBe(0.3);
    expect(c.flujoCajaTotal).toBe(0.3);
  });

  it('sin zonas con datos devuelve ceros y la cuenta correcta, sin canales', () => {
    const c = consolidar([sin('a'), err('b')]);
    expect(c.zonasConDatos).toBe(0);
    expect(c.riesgoValorizadoTotal).toBe(0);
    expect(c.margenPorCanal).toEqual([]);
    expect(c.semanas).toEqual([]);
  });

  it('sin resultados no falla', () => {
    expect(consolidar([]).zonasTotales).toBe(0);
  });

  it('lista las semanas distintas ordenadas y sin repetir', () => {
    const c = consolidar([ok('a', panel('a', 1, 1, 1, false, '2026-09-28')), ok('b', panel('b', 1, 1, 1, false, '2026-09-21')), ok('c', panel('c', 1, 1, 1, false, '2026-09-21'))]);
    expect(c.semanas).toEqual(['2026-09-21', '2026-09-28']);
  });

  it('las ventas por canal se toman de la primera zona con datos (son globales, no se multiplican)', () => {
    const c = consolidar([sin('a'), ok('b', panel('b', 1, 1, 1)), ok('c', panel('c', 1, 1, 1))]);
    expect(c.margenPorCanal).toEqual([{ tipoCliente: 'MAYORISTA', totalVentas: 10 }]);
  });
});

describe('clasificarErrorPanel', () => {
  const http = (status: number, mensaje?: string) => new HttpErrorResponse({ status, error: mensaje ? { mensaje } : {} });

  it('solo un 404 cuyo mensaje habla de predicción es «sin proyección»', () => {
    expect(clasificarErrorPanel(http(404, 'Sin prediccion calculada aun para la zona: z1')).estado).toBe('sinProyeccion');
    expect(clasificarErrorPanel(http(404, 'SIN PREDICCION calculada')).estado).toBe('sinProyeccion');
  });

  it('otro 404, un 500 o un error de red son errores reales con mensaje', () => {
    expect(clasificarErrorPanel(http(404, 'Zona no encontrada: z1')).estado).toBe('error');
    expect(clasificarErrorPanel(http(404)).estado).toBe('error');
    expect(clasificarErrorPanel(http(500)).estado).toBe('error');
    expect(clasificarErrorPanel(http(403)).mensaje).toBeTruthy();
    expect(clasificarErrorPanel(new Error('red')).estado).toBe('error');
  });
});
