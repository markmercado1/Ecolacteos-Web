import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { environment } from '../../../../../environments/environment';
import { PrecioQuesoFormDialog, PrecioQuesoFormDialogData } from './precio-queso-form-dialog';
import { PresentacionResponse } from '../../../catalogos/data-access/producto.models';

const base = environment.apiBaseUrl;

function presentacion(datos: Partial<PresentacionResponse> = {}): PresentacionResponse {
  return {
    id: 'pres-1',
    productoId: 'prod-1',
    nombre: 'Botella 1 L',
    contenidoCantidad: 1,
    contenidoUnidad: 'L',
    unidadConteo: 'botella',
    activo: true,
    ...datos
  };
}

function crear(data: PrecioQuesoFormDialogData) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const dialogRef = TestBed.inject(DialogRef) as unknown as { close: ReturnType<typeof vi.fn> };
  const f = TestBed.createComponent(PrecioQuesoFormDialog);
  const c = f.componentInstance;
  return { f, http, c, dialogRef };
}

function llenarFormularioValido(c: PrecioQuesoFormDialog) {
  c['form'].controls.modalidad.setValue('PUBLICO');
  c['form'].controls.precio.setValue(15);
  c['form'].controls.vigenteDesde.setValue('2026-09-18');
}

describe('PrecioQuesoFormDialog', () => {
  it('muestra producto y presentación preseleccionados, tomados de los datos del diálogo (no de un select)', () => {
    const { c } = crear({ presentacion: presentacion(), productoNombre: 'Yogurt de fresa' });
    expect(c['data'].productoNombre).toBe('Yogurt de fresa');
    expect(c['data'].presentacion.nombre).toBe('Botella 1 L');
  });

  it('enviar() hace POST con presentacionId (no productoId) y cierra el diálogo con la respuesta', () => {
    const { c, http, dialogRef } = crear({ presentacion: presentacion({ id: 'pres-9' }), productoNombre: 'Yogurt' });
    llenarFormularioValido(c);

    c['enviar']();
    expect(c['enviando']()).toBe(true);

    const req = http.expectOne(`${base}/admin/precios-queso`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ presentacionId: 'pres-9', modalidad: 'PUBLICO', precio: 15, vigenteDesde: '2026-09-18' });

    const respuesta = {
      id: 'pq-1', presentacionId: 'pres-9', presentacionNombre: 'Botella 1 L',
      productoId: 'prod-1', productoNombre: 'Yogurt', modalidad: 'PUBLICO' as const, precio: 15, vigenteDesde: '2026-09-18'
    };
    req.flush(respuesta);

    expect(dialogRef.close).toHaveBeenCalledWith(respuesta);
  });

  it('no envía nada si el formulario es inválido, y marca los campos como tocados', () => {
    const { c, http } = crear({ presentacion: presentacion(), productoNombre: 'Yogurt' });

    c['enviar']();

    http.expectNone(`${base}/admin/precios-queso`);
    expect(c['form'].controls.modalidad.touched).toBe(true);
  });

  it('un rechazo del servidor (ej. vigencia duplicada) muestra el error y NO cierra el diálogo', () => {
    const { c, http, dialogRef } = crear({ presentacion: presentacion(), productoNombre: 'Yogurt' });
    llenarFormularioValido(c);

    c['enviar']();
    http.expectOne(`${base}/admin/precios-queso`).flush(
      { mensaje: 'Ya existe un precio para esta presentación, modalidad y vigencia' },
      { status: 409, statusText: 'Conflict' }
    );

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(c['enviando']()).toBe(false);
    expect(c['errorServidor']()).toBeTruthy();
  });

  it('cerrar sin enviar cierra el diálogo sin resultado', () => {
    const { c, dialogRef } = crear({ presentacion: presentacion(), productoNombre: 'Yogurt' });
    c['dialogRef'].close();
    expect(dialogRef.close).toHaveBeenCalledWith();
  });
});

describe('PrecioQuesoFormDialog — tipos de precio dinámicos', () => {
  it('la modalidad se elige entre los tipos activos que devuelve el servidor, no entre una lista fija', () => {
    const { f, http } = crear({ presentacion: presentacion(), productoNombre: 'Yogurt' } as PrecioQuesoFormDialogData);
    http.expectOne((r) => r.url.endsWith('/tipos-precio') && r.params.get('soloActivos') === 'true').flush([
      { codigo: 'MAYORISTA', nombre: 'Mayorista', descripcion: '', activo: true, protegido: false, reglaComprador: 'CUALQUIERA', ultimoCambio: null },
      { codigo: 'PUBLICO', nombre: 'Público', descripcion: '', activo: true, protegido: false, reglaComprador: 'CUALQUIERA', ultimoCambio: null }
    ]);
    f.detectChanges();
    const opciones = Array.from((f.nativeElement as HTMLElement).querySelectorAll('#pq-modalidad option')).map((o) => (o as HTMLOptionElement).value);
    expect(opciones).toEqual(['', 'MAYORISTA', 'PUBLICO']);
  });
});
