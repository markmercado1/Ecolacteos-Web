import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { DescargaArchivos } from '../../util/descarga-archivos';
import { ToastService } from '../toast/toast.service';
import { ImportacionExcelApi } from './importacion-excel.api';
import { ResultadoImportacion, VistaPreviaImportacion } from './importacion-excel.models';
import { ImportarExcelDialog } from './importar-excel-dialog';

function vistaPrevia(cambios: Partial<VistaPreviaImportacion> = {}): VistaPreviaImportacion {
  return {
    id: 'imp-1', tipo: 'proveedores', titulo: 'Proveedores', version: 1, nombreArchivo: 'padron.xlsx',
    totalFilas: 4, validas: 2, invalidas: 1, duplicadas: 1, omitidas: 1, expiraEn: '2026-10-22T23:00:00', puedeConfirmar: true,
    columnas: [{ clave: 'nombre', encabezado: 'Nombre completo' }, { clave: 'dni', encabezado: 'DNI' }],
    filas: [
      { fila: 2, estado: 'VALIDA', valores: { nombre: 'Rosa Quispe', dni: '04567890' }, mensajes: [] },
      { fila: 3, estado: 'VALIDA', valores: { nombre: 'Luis Mamani', dni: '12345678' }, mensajes: [] },
      { fila: 4, estado: 'INVALIDA', valores: { nombre: 'Sin DNI', dni: '12' }, mensajes: ['DNI: debe tener exactamente 8 dígitos'] },
      { fila: 5, estado: 'DUPLICADA', valores: { nombre: 'Repetido', dni: '99999999' }, mensajes: ['Ya existe un proveedor con el DNI 99999999'] }
    ],
    ...cambios
  };
}

function resultado(cambios: Partial<ResultadoImportacion> = {}): ResultadoImportacion {
  return {
    id: 'imp-1', tipo: 'proveedores', titulo: 'Proveedores', creadas: 2, invalidas: 1, duplicadas: 1, omitidas: 0, yaConfirmada: false,
    confirmadoEn: '2026-10-22T22:00:00',
    columnas: [{ clave: 'nombre', encabezado: 'Nombre completo' }, { clave: 'dni', encabezado: 'DNI' }],
    filasNoCreadas: [
      { fila: 4, estado: 'INVALIDA', valores: { nombre: 'Sin DNI', dni: '12' }, mensajes: ['DNI: debe tener exactamente 8 dígitos'] },
      { fila: 5, estado: 'DUPLICADA', valores: { nombre: 'Repetido', dni: '99999999' }, mensajes: ['Ya existe un proveedor con el DNI 99999999'] }
    ],
    ...cambios
  };
}

function archivo(nombre: string, bytes = 100): File {
  return new File([new Uint8Array(bytes)], nombre, { type: 'application/octet-stream' });
}

describe('ImportarExcelDialog', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let cerrado: Subject<unknown>;
  let close: ReturnType<typeof vi.fn>;
  let guardar: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<ImportarExcelDialog>;

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const boton = (etiqueta: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes(etiqueta)) as HTMLButtonElement | undefined;

  function elegir(f: File) {
    const entrada = (fixture.nativeElement as HTMLElement).querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(entrada, 'files', { value: [f], configurable: true });
    entrada.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = {
      plantilla: vi.fn().mockReturnValue(of({ blob: new Blob(['x']), nombre: 'plantilla-proveedores-v1.xlsx' })),
      previsualizar: vi.fn().mockReturnValue(of(vistaPrevia())),
      confirmar: vi.fn().mockReturnValue(of(resultado())),
      reporte: vi.fn().mockReturnValue(of({ blob: new Blob(['x']), nombre: 'reporte-proveedores-1.xlsx' })),
      cancelar: vi.fn().mockReturnValue(of(undefined))
    };
    cerrado = new Subject();
    close = vi.fn();
    guardar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: { tipo: 'proveedores', nombre: 'proveedores' } },
        { provide: DialogRef, useValue: { close, closed: cerrado.asObservable() } },
        { provide: ImportacionExcelApi, useValue: api },
        { provide: DescargaArchivos, useValue: { guardar } }
      ]
    });
    fixture = TestBed.createComponent(ImportarExcelDialog);
    fixture.detectChanges();
  });

  it('empieza pidiendo la plantilla oficial y no permite revisar sin archivo', () => {
    expect(texto()).toContain('Importar proveedores desde Excel');
    expect(texto()).toContain('plantilla oficial');
    expect(boton('Revisar archivo')?.disabled).toBe(true);
  });

  it('descarga la plantilla con el nombre que sugiere el servidor', () => {
    boton('Descargar plantilla')!.click();

    expect(api['plantilla']).toHaveBeenCalledWith('proveedores');
    expect(guardar).toHaveBeenCalledWith(expect.any(Blob), 'plantilla-proveedores-v1.xlsx');
  });

  it('rechaza en el cliente un archivo que no es .xlsx o es demasiado grande, sin llamar al servidor', () => {
    elegir(archivo('padron.csv'));
    expect(texto()).toContain('Solo se aceptan archivos .xlsx');
    expect(boton('Revisar archivo')?.disabled).toBe(true);

    elegir(archivo('padron.xlsx', 3 * 1024 * 1024));
    expect(texto()).toContain('el máximo es 2048 KB');
    expect(boton('Revisar archivo')?.disabled).toBe(true);
    expect(api['previsualizar']).not.toHaveBeenCalled();
  });

  it('revisa el archivo y muestra la vista previa con válidas, errores y duplicadas, sin confirmar nada', () => {
    elegir(archivo('padron.xlsx'));
    boton('Revisar archivo')!.click();
    fixture.detectChanges();

    expect(api['previsualizar']).toHaveBeenCalledWith('proveedores', expect.any(File));
    expect(api['confirmar']).not.toHaveBeenCalled();
    expect(texto()).toContain('todavía no se guardó nada');
    expect(texto()).toContain('2 válidas');
    expect(texto()).toContain('1 con error');
    expect(texto()).toContain('1 duplicadas');
    expect(texto()).toContain('1 en blanco');
    expect(texto()).toContain('se omitirán');
    expect(texto()).toContain('Rosa Quispe');
    expect(texto()).toContain('04567890'); // el DNI conserva sus ceros
    expect(boton('Confirmar e importar 2 filas')?.disabled).toBe(false);
  });

  it('un error del servidor al revisar se muestra y no avanza', () => {
    api['previsualizar'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { mensaje: 'Esta es la plantilla de «insumos»' } })));
    elegir(archivo('padron.xlsx'));
    boton('Revisar archivo')!.click();
    fixture.detectChanges();

    expect(texto()).toContain('Esta es la plantilla de «insumos»');
    expect(texto()).toContain('Revisar archivo');
  });

  it('filtra las filas por categoría', () => {
    elegir(archivo('padron.xlsx'));
    boton('Revisar archivo')!.click();
    fixture.detectChanges();

    boton('Con error (1)')!.click();
    fixture.detectChanges();
    expect(texto()).toContain('Sin DNI');
    expect(texto()).not.toContain('Rosa Quispe');

    boton('Duplicadas (1)')!.click();
    fixture.detectChanges();
    expect(texto()).toContain('Repetido');
    expect(texto()).not.toContain('Sin DNI');
  });

  it('descarga el reporte de errores de la importación en curso', () => {
    elegir(archivo('padron.xlsx'));
    boton('Revisar archivo')!.click();
    fixture.detectChanges();

    boton('Descargar reporte de errores')!.click();

    expect(api['reporte']).toHaveBeenCalledWith('imp-1');
    expect(guardar).toHaveBeenCalledWith(expect.any(Blob), 'reporte-proveedores-1.xlsx');
  });

  it('confirma una sola vez aunque se haga clic varias veces y muestra el resultado', () => {
    const pendiente = new Subject<ResultadoImportacion>();
    api['confirmar'].mockReturnValue(pendiente);
    elegir(archivo('padron.xlsx'));
    boton('Revisar archivo')!.click();
    fixture.detectChanges();

    const confirmar = boton('Confirmar e importar 2 filas')!;
    confirmar.click();
    fixture.detectChanges();
    expect(boton('Importando')?.disabled).toBe(true);
    boton('Importando')!.click();
    expect(api['confirmar']).toHaveBeenCalledTimes(1);
    expect(api['confirmar']).toHaveBeenCalledWith('imp-1', false);

    pendiente.next(resultado());
    pendiente.complete();
    fixture.detectChanges();
    expect(texto()).toContain('Se importaron 2 registros');
    expect(texto()).toContain('Estas filas no se importaron');
    expect(texto()).toContain('Sin DNI');
  });

  it('no deja confirmar si no hay ninguna fila válida', () => {
    api['previsualizar'].mockReturnValue(of(vistaPrevia({ validas: 0, puedeConfirmar: false, invalidas: 4, duplicadas: 0, filas: vistaPrevia().filas.slice(2, 3) })));
    elegir(archivo('padron.xlsx'));
    boton('Revisar archivo')!.click();
    fixture.detectChanges();

    expect(texto()).toContain('No hay ninguna fila válida');
    expect(boton('Confirmar e importar')?.disabled).toBe(true);
  });

  it('si la confirmación falla muestra el motivo y permite reintentar la misma vista previa', () => {
    api['confirmar'].mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: { mensaje: 'No se creó ningún registro. La fila 4 no se pudo guardar.' } })));
    elegir(archivo('padron.xlsx'));
    boton('Revisar archivo')!.click();
    fixture.detectChanges();

    boton('Confirmar e importar 2 filas')!.click();
    fixture.detectChanges();
    expect(texto()).toContain('No se creó ningún registro');
    expect(boton('Confirmar e importar 2 filas')?.disabled).toBe(false);

    boton('Confirmar e importar 2 filas')!.click();
    fixture.detectChanges();
    expect(api['confirmar']).toHaveBeenCalledTimes(2);
    expect(texto()).toContain('Se importaron 2 registros');
  });

  it('una importación repetida avisa que no creó nada nuevo', () => {
    api['confirmar'].mockReturnValue(of(resultado({ yaConfirmada: true })));
    elegir(archivo('padron.xlsx'));
    boton('Revisar archivo')!.click();
    fixture.detectChanges();
    boton('Confirmar e importar 2 filas')!.click();
    fixture.detectChanges();

    expect(texto()).toContain('ya estaba confirmada');
  });

  it('cerrar el diálogo en la revisión descarta la vista previa en el servidor', () => {
    elegir(archivo('padron.xlsx'));
    boton('Revisar archivo')!.click();
    fixture.detectChanges();

    cerrado.next(undefined); // cualquier forma de cerrar (X, Escape, clic afuera) emite closed
    expect(api['cancelar']).toHaveBeenCalledWith('imp-1');
  });

  it('cerrar después de confirmar no cancela nada y devuelve cuántos se crearon', () => {
    elegir(archivo('padron.xlsx'));
    boton('Revisar archivo')!.click();
    fixture.detectChanges();
    boton('Confirmar e importar 2 filas')!.click();
    fixture.detectChanges();

    boton('Cerrar')!.click();
    cerrado.next(2);

    expect(close).toHaveBeenCalledWith(2);
    expect(api['cancelar']).not.toHaveBeenCalled();
  });

  it('cancelar sin haber revisado no llama al servidor y no devuelve resultado', () => {
    boton('Cancelar')!.click();
    cerrado.next(undefined);

    expect(close).toHaveBeenCalledWith(undefined);
    expect(api['cancelar']).not.toHaveBeenCalled();
    void TestBed.inject(ToastService);
  });

  describe('tipos que no importan a medias (ingresos de insumos, saldos iniciales)', () => {
    const conErrores = () => vistaPrevia({ tipo: 'ingresos-insumo', validas: 4, invalidas: 2, duplicadas: 1, totalFilas: 7, exigeConfirmarParcial: true });

    function revisar(vista: VistaPreviaImportacion) {
      api['previsualizar'].mockReturnValue(of(vista));
      elegir(archivo('ingresos.xlsx'));
      boton('Revisar archivo')!.click();
      fixture.detectChanges();
    }

    it('con errores no se puede confirmar hasta marcar expresamente importar solo las válidas', () => {
      revisar(conErrores());
      expect(texto()).toContain('No se importa nada');
      expect(boton('Confirmar e importar')?.disabled).toBe(true);
      boton('Confirmar e importar')!.click();
      expect(api['confirmar']).not.toHaveBeenCalled();

      const casilla = (fixture.nativeElement as HTMLElement).querySelector('input[type=checkbox]') as HTMLInputElement;
      casilla.checked = true;
      casilla.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(boton('Confirmar e importar')?.disabled).toBe(false);
      boton('Confirmar e importar')!.click();
      expect(api['confirmar']).toHaveBeenCalledWith(expect.any(String), true);   // soloValidas=true, a pedido expreso
    });

    it('sin errores se confirma directo y sin pedir importación parcial', () => {
      revisar(vistaPrevia({ tipo: 'ingresos-insumo', validas: 3, invalidas: 0, duplicadas: 0, totalFilas: 3, exigeConfirmarParcial: false }));
      expect((fixture.nativeElement as HTMLElement).querySelector('input[type=checkbox]')).toBeNull();
      expect(boton('Confirmar e importar')?.disabled).toBe(false);
      boton('Confirmar e importar')!.click();
      expect(api['confirmar']).toHaveBeenCalledWith(expect.any(String), false);
    });

    it('los tipos de datos maestros siguen importando lo válido y avisando de lo omitido', () => {
      revisar(vistaPrevia({ validas: 2, invalidas: 1 }));
      expect(texto()).toContain('se omitirán');
      expect(boton('Confirmar e importar')?.disabled).toBe(false);
    });
  });
});
