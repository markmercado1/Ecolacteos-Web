import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { PaginaResponse } from '../../../../shared/models/pagina-response';
import { EstadoIgvResponse, FilaAfectacionIgvResponse, TasaIgvResponse } from '../../data-access/igv.models';
import { AfectacionIgvDialog } from '../../ui/afectacion-igv-dialog/afectacion-igv-dialog';
import { ClasificarLoteDialog } from '../../ui/clasificar-lote-dialog/clasificar-lote-dialog';
import { CampoUnicoDialog, CampoUnicoDialogData } from '../../../../shared/ui/dialog/campo-unico-dialog';
import { TasaIgvDialog } from '../../ui/tasa-igv-dialog/tasa-igv-dialog';
import { IgvPage } from './igv-page';

const base = `${environment.apiBaseUrl}/admin/tributario`;

const pendiente: EstadoIgvResponse = {
  calculoHabilitado: false, estado: 'PENDIENTE', tasaVigente: null, tasaProgramada: null,
  presentacionesActivas: 3, sinDefinir: 3, gravadas: 0, exoneradas: 0, inafectas: 0,
  avisos: ['El cálculo del IGV está desactivado: las ventas se registran sin desglose.', 'No hay una tasa de IGV registrada.'],
  ultimoCambio: null
};

const filas: PaginaResponse<FilaAfectacionIgvResponse> = {
  contenido: [
    { presentacionId: 'pr-1', presentacionNombre: 'Pieza 1 kg', productoId: 'p-1', productoNombre: 'Queso fresco', familiaNombre: 'Quesos',
      afectacionVigente: 'SIN_DEFINIR', vigenteDesde: null, afectacionProgramada: null, programadaDesde: null },
    { presentacionId: 'pr-2', presentacionNombre: 'Botella 1 L', productoId: 'p-2', productoNombre: 'Yogurt', familiaNombre: 'Yogures',
      afectacionVigente: 'GRAVADO', vigenteDesde: '2026-10-01', afectacionProgramada: 'EXONERADO', programadaDesde: '2027-01-01' }
  ],
  paginaActual: 0, tamanoPagina: 20, totalElementos: 2, totalPaginas: 1
};

function crear(estado: EstadoIgvResponse = pendiente, tasas: TasaIgvResponse[] = []) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(IgvPage);
  http.expectOne(`${base}/estado`).flush(estado);
  http.expectOne(`${base}/tasas-igv`).flush(tasas);
  http.expectOne((r) => r.url === `${base}/afectaciones`).flush(filas);
  f.detectChanges();
  return { f, http };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const texto = (f: ComponentFixture<unknown>) => (el(f).textContent ?? '').replace(/\s+/g, ' ');

describe('IgvPage (Fase G)', () => {
  it('con el cálculo apagado lo dice claramente: ventas sin desglose y ofrece activarlo', () => {
    const { f, http } = crear();
    const estado = el(f).querySelector('[data-testid="estado-igv"]') as HTMLElement;
    expect(estado.textContent).toContain('Pendiente');
    expect(estado.textContent).toContain('las ventas se registran como hasta ahora, sin desglose');
    expect(estado.textContent).not.toContain('contador');
    expect(el(f).querySelector('[data-testid="activar-calculo"]')).not.toBeNull();
    expect(el(f).querySelector('[data-testid="desactivar-calculo"]')).toBeNull();
    // el aviso de «pendiente» del servidor no se repite: ya lo explica el recuadro
    const avisos = Array.from(el(f).querySelectorAll('[data-testid="aviso-igv"]')).map((a) => a.textContent);
    expect(avisos).toEqual(['No hay una tasa de IGV registrada.']);
    expect(el(f).querySelector('[data-testid="tasa-vigente"]')?.textContent).toContain('sin registrar');
    expect(el(f).querySelector('[data-testid="conteo-afectacion"]')?.textContent).toContain('3 / 3');
    expect(texto(f)).toContain('No hay tasas de IGV registradas');
    expect(texto(f)).toContain('precios son finales');
    http.verify();
  });

  it('muestra la afectación vigente de cada presentación (sin definir por defecto) y la programada', () => {
    const { f, http } = crear();
    const vigentes = Array.from(el(f).querySelectorAll('[data-testid="afectacion-vigente"]')).map((e) => e.textContent?.trim());
    expect(vigentes).toEqual(['Sin definir', 'Gravado']);
    expect(texto(f)).toContain('Exonerado desde 01/01/2027');
    http.verify();
  });

  it('activo: muestra la tasa vigente y no el aviso de pendiente', () => {
    const tasa: TasaIgvResponse = { id: 't-1', tasa: 18, vigenteDesde: '2026-01-01', motivo: 'Confirmada por el contador', usuarioNombre: 'Admin', creadoEn: '2026-01-01T10:00:00' };
    const { f, http } = crear({ ...pendiente, calculoHabilitado: true, estado: 'ACTIVO', tasaVigente: tasa, avisos: [] }, [tasa]);
    expect(el(f).querySelector('[data-testid="estado-igv"]')?.textContent).toContain('Cálculo del IGV activo');
    expect(texto(f)).not.toContain('Configuración pendiente');
    expect(el(f).querySelector('[data-testid="desactivar-calculo"]')).not.toBeNull();
    expect(el(f).querySelector('[data-testid="activar-calculo"]')).toBeNull();
    expect(el(f).querySelector('[data-testid="texto-activo"]')?.textContent).toContain('Las ventas ya registradas no se modifican');
    expect(el(f).querySelector('[data-testid="tasa-vigente"]')?.textContent).toContain('18 %');
    expect(el(f).querySelectorAll('[data-testid="tasa"]').length).toBe(1);
    http.verify();
  });

  it('registrar una tasa abre su diálogo y al cerrarlo con una tasa recarga estado y tasas', () => {
    const { f, http } = crear();
    const dialog = TestBed.inject(Dialog);
    const tasa: TasaIgvResponse = { id: 't-1', tasa: 18, vigenteDesde: '2026-01-01', motivo: 'x', usuarioNombre: null, creadoEn: '' };
    const abrir = vi.spyOn(dialog, 'open').mockReturnValue({ closed: of(tasa) } as never);
    (f.componentInstance as unknown as Record<string, () => void>)['registrarTasa']();
    expect(abrir.mock.calls[0][0]).toBe(TasaIgvDialog);
    http.expectOne(`${base}/estado`).flush(pendiente);
    http.expectOne(`${base}/tasas-igv`).flush([tasa]);
    http.verify();
  });

  it('«Historial y cambio» abre el diálogo de la presentación de esa fila y recarga si hubo cambios', () => {
    const { f, http } = crear();
    const dialog = TestBed.inject(Dialog);
    const abrir = vi.spyOn(dialog, 'open').mockReturnValue({ closed: of(true) } as never);
    const botones = Array.from(el(f).querySelectorAll('button')).filter((b) => b.textContent?.includes('Historial y cambio')) as HTMLButtonElement[];
    botones[1].click();
    expect(abrir.mock.calls[0][0]).toBe(AfectacionIgvDialog);
    expect((abrir.mock.calls[0][1] as { data: { fila: FilaAfectacionIgvResponse } }).data.fila.presentacionId).toBe('pr-2');
    http.expectOne(`${base}/estado`).flush(pendiente);
    http.expectOne((r) => r.url === `${base}/afectaciones`).flush(filas);
    http.verify();
  });

  it('activar abre el motivo, llama al servidor con habilitado=true y recarga el estado', () => {
    const { f, http } = crear();
    const dialog = TestBed.inject(Dialog);
    const abrir = vi.spyOn(dialog, 'open').mockReturnValue({ closed: of({ ...pendiente, estado: 'ACTIVO' }) } as never);
    (f.componentInstance as unknown as Record<string, (b: boolean) => void>)['cambiarCalculo'](true);
    expect(abrir.mock.calls[0][0]).toBe(CampoUnicoDialog);
    const datos = (abrir.mock.calls[0][1] as { data: CampoUnicoDialogData }).data;
    expect(datos.titulo).toContain('Activar');
    expect(datos.ayuda).toContain('No se recalculan ventas ya registradas');
    expect(datos.ayuda).toContain('no hay una tasa vigente');   // avisa lo que falta, no lo impide
    datos.guardar('  Decisión del administrador  ').subscribe();
    const req = http.expectOne(`${base}/calculo`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ habilitado: true, motivo: 'Decisión del administrador' });
    req.flush({ ...pendiente, estado: 'ACTIVO' });
    http.expectOne(`${base}/estado`).flush(pendiente);
    http.verify();
  });

  it('desactivar pide el motivo y envía habilitado=false', () => {
    const { f, http } = crear({ ...pendiente, calculoHabilitado: true, estado: 'ACTIVO', avisos: [] });
    const dialog = TestBed.inject(Dialog);
    const abrir = vi.spyOn(dialog, 'open').mockReturnValue({ closed: of(undefined) } as never);
    (f.componentInstance as unknown as Record<string, (b: boolean) => void>)['cambiarCalculo'](false);
    const datos = (abrir.mock.calls[0][1] as { data: CampoUnicoDialogData }).data;
    expect(datos.titulo).toContain('Desactivar');
    datos.guardar('Pausa').subscribe();
    const req = http.expectOne(`${base}/calculo`);
    expect(req.request.body).toEqual({ habilitado: false, motivo: 'Pausa' });
    req.flush(pendiente);
    http.verify();   // cerrado sin resultado: no recarga nada
  });

  it('muestra quién, cuándo y por qué se cambió el interruptor la última vez', () => {
    const { f, http } = crear({
      ...pendiente, calculoHabilitado: true, estado: 'ACTIVO', avisos: [],
      ultimoCambio: { habilitado: true, motivo: 'Empezamos a facturar', usuarioNombre: 'Admin Planta', creadoEn: '2026-10-26T09:30:00' }
    });
    const t = el(f).querySelector('[data-testid="ultimo-cambio"]')?.textContent ?? '';
    expect(t).toContain('activado por Admin Planta');
    expect(t).toContain('26/10/2026 09:30');
    expect(t).toContain('Empezamos a facturar');
    http.verify();
  });

  it('«Clasificar las N que faltan» solo aparece si hay presentaciones sin afectación y recarga estado y filas al terminar', () => {
    const { f, http } = crear();
    const dialog = TestBed.inject(Dialog);
    const abrir = vi.spyOn(dialog, 'open').mockReturnValue({ closed: of({ aplicadas: 3, omitidas: 0 }) } as never);
    const boton = el(f).querySelector('[data-testid="clasificar-lote"]') as HTMLButtonElement;
    expect(boton.textContent).toContain('Clasificar las 3 que faltan');
    boton.click();
    expect(abrir.mock.calls[0][0]).toBe(ClasificarLoteDialog);
    expect((abrir.mock.calls[0][1] as { data: { sinDefinir: number } }).data.sinDefinir).toBe(3);
    http.expectOne(`${base}/estado`).flush({ ...pendiente, sinDefinir: 0, gravadas: 3 });
    http.expectOne((r) => r.url === `${base}/afectaciones`).flush(filas);
    f.detectChanges();
    expect(el(f).querySelector('[data-testid="clasificar-lote"]')).toBeNull();
    http.verify();
  });
});
