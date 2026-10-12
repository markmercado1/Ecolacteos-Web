import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { TokenStoreService } from '../../../../core/auth/token-store.service';
import { UsuarioMeResponse } from '../../../../core/auth/auth.models';
import { fechaHoyLima } from '../../../../shared/util/fecha';
import { InformePage } from './informe-page';
import { InformeFormDialog } from '../../ui/informe-form-dialog/informe-form-dialog';
import { InformeDetalleDialog } from '../../ui/informe-detalle-dialog/informe-detalle-dialog';
import { InformeProduccionDiario } from '../../data-access/informe-produccion.models';
import { PaginaResponse } from '../../../../shared/models/pagina-response';

const base = environment.apiBaseUrl;
const hoy = fechaHoyLima();

function usuarioCon(rolNombre: UsuarioMeResponse['rolNombre']): UsuarioMeResponse {
  return { id: 'u-1', nombre: 'Ana', email: 'ana@ecolacteos.pe', rolNombre, activo: true, unidadesResponsable: [] };
}

const informeDeHoy: InformeProduccionDiario = {
  id: 'i1',
  uuidCliente: 'u1',
  fecha: hoy,
  quesosDiarios: 20,
  quesosReparados: 3,
  quesosDeRecorte: 0,
  totalQuesos: 23,
  recorteEnKilos: 0,
  responsableNombre: 'Ana',
  creadoEn: `${hoy}T10:00:00`,
  actualizadoPorNombre: null,
  actualizadoEn: null,
  insumos: []
};

const informePasado: InformeProduccionDiario = { ...informeDeHoy, id: 'i0', fecha: '2026-01-01' };

const historialCon = (contenido: InformeProduccionDiario[]): PaginaResponse<InformeProduccionDiario> => ({
  contenido,
  paginaActual: 0,
  tamanoPagina: 10,
  totalElementos: contenido.length,
  totalPaginas: 1
});

function iniciar() {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  return { http: TestBed.inject(HttpTestingController), tokenStore: TestBed.inject(TokenStoreService) };
}

describe('InformePage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('sin informe hoy (404): el botón "Registrar informe de hoy" queda habilitado', () => {
    const { http, tokenStore } = iniciar();
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(InformePage);
    http.expectOne(`${base}/informes-produccion/fecha/${hoy}`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne((r) => r.url === `${base}/informes-produccion`).flush(historialCon([]));
    f.detectChanges();

    const boton: HTMLButtonElement = f.nativeElement.querySelector('.heading-actions button');
    expect(boton.disabled).toBe(false);
    expect(f.nativeElement.textContent).not.toContain('Ya existe un informe para hoy');
    http.verify();
  });

  it('con informe hoy ya registrado: el botón queda deshabilitado y se avisa que hay que editar', () => {
    const { http, tokenStore } = iniciar();
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(InformePage);
    http.expectOne(`${base}/informes-produccion/fecha/${hoy}`).flush(informeDeHoy);
    http.expectOne((r) => r.url === `${base}/informes-produccion`).flush(historialCon([informeDeHoy]));
    f.detectChanges();

    const boton: HTMLButtonElement = f.nativeElement.querySelector('.heading-actions button');
    expect(boton.disabled).toBe(true);
    expect(f.nativeElement.textContent).toContain('Ya existe un informe para hoy');
    http.verify();
  });

  it('"Registrar informe de hoy" abre InformeFormDialog en modo crear (sin informe en data)', () => {
    const { http, tokenStore } = iniciar();
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(InformePage);
    http.expectOne(`${base}/informes-produccion/fecha/${hoy}`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne((r) => r.url === `${base}/informes-produccion`).flush(historialCon([]));

    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    f.componentInstance['registrarInformeDeHoy']();

    expect(abrirSpy.mock.calls[0][0]).toBe(InformeFormDialog);
    expect((abrirSpy.mock.calls[0][1] as { data: object }).data).toEqual({});
    http.verify();
  });

  it('la fila de hoy en el historial muestra "Editar" y abre InformeFormDialog con ese informe', () => {
    const { http, tokenStore } = iniciar();
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(InformePage);
    http.expectOne(`${base}/informes-produccion/fecha/${hoy}`).flush(informeDeHoy);
    http.expectOne((r) => r.url === `${base}/informes-produccion`).flush(historialCon([informeDeHoy]));
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('Editar');
    expect(f.nativeElement.textContent).not.toContain('Ver detalle');

    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    f.componentInstance['editarInforme'](informeDeHoy);

    expect(abrirSpy.mock.calls[0][0]).toBe(InformeFormDialog);
    expect((abrirSpy.mock.calls[0][1] as { data: { informe: unknown } }).data).toEqual({ informe: informeDeHoy });
    http.verify();
  });

  it('una fila de un día pasado muestra "Ver detalle" (no "Editar") y abre InformeDetalleDialog sin pedir nada a la API', () => {
    const { http, tokenStore } = iniciar();
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(InformePage);
    http.expectOne(`${base}/informes-produccion/fecha/${hoy}`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne((r) => r.url === `${base}/informes-produccion`).flush(historialCon([informePasado]));
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('Ver detalle');

    const dialog = TestBed.inject(Dialog);
    const abrirSpy = vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: () => undefined } } as never);
    f.componentInstance['verDetalle'](informePasado);

    expect(abrirSpy.mock.calls[0][0]).toBe(InformeDetalleDialog);
    expect((abrirSpy.mock.calls[0][1] as { data: { informe: unknown } }).data).toEqual({ informe: informePasado });
    http.verify(); // ninguna petición HTTP adicional: el detalle usa el objeto que ya trajo el historial
  });

  it('al cerrar el diálogo de registrar con un informe nuevo, refresca historial y deshabilita "Registrar"', () => {
    const { http, tokenStore } = iniciar();
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(InformePage);
    http.expectOne(`${base}/informes-produccion/fecha/${hoy}`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne((r) => r.url === `${base}/informes-produccion`).flush(historialCon([]));
    f.detectChanges();

    const dialog = TestBed.inject(Dialog);
    let cerrado!: (valor: InformeProduccionDiario | undefined) => void;
    vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: (fn: typeof cerrado) => (cerrado = fn) } } as never);

    f.componentInstance['registrarInformeDeHoy']();
    cerrado(informeDeHoy);
    f.detectChanges();

    expect(f.componentInstance['informeDeHoy']()).toEqual(informeDeHoy);
    http.expectOne((r) => r.url === `${base}/informes-produccion`).flush(historialCon([informeDeHoy]));

    const boton: HTMLButtonElement = f.nativeElement.querySelector('.heading-actions button');
    expect(boton.disabled).toBe(true);
    http.verify();
  });

  it('cancelar el diálogo (cierra sin resultado) no dispara ninguna recarga', () => {
    const { http, tokenStore } = iniciar();
    tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
    const f = TestBed.createComponent(InformePage);
    http.expectOne(`${base}/informes-produccion/fecha/${hoy}`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne((r) => r.url === `${base}/informes-produccion`).flush(historialCon([]));

    const dialog = TestBed.inject(Dialog);
    let cerrado!: (valor: InformeProduccionDiario | undefined) => void;
    vi.spyOn(dialog, 'open').mockReturnValue({ closed: { subscribe: (fn: typeof cerrado) => (cerrado = fn) } } as never);

    f.componentInstance['registrarInformeDeHoy']();
    cerrado(undefined);

    http.verify(); // sin peticiones extra
  });
});
