import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { TokenStoreService } from '../../../../core/auth/token-store.service';
import { UsuarioMeResponse } from '../../../../core/auth/auth.models';
import { fechaHoyLima } from '../../../../shared/util/fecha';
import { InformeFormDialog, InformeFormDialogData } from './informe-form-dialog';
import { InformeProduccionDiario } from '../../data-access/informe-produccion.models';

const base = environment.apiBaseUrl;
const hoy = fechaHoyLima();

function usuarioCon(rolNombre: UsuarioMeResponse['rolNombre']): UsuarioMeResponse {
  return { id: 'u-1', nombre: 'Ana', email: 'ana@ecolacteos.pe', rolNombre, activo: true, unidadesResponsable: [] };
}

const informeExistente: InformeProduccionDiario = {
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
  insumos: [{ insumoId: 'ins1', insumoNombre: 'Cuajo', unidadMedida: 'unidades', cantidad: 1 }]
};

function iniciar(data: InformeFormDialogData) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const tokenStore = TestBed.inject(TokenStoreService);
  tokenStore.establecer({ token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon('ADMIN') });
  return { http };
}

describe('InformeFormDialog', () => {
  afterEach(() => localStorage.clear());

  it('modo crear: sin informe en data, el formulario arranca vacío y hace POST con fecha de hoy', () => {
    const { http } = iniciar({});
    const f = TestBed.createComponent(InformeFormDialog);
    http.expectOne(`${base}/admin/insumos`).flush([]);
    f.detectChanges();

    expect(f.componentInstance['esEdicion']).toBe(false);
    expect(f.componentInstance['form'].getRawValue().quesosDiarios).toBeNull();

    f.componentInstance['form'].setValue({ quesosDiarios: 100, quesosReparados: 1, quesosDeRecorte: 2, recorteEnKilos: null });
    f.componentInstance['guardar']();

    const req = http.expectOne(`${base}/informes-produccion`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.fecha).toBe(hoy);
    expect(req.request.body.quesosDiarios).toBe(100);
    expect(typeof req.request.body.uuidCliente).toBe('string');
    req.flush(informeExistente);

    const dialogRef = TestBed.inject(DialogRef);
    expect(dialogRef.close).toHaveBeenCalledWith(informeExistente);
    http.verify();
  });

  it('modo editar: precarga el informe recibido y hace PUT al id, sin fecha/uuidCliente en el payload', () => {
    const { http } = iniciar({ informe: informeExistente });
    const f = TestBed.createComponent(InformeFormDialog);
    http.expectOne(`${base}/admin/insumos`).flush([{ id: 'ins1', nombre: 'Cuajo', unidadMedida: 'unidades', activo: true }]);
    f.detectChanges();

    expect(f.componentInstance['esEdicion']).toBe(true);
    expect(f.componentInstance['form'].getRawValue().quesosDiarios).toBe(20);
    expect(f.componentInstance['filasInsumos']()).toEqual([{ insumoId: 'ins1', cantidad: 1 }]);

    f.componentInstance['guardar']();

    const req = http.expectOne(`${base}/informes-produccion/i1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.fecha).toBeUndefined();
    expect(req.request.body.uuidCliente).toBeUndefined();
    req.flush(informeExistente);

    const dialogRef = TestBed.inject(DialogRef);
    expect(dialogRef.close).toHaveBeenCalledWith(informeExistente);
    http.verify();
  });

  it('un error del servidor se muestra en el diálogo y NO lo cierra (para poder reintentar)', () => {
    const { http } = iniciar({});
    const f = TestBed.createComponent(InformeFormDialog);
    http.expectOne(`${base}/admin/insumos`).flush([]);
    f.detectChanges();
    f.componentInstance['form'].setValue({ quesosDiarios: 100, quesosReparados: 0, quesosDeRecorte: 0, recorteEnKilos: null });

    f.componentInstance['guardar']();
    const req = http.expectOne(`${base}/informes-produccion`);
    req.flush({ mensaje: 'Ya existe un informe de produccion para la fecha ' + hoy }, { status: 409, statusText: 'Conflict' });

    expect(f.componentInstance['errorGuardar']()).toContain('Ya existe');
    expect(f.componentInstance['guardando']()).toBe(false);
    const dialogRef = TestBed.inject(DialogRef);
    expect(dialogRef.close).not.toHaveBeenCalled();
    http.verify();
  });
});
