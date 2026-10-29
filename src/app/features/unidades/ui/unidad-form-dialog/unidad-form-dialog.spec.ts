import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { UsuarioResponse } from '../../../usuarios/data-access/usuario.models';
import { UnidadResponse } from '../../data-access/unidad.models';
import { UnidadFormDialog, UnidadFormDialogData } from './unidad-form-dialog';

const base = environment.apiBaseUrl;

const acopiadorElegible: UsuarioResponse = {
  id: 'u-acopiador', nombre: 'Jorge Palomino', email: 'jorge@ecolacteos.pe', rolNombre: 'ACOPIADOR', activo: true
};

const ZONAS_PRUEBA = [
  { id: 'z-1', nombre: 'Huancayo Norte', activa: true },
  { id: 'z-2', nombre: 'El Tambo', activa: true }
];

function crear(data: UnidadFormDialogData): {
  fixture: ComponentFixture<UnidadFormDialog>;
  dialog: UnidadFormDialog;
  http: HttpTestingController;
} {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close: vi.fn() } }
    ]
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(UnidadFormDialog);
  const dialog = fixture.componentInstance;
  fixture.detectChanges();

  http.expectOne(`${base}/admin/zonas`).flush(ZONAS_PRUEBA);
  return { fixture, dialog, http };
}

function flushRutasSinDatos(http: HttpTestingController): void {
  http.expectOne(`${base}/zonas/z-1/ruta`).flush([]);
  http.expectOne(`${base}/zonas/z-2/ruta`).flush([]);
}

describe('UnidadFormDialog — selector de zona/ruta', () => {
  it('carga zonas y consulta la ruta de cada una por separado', () => {
    const { dialog, http } = crear({ responsables: [acopiadorElegible] });

    expect(dialog['cargandoZonas']()).toBe(false);
    expect(dialog['zonasConRuta']().every((zc) => zc.estadoRuta === 'cargando')).toBe(true);

    http.expectOne(`${base}/zonas/z-1/ruta`).flush([
      { id: 'r-1', proveedorId: 'p-1', proveedorNombre: 'X', orden: 1, horaEstimada: null }
    ]);
    http.expectOne(`${base}/zonas/z-2/ruta`).flush([]);

    const estados = new Map(dialog['zonasConRuta']().map((zc) => [zc.zona.id, zc.estadoRuta]));
    expect(estados.get('z-1')).toBe('con-ruta');
    expect(estados.get('z-2')).toBe('sin-ruta');
    http.verify();
  });

  it('un error al consultar la ruta de una zona no se confunde con "sin ruta", y no afecta a las demás', () => {
    const { dialog, http } = crear({ responsables: [acopiadorElegible] });
    http.expectOne(`${base}/zonas/z-1/ruta`).flush('fallo', { status: 500, statusText: 'Error' });
    http.expectOne(`${base}/zonas/z-2/ruta`).flush([]);

    const estados = new Map(dialog['zonasConRuta']().map((zc) => [zc.zona.id, zc.estadoRuta]));
    expect(estados.get('z-1')).toBe('error');
    expect(estados.get('z-2')).toBe('sin-ruta');
    http.verify();
  });

  it('si falla el catálogo de zonas, expone el error y reintentar() lo vuelve a pedir', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIALOG_DATA, useValue: { responsables: [acopiadorElegible] } as UnidadFormDialogData },
        { provide: DialogRef, useValue: { close: vi.fn() } }
      ]
    });
    const http = TestBed.inject(HttpTestingController);
    const dialog = TestBed.createComponent(UnidadFormDialog).componentInstance;

    http.expectOne(`${base}/admin/zonas`).flush('fallo', { status: 500, statusText: 'Error' });
    expect(dialog['errorZonas']()).toBeTruthy();
    expect(dialog['cargandoZonas']()).toBe(false);

    dialog['cargarZonas']();
    http.expectOne(`${base}/admin/zonas`).flush(ZONAS_PRUEBA);
    expect(dialog['errorZonas']()).toBeNull();
    flushRutasSinDatos(http);
    http.verify();
  });

  it('la búsqueda filtra por nombre pero conserva visible la zona ya seleccionada', () => {
    const unidadExistente: UnidadResponse = {
      id: 'un-1', placa: 'ABC-123', capacidadTon: null, zonaId: 'z-1',
      responsableId: acopiadorElegible.id, responsableNombre: acopiadorElegible.nombre
    };
    const { dialog, http } = crear({ responsables: [acopiadorElegible], unidad: unidadExistente });
    flushRutasSinDatos(http);

    dialog['busquedaZona'].set('tambo');
    const visibles = dialog['zonasVisibles']().map((zc) => zc.zona.id);
    expect(visibles).toContain('z-2'); // coincide con la búsqueda
    expect(visibles).toContain('z-1'); // es la selección actual: no debe desaparecer
    http.verify();
  });

  it('al enviar, el payload usa el zonaId seleccionado (UUID), no un rutaId inventado', () => {
    const { dialog, http } = crear({ responsables: [acopiadorElegible] });
    flushRutasSinDatos(http);

    dialog['form'].setValue({ placa: 'XYZ-999', capacidadTon: null, zonaId: 'z-2', responsableId: acopiadorElegible.id });
    dialog.enviar();

    const req = http.expectOne(`${base}/admin/unidades`);
    expect(req.request.body).toEqual({ placa: 'XYZ-999', capacidadTon: null, zonaId: 'z-2', responsableId: acopiadorElegible.id });
    req.flush({
      id: 'un-2', placa: 'XYZ-999', capacidadTon: null, zonaId: 'z-2',
      responsableId: acopiadorElegible.id, responsableNombre: acopiadorElegible.nombre
    });
    http.verify();
  });
});

describe('UnidadFormDialog — responsable actual fuera de la lista de acopiadores', () => {
  it('si el responsable actual no es ACOPIADOR activo, se muestra explícitamente y no se sustituye', () => {
    const responsableReal: UsuarioResponse = {
      id: 'u-ventas', nombre: 'Luis Ventas', email: 'luis@ecolacteos.pe', rolNombre: 'VENTAS', activo: true
    };
    const unidadExistente: UnidadResponse = {
      id: 'un-1', placa: 'ABC-123', capacidadTon: null, zonaId: null,
      responsableId: 'u-ventas', responsableNombre: 'Luis Ventas'
    };
    const { dialog, fixture, http } = crear({
      responsables: [acopiadorElegible],
      unidad: unidadExistente,
      responsableActual: responsableReal
    });
    flushRutasSinDatos(http);

    expect(dialog['sinCoincidenciaDeResponsable']()).toBe(false); // responsableActual ya lo explica
    expect(dialog['form'].getRawValue().responsableId).toBe('u-ventas');

    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('Luis Ventas');
    expect(html.textContent).toContain('Ventas');
    http.verify();
  });

  it('sin responsableActual y sin coincidencia en la lista de elegibles, se marca para revisar sin perder el valor', () => {
    const unidadExistente: UnidadResponse = {
      id: 'un-1', placa: 'ABC-123', capacidadTon: null, zonaId: null,
      responsableId: 'u-desconocido', responsableNombre: 'Persona Desconocida'
    };
    const { dialog, http } = crear({ responsables: [acopiadorElegible], unidad: unidadExistente });
    flushRutasSinDatos(http);

    expect(dialog['sinCoincidenciaDeResponsable']()).toBe(true);
    expect(dialog['form'].getRawValue().responsableId).toBe('u-desconocido');
    http.verify();
  });
});
