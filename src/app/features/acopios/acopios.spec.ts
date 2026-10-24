import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../environments/environment';
import { AcopiosPage } from './acopios-page';
import { AcopiosApi, Acopio, AcopioPorJornada, CorreccionRegistro, JornadaDetalle, RegistroAcopioResumen, TotalAcopioProveedor } from './acopios.api';
import { PaginaResponse } from '../../shared/models/pagina-response';
import { AcopioDetalle } from './acopio-detalle';
import { HistorialProveedorDialog } from './historial-proveedor-dialog';
const base = environment.apiBaseUrl;
const registro: Acopio = {
  id: 'r1',
  uuidCliente: 'movil1',
  proveedorId: 'p1',
  proveedorNombre: 'Productor',
  unidadId: 'u1',
  fechaHora: '2026-09-16T11:30:00',
  litros: 12.5,
  gpsLat: 0,
  gpsLng: 0,
  motivoObservacion: null,
  litrosPorVoz: false,
  sincronizadoEn: null,
  fotoUrl: null,
  disponibleParaLote: true,
  jornadaId: null,
};
function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return TestBed.inject(HttpTestingController);
}
function pagina<T>(contenido: T[], paginaActual = 0, totalElementos = contenido.length, tamanoPagina = 20): PaginaResponse<T> {
  return { contenido, paginaActual, tamanoPagina, totalElementos, totalPaginas: Math.ceil(totalElementos / tamanoPagina) };
}
const filaJornada: AcopioPorJornada = {
  clave: 'j1',
  esJornada: true,
  acopiadorNombre: 'Cristian',
  placa: 'M1A-700',
  fecha: '2026-09-16T08:00:00',
  cantidad: 2,
  totalLitros: 20,
  primerAcopioId: 'temprano',
};
const filaSuelta: AcopioPorJornada = {
  clave: 'r3',
  esJornada: false,
  acopiadorNombre: null,
  placa: 'M1A-700',
  fecha: '2026-09-16T07:00:00',
  cantidad: 1,
  totalLitros: 5,
  primerAcopioId: 'r3',
};
const esJornadas = (r: { url: string }) => r.url === `${base}/registros-acopio/por-jornada`;
const esEntregas = (r: { url: string }) => r.url === `${base}/registros-acopio/paginado`;
const esResumen = (r: { url: string }) => r.url === `${base}/registros-acopio/resumen-por-proveedor`;
/** Crea la página y resuelve las 4 peticiones iniciales (unidades, zonas, primera página por jornada, resumen). */
function crearPagina(
  http: HttpTestingController,
  jornadas: PaginaResponse<AcopioPorJornada> = pagina([filaJornada, filaSuelta]),
  resumen: TotalAcopioProveedor[] = [],
) {
  const f = TestBed.createComponent(AcopiosPage);
  http.expectOne(`${base}/admin/unidades`).flush([]);
  http.expectOne(`${base}/admin/zonas`).flush([{ id: 'z1', nombre: 'Zona 1', activa: true }]);
  http.expectOne(esJornadas).flush(jornadas);
  http.expectOne(esResumen).flush(resumen);
  f.detectChanges();
  return { f, c: f.componentInstance };
}
describe('Acopios', () => {
  it('pide la primera página de jornadas y el resumen global con la fecha de hoy, sin pedir GET /registros-acopio completo', () => {
    const http = setup();
    const f = TestBed.createComponent(AcopiosPage);
    http.expectOne(`${base}/admin/unidades`).flush([]);
    http.expectOne(`${base}/admin/zonas`).flush([]);
    const req = http.expectOne(esJornadas);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.get('fecha')).toBe(f.componentInstance['fecha']());
    expect(req.request.params.has('busqueda')).toBe(false);
    req.flush(pagina([filaJornada]));
    const resumen = http.expectOne(esResumen);
    expect(resumen.request.params.get('fecha')).toBe(f.componentInstance['fecha']());
    expect(resumen.request.params.has('page')).toBe(false);
    resumen.flush([]);
    http.expectNone((r) => r.url === `${base}/registros-acopio`);
    http.verify();
  });
  it('consulta el día seleccionado, cancela la consulta anterior y vuelve a la página 0', () => {
    const http = setup();
    const { f, c } = crearPagina(http, pagina([filaJornada], 0, 45));
    c['cambiarPagina'](1);
    const anterior = http.expectOne(esJornadas);
    expect(anterior.request.params.get('page')).toBe('1');
    c['cambiarFecha']('2026-09-15');
    expect(anterior.cancelled).toBe(true);
    const req = http.expectOne(esJornadas);
    expect(req.request.params.get('fecha')).toBe('2026-09-15');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(pagina([filaJornada]));
    http.expectOne((r) => esResumen(r) && r.params.get('fecha') === '2026-09-15').flush([]);
    f.detectChanges();
    expect(c['pagina']()).toBe(0);
    http.verify();
  });
  it('la vista "Por entrega" pagina en el servidor y muestra los datos de la página', () => {
    const http = setup();
    const { f, c } = crearPagina(http);
    c['cambiarVista']('entrega');
    const req = http.expectOne(esEntregas);
    expect(req.request.params.get('page')).toBe('0');
    req.flush(pagina([registro], 0, 41));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Productor');
    expect(f.nativeElement.textContent).toContain('Sin foto');
    expect(f.nativeElement.textContent).toContain('Mostrando 1–20 de 41 entregas');

    c['cambiarPagina'](1);
    const siguiente = http.expectOne(esEntregas);
    expect(siguiente.request.params.get('page')).toBe('1');
    siguiente.flush(pagina([{ ...registro, id: 'r21' }], 1, 41));
    expect(c['filasEntrega']()[0].id).toBe('r21');
    // El resumen del gráfico no se vuelve a pedir al cambiar de página.
    http.expectNone(esResumen);
    http.verify();
  });
  it('cambiar de vista reinicia la página', () => {
    const http = setup();
    const { c } = crearPagina(http, pagina([filaJornada], 0, 45));
    c['cambiarPagina'](2);
    http.expectOne(esJornadas).flush(pagina([filaJornada], 2, 45));
    c['cambiarVista']('entrega');
    expect(http.expectOne(esEntregas).request.params.get('page')).toBe('0');
    http.verify();
  });
  it('no pide páginas fuera de rango y corrige una página que quedó vacía', () => {
    const http = setup();
    const { c } = crearPagina(http, pagina([filaJornada], 0, 25));
    c['cambiarPagina'](-1);
    http.expectNone(esJornadas);
    c['cambiarPagina'](1);
    // El total bajó entre consultas: la página 1 ya no existe y se vuelve a pedir la última válida.
    http.expectOne(esJornadas).flush({ contenido: [], paginaActual: 1, tamanoPagina: 20, totalElementos: 20, totalPaginas: 1 });
    const reintento = http.expectOne(esJornadas);
    expect(reintento.request.params.get('page')).toBe('0');
    reintento.flush(pagina([filaJornada], 0, 20));
    expect(c['pagina']()).toBe(0);
    http.verify();
  });
  it('el gráfico usa los totales globales del servidor, no la página visible ni la búsqueda', () => {
    {
      const http = setup();
      const { c } = crearPagina(http, pagina([filaSuelta], 0, 60), [
        { proveedorId: 'p2', proveedorNombre: 'Otro Productor', totalLitros: 30, cantidad: 2 },
        { proveedorId: 'p1', proveedorNombre: 'Productor', totalLitros: 20, cantidad: 2 },
      ]);
      expect(c['datosPorProveedor']()).toEqual([
        { etiqueta: 'Otro Productor', valor: 30 },
        { etiqueta: 'Productor', valor: 20 },
      ]);

      c['buscar']('Otro');
      const req = http.expectOne(esJornadas);
      expect(req.request.params.get('busqueda')).toBe('Otro');
      req.flush(pagina([], 0, 0));
      http.expectNone(esResumen);
      expect(c['datosPorProveedor']().length).toBe(2);
      http.verify();
    }
  });
  // El debounce vive en ui-buscador (buscador.spec.ts); aquí se prueba qué hace la página con el texto.
  it('la búsqueda se envía al servidor, cancela la consulta anterior y reinicia la página', () => {
    const http = setup();
    const { c } = crearPagina(http, pagina([filaJornada], 0, 45));
    c['cambiarPagina'](1);
    http.expectOne(esJornadas).flush(pagina([filaJornada], 1, 45));
    c['buscar']('M1');
    const anterior = http.expectOne(esJornadas);
    c['buscar']('M1A');
    expect(anterior.cancelled).toBe(true);
    const req = http.expectOne(esJornadas);
    expect(req.request.params.get('busqueda')).toBe('M1A');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(pagina([filaJornada]));
    http.verify();
  });
  it('cambiarTamano pide la primera página con el nuevo tamaño y conserva la búsqueda', () => {
    const http = setup();
    const { c } = crearPagina(http, pagina([filaJornada], 0, 45));
    c['buscar']('M1');
    http.expectOne(esJornadas).flush(pagina([filaJornada], 0, 45));
    c['cambiarTamano'](50);
    const req = http.expectOne(esJornadas);
    expect(req.request.params.get('size')).toBe('50');
    expect(req.request.params.get('busqueda')).toBe('M1');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(pagina([filaJornada], 0, 45));
    http.verify();
  });
  it('conserva el error 403 en vez de presentarlo como lista vacía', () => {
    const http = setup();
    const f = TestBed.createComponent(AcopiosPage);
    http.expectOne(`${base}/admin/unidades`).flush([]);
    http.expectOne(`${base}/admin/zonas`).flush([]);
    http.expectOne(esJornadas).flush({}, { status: 403, statusText: 'Forbidden' });
    http.expectOne(esResumen).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(f.componentInstance['error']()?.status).toBe(403);
    expect(f.componentInstance['errorResumen']()).toBe(true);
    http.verify();
  });
  it('filtra por zona y por sinAnalisis reiniciando la consulta de la tabla y del resumen', () => {
    const http = setup();
    const { c } = crearPagina(http);
    c['cambiarFiltroZona']('z1');
    http.expectOne((r) => esJornadas(r) && r.params.get('zonaId') === 'z1').flush(pagina([]));
    http.expectOne((r) => esResumen(r) && r.params.get('zonaId') === 'z1').flush([]);
    c['cambiarSoloSinAnalisis'](true);
    http
      .expectOne((r) => esJornadas(r) && r.params.get('zonaId') === 'z1' && r.params.get('sinAnalisis') === 'true')
      .flush(pagina([]));
    http
      .expectOne((r) => esResumen(r) && r.params.get('zonaId') === 'z1' && r.params.get('sinAnalisis') === 'true')
      .flush([]);
    http.verify();
  });
  it('al filtrar por zona avisa que es la zona de cada entrega (no la actual) y que las entregas sin zona no aparecen; sin filtro no avisa', () => {
    const http = setup();
    const { f, c } = crearPagina(http);
    expect((f.nativeElement as HTMLElement).querySelector('[data-testid="aviso-zona-entrega"]')).toBeNull();
    c['zonas'].set([{ id: 'z1', nombre: 'Zona Norte', activa: true }]);
    c['cambiarFiltroZona']('z1');
    http.expectOne((r) => esJornadas(r) && r.params.get('zonaId') === 'z1').flush(pagina([]));
    http.expectOne((r) => esResumen(r) && r.params.get('zonaId') === 'z1').flush([]);
    f.detectChanges();
    const aviso = (f.nativeElement as HTMLElement).querySelector('[data-testid="aviso-zona-entrega"]');
    expect(aviso?.textContent).toContain('Zona Norte');
    expect(aviso?.textContent).toContain('no la actual');
    expect(aviso?.textContent).toContain('sin zona determinada');
    c['cambiarFiltroZona']('');
    http.expectOne(esJornadas).flush(pagina([]));
    http.expectOne(esResumen).flush([]);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('[data-testid="aviso-zona-entrega"]')).toBeNull();
    http.verify();
  });
  it('muestra las jornadas agrupadas por el servidor (sin pedir GET /jornadas/{id} por fila)', () => {
    const http = setup();
    const { f, c } = crearPagina(http);
    const filas = c['filasJornada']();
    expect(filas).toHaveLength(2);
    expect(filas[0].acopiadorNombre).toBe('Cristian');
    expect(filas[0].cantidad).toBe(2);
    expect(filas[0].totalLitros).toBe(20);
    expect(filas[1].esJornada).toBe(false);
    expect(f.nativeElement.textContent).toContain('Cristian');
    expect(f.nativeElement.textContent).toContain('Mostrando 1–2 de 2 jornadas');
    http.expectNone((r) => r.url.startsWith(`${base}/jornadas/`));
    http.verify();
  });
  it('"Ver jornada" abre AcopioDetalle con el primer acopio cronológico que resolvió el servidor', () => {
    const http = setup();
    const { c } = crearPagina(http);
    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    c['verJornada'](c['filasJornada']()[0]);

    const config = abrirSpy.mock.calls[0][1] as {
      data: { id: string; placa: string; jornada: { cantidad: number; totalLitros: number } };
    };
    expect(abrirSpy.mock.calls[0][0]).toBe(AcopioDetalle);
    expect(config.data.id).toBe('temprano');
    expect(config.data.placa).toBe('M1A-700');
    expect(config.data.jornada).toEqual({ acopiadorNombre: 'Cristian', fecha: filaJornada.fecha, cantidad: 2, totalLitros: 20 });
    http.verify();
  });
  it('descarga fotos del endpoint propio como blob y rechaza dominios externos', () => {
    const http = setup();
    const api = TestBed.inject(AcopiosApi);
    api.foto('/api/archivos/foto.jpg').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/archivos/foto.jpg'));
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['foto'], { type: 'image/jpeg' }));
    const error = vi.fn();
    api.foto('https://externo.example/foto.jpg').subscribe({ error });
    expect(error).toHaveBeenCalled();
    http.verify();
  });
  it('muestra ausencia de foto y observación, y acepta coordenadas cero válidas', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: { id: 'r1', placa: 'ABC-123' } },
        { provide: DialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(AcopioDetalle);
    http.expectOne(`${base}/registros-acopio/r1`).flush(registro);
    http.expectOne(`${base}/registros-acopio/r1/correcciones`).flush([]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No se adjuntó fotografía');
    expect(f.nativeElement.textContent).toContain('Sin observación');
    expect(f.nativeElement.querySelector('a').href).toContain('q=0,0');
    expect(f.nativeElement.textContent).toContain('Sin correcciones registradas');
    http.verify();
  });
  it('muestra las correcciones distinguiendo litros antes/después del original', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: { id: 'r1', placa: 'ABC-123' } },
        { provide: DialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(AcopioDetalle);
    const correccion: CorreccionRegistro = {
      id: 'c1',
      registroAcopioId: 'r1',
      litrosAnterior: 12.5,
      litrosCorregido: 11.8,
      motivo: 'Ajuste por medición',
      usuarioNombre: 'Calidad Uno',
      creadoEn: '2026-09-16T12:00:00',
    };
    http.expectOne(`${base}/registros-acopio/r1`).flush(registro);
    http.expectOne(`${base}/registros-acopio/r1/correcciones`).flush([correccion]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('12.5');
    expect(f.nativeElement.textContent).toContain('11.8');
    expect(f.nativeElement.textContent).toContain('Ajuste por medición');
    expect(f.nativeElement.textContent).toContain('Calidad Uno');
    http.verify();
  });
  it('abre el historial del proveedor con GET /registros-acopio/proveedor/{id}/paginado', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: { proveedorId: 'p1', proveedorNombre: 'Productor' } },
        { provide: DialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const resumen: RegistroAcopioResumen = {
      id: 'r1',
      fechaHora: '2026-09-16T11:30:00',
      litros: 12.5,
      tieneObservacion: false,
      disponibleParaLote: true,
    };
    const f = TestBed.createComponent(HistorialProveedorDialog);
    http.expectOne((r) => r.url === `${base}/registros-acopio/proveedor/p1/paginado`).flush(pagina([resumen], 0, 1, 10));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Productor');
    expect(f.nativeElement.textContent).toContain('12.5');
    http.verify();
  });
  it('el historial del proveedor pagina en el servidor y no pide páginas fuera de rango', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: { proveedorId: 'p1', proveedorNombre: 'Productor' } },
        { provide: DialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const resumen: RegistroAcopioResumen = {
      id: 'r1',
      fechaHora: '2026-09-16T11:30:00',
      litros: 12.5,
      tieneObservacion: false,
      disponibleParaLote: true,
    };
    const f = TestBed.createComponent(HistorialProveedorDialog);
    const primera = http.expectOne((r) => r.url === `${base}/registros-acopio/proveedor/p1/paginado`);
    expect(primera.request.params.get('page')).toBe('0');
    expect(primera.request.params.get('size')).toBe('10');
    primera.flush(pagina([resumen], 0, 25, 10));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Mostrando 1–10 de 25 entregas');

    f.componentInstance['irAPagina'](2);
    const ultima = http.expectOne((r) => r.url === `${base}/registros-acopio/proveedor/p1/paginado`);
    expect(ultima.request.params.get('page')).toBe('2');
    ultima.flush(pagina([{ ...resumen, id: 'r21' }], 2, 25, 10));
    f.componentInstance['irAPagina'](3);
    http.expectNone((r) => r.url === `${base}/registros-acopio/proveedor/p1/paginado`);
    http.verify();
  });
  it('el historial del proveedor consulta el análisis de una entrega solo al expandirla, y lo colapsa sin volver a pedirlo', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: { proveedorId: 'p1', proveedorNombre: 'Productor' } },
        { provide: DialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const resumen: RegistroAcopioResumen = {
      id: 'r1',
      fechaHora: '2026-09-16T11:30:00',
      litros: 12.5,
      tieneObservacion: false,
      disponibleParaLote: true,
    };
    const f = TestBed.createComponent(HistorialProveedorDialog);
    http.expectOne((r) => r.url === `${base}/registros-acopio/proveedor/p1/paginado`).flush(pagina([resumen], 0, 1, 10));
    f.detectChanges();
    // Sin expandir ninguna fila, nunca se llama a /analisis-calidad/registro/*.
    http.expectNone((r) => r.url === `${base}/analisis-calidad/registro/r1`);

    f.componentInstance['alternarAnalisis']('r1');
    http
      .expectOne(`${base}/analisis-calidad/registro/r1`)
      .flush([
        { id: 'a1', registroAcopioId: 'r1', folioMuestra: 'F-1', agua: 2, proteina: 3, lactosa: 4, densidad: 1.03, temperatura: 4, ph: 6.7, aguaAnadida: false, resultado: 'APROBADO', creadoEn: '2026-09-16T12:00:00' },
      ]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('F-1');
    expect(f.nativeElement.textContent).toContain('APROBADO');

    // Colapsar y volver a expandir no repite la petición (ya está en caché por fila).
    f.componentInstance['alternarAnalisis']('r1');
    f.componentInstance['alternarAnalisis']('r1');
    http.expectNone((r) => r.url === `${base}/analisis-calidad/registro/r1`);
    http.verify();
  });
  it('un error al consultar el análisis de una entrega no oculta el resto del historial', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: { proveedorId: 'p1', proveedorNombre: 'Productor' } },
        { provide: DialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const resumen: RegistroAcopioResumen = {
      id: 'r1',
      fechaHora: '2026-09-16T11:30:00',
      litros: 12.5,
      tieneObservacion: false,
      disponibleParaLote: true,
    };
    const f = TestBed.createComponent(HistorialProveedorDialog);
    http.expectOne((r) => r.url === `${base}/registros-acopio/proveedor/p1/paginado`).flush(pagina([resumen], 0, 1, 10));
    f.detectChanges();
    f.componentInstance['alternarAnalisis']('r1');
    http.expectOne(`${base}/analisis-calidad/registro/r1`).flush({}, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Productor');
    expect(f.nativeElement.textContent).toContain('12.5');
    expect(f.componentInstance['estadoAnalisis']('r1').error?.status).toBe(403);
    http.verify();
  });
  it('muestra el recorrido de la jornada en orden cronológico y la foto por acopio', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: { id: 'r1', placa: 'ABC-123' } },
        { provide: DialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(AcopioDetalle);

    const r1: Acopio = {
      ...registro,
      id: 'r1',
      proveedorNombre: 'Productor',
      fechaHora: '2026-09-16T09:00:00',
      gpsLat: -6.78,
      gpsLng: -78.52,
      fotoUrl: '/api/archivos/r1.jpg',
      jornadaId: 'j1',
    };
    const r2: Acopio = {
      ...registro,
      id: 'r2',
      proveedorNombre: 'Otro proveedor',
      fechaHora: '2026-09-16T08:00:00',
      gpsLat: -6.79,
      gpsLng: -78.53,
      fotoUrl: null,
      jornadaId: 'j1',
    };
    const jornada: JornadaDetalle = {
      id: 'j1',
      uuidCliente: 'jornada1',
      estado: 'REGRESANDO_A_PLANTA',
      unidadId: 'u1',
      unidadPlaca: 'ABC-123',
      acopiadorId: 'ac1',
      acopiadorNombre: 'Acopiador',
      horaInicio: '2026-09-16T07:30:00',
      horaFin: null,
      litrosEsperados: 17.5,
      proveedoresVisitados: ['Otro proveedor', 'Productor'],
      // Orden cronológico real, tal como lo entrega el backend (findByJornadaIdOrderByFechaHoraAsc).
      acopios: [
        { registroAcopioId: 'r2', proveedorId: 'p2', proveedorNombre: 'Otro proveedor', fechaHora: r2.fechaHora, litros: 5 },
        { registroAcopioId: 'r1', proveedorId: 'p1', proveedorNombre: 'Productor', fechaHora: r1.fechaHora, litros: 12.5 },
      ],
    };

    http.expectOne(`${base}/registros-acopio/r1`).flush(r1);
    http.expectOne(`${base}/registros-acopio/r1/correcciones`).flush([]);
    http.expectOne(`${base}/jornadas/j1`).flush(jornada);
    // forkJoin respeta el orden de jornada.acopios: r2 primero, r1 segundo.
    http.expectOne(`${base}/registros-acopio/r2`).flush(r2);
    http.expectOne(`${base}/registros-acopio/r1`).flush(r1);
    http.expectOne((req) => req.url.endsWith('/api/archivos/r1.jpg')).flush(new Blob(['x'], { type: 'image/jpeg' }));
    f.detectChanges();
    // Segundo ciclo: el efecto que dibuja el mapa Leaflet corre una vez que el contenedor (#mapaEl) ya
    // quedó en el DOM tras el primer detectChanges().
    f.detectChanges();

    const filas = f.nativeElement.querySelectorAll('.tabla-orden tbody tr');
    expect(filas.length).toBe(2);
    expect(filas[0].textContent).toContain('Otro proveedor');
    expect(filas[1].textContent).toContain('Productor');
    expect(f.nativeElement.querySelector('.mapa-recorrido')).toBeTruthy();
    expect(f.nativeElement.querySelectorAll('.marcador-acopio').length).toBe(2);

    const fotos = f.nativeElement.querySelectorAll('.foto-item');
    expect(fotos.length).toBe(2);
    expect(fotos[0].textContent).toContain('Sin foto');
    expect(fotos[1].querySelector('img')).toBeTruthy();
    http.verify();
  });

describe('AcopiosApi (variantes paginadas)', () => {
  it('listarPaginado/porJornada envían filtros, búsqueda y página; listar() completo no lleva page', () => {
    const http = setup();
    const api = TestBed.inject(AcopiosApi);
    const filtro = { fecha: '2026-09-16', zonaId: 'z1', sinAnalisis: true, busqueda: ' M1A ', page: 2, size: 20 };

    api.listarPaginado(filtro).subscribe();
    const entregas = http.expectOne((r) => r.url === `${base}/registros-acopio/paginado`);
    expect(entregas.request.params.get('fecha')).toBe('2026-09-16');
    expect(entregas.request.params.get('zonaId')).toBe('z1');
    expect(entregas.request.params.get('sinAnalisis')).toBe('true');
    expect(entregas.request.params.get('busqueda')).toBe('M1A');
    expect(entregas.request.params.get('page')).toBe('2');
    entregas.flush({ contenido: [], paginaActual: 2, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });

    api.porJornada({ fecha: '2026-09-16', page: 0, size: 20 }).subscribe();
    const jornadas = http.expectOne((r) => r.url === `${base}/registros-acopio/por-jornada`);
    expect(jornadas.request.params.keys().sort()).toEqual(['fecha', 'page', 'size']);
    jornadas.flush({ contenido: [], paginaActual: 0, tamanoPagina: 20, totalElementos: 0, totalPaginas: 0 });

    api.resumenPorProveedor({ fecha: '2026-09-16', zonaId: 'z1' }).subscribe();
    const resumen = http.expectOne((r) => r.url === `${base}/registros-acopio/resumen-por-proveedor`);
    expect(resumen.request.params.keys().sort()).toEqual(['fecha', 'zonaId']);
    resumen.flush([]);

    // La bandeja de Calidad (y la app móvil) siguen usando la lista completa, sin page/size.
    api.listar({ fecha: '2026-09-16', sinAnalisis: true }).subscribe();
    const completa = http.expectOne((r) => r.url === `${base}/registros-acopio`);
    expect(completa.request.params.has('page')).toBe(false);
    completa.flush([]);

    api.porProveedor('p1', { page: 1, size: 10 }).subscribe();
    const historial = http.expectOne((r) => r.url === `${base}/registros-acopio/proveedor/p1/paginado`);
    expect(historial.request.params.get('page')).toBe('1');
    historial.flush({ contenido: [], paginaActual: 1, tamanoPagina: 10, totalElementos: 0, totalPaginas: 0 });
    http.verify();
  });
});
});
