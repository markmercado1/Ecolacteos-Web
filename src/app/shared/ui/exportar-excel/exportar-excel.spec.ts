import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { DescargaArchivos } from '../../util/descarga-archivos';
import { ToastService } from '../toast/toast.service';
import { ArchivoExportado, ExportacionExcelApi, FiltroExportacion } from './exportacion-excel.api';
import { ExportarExcelComponent } from './exportar-excel';

@Component({
  selector: 'app-host-exportar',
  imports: [ExportarExcelComponent],
  template: `<ui-exportar-excel recurso="proveedores" [filtro]="filtro()" [deshabilitado]="bloqueado()" />`
})
class HostComponent {
  filtro = signal<FiltroExportacion>({ zonaId: 'z-1', busqueda: 'huaman' });
  bloqueado = signal(false);
}

function preparar(descargar: ReturnType<typeof vi.fn>) {
  const guardar = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: ExportacionExcelApi, useValue: { descargar } },
      { provide: DescargaArchivos, useValue: { guardar } }
    ]
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const boton = () => fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  return { fixture, boton, guardar, toast: TestBed.inject(ToastService) };
}

describe('ExportarExcelComponent', () => {
  it('pide el recurso con el filtro vigente y guarda el archivo con el nombre del servidor', () => {
    const archivo: ArchivoExportado = { blob: new Blob(['x']), nombre: 'proveedores-20261022-1030.xlsx' };
    const descargar = vi.fn().mockReturnValue(of(archivo));
    const { boton, guardar, toast } = preparar(descargar);

    expect(boton().textContent).toContain('Exportar a Excel');
    boton().click();

    expect(descargar).toHaveBeenCalledWith('proveedores', { zonaId: 'z-1', busqueda: 'huaman' }, 'proveedores.xlsx');
    expect(guardar).toHaveBeenCalledWith(archivo.blob, 'proveedores-20261022-1030.xlsx');
    expect(toast.avisos().at(-1)?.tipo).toBe('exito');
  });

  it('usa el filtro actual en cada clic, no el del momento de crear el botón', () => {
    const descargar = vi.fn().mockReturnValue(of({ blob: new Blob(['x']), nombre: 'a.xlsx' }));
    const { fixture, boton } = preparar(descargar);

    fixture.componentInstance.filtro.set({ activo: true });
    fixture.detectChanges();
    boton().click();

    expect(descargar.mock.calls[0][1]).toEqual({ activo: true });
  });

  it('mientras exporta se bloquea y no lanza una segunda petición', () => {
    const pendiente = new Subject<ArchivoExportado>();
    const descargar = vi.fn().mockReturnValue(pendiente);
    const { fixture, boton } = preparar(descargar);

    boton().click();
    fixture.detectChanges();
    expect(boton().disabled).toBe(true);
    expect(boton().textContent).toContain('Exportando');
    boton().click();
    expect(descargar).toHaveBeenCalledTimes(1);

    pendiente.next({ blob: new Blob(['x']), nombre: 'a.xlsx' });
    pendiente.complete();
    fixture.detectChanges();
    expect(boton().disabled).toBe(false);
  });

  it('muestra el mensaje del servidor si la exportación falla y no guarda nada', () => {
    const error = new HttpErrorResponse({ status: 400, error: { mensaje: 'La exportación tiene 60000 filas.' } });
    const descargar = vi.fn().mockReturnValue(throwError(() => error));
    const { fixture, boton, guardar, toast } = preparar(descargar);

    boton().click();
    fixture.detectChanges();

    expect(guardar).not.toHaveBeenCalled();
    expect(toast.avisos().at(-1)).toMatchObject({ tipo: 'error', mensaje: 'La exportación tiene 60000 filas.' });
    expect(boton().disabled).toBe(false);
  });

  it('puede deshabilitarse desde afuera', () => {
    const descargar = vi.fn();
    const { fixture, boton } = preparar(descargar);

    fixture.componentInstance.bloqueado.set(true);
    fixture.detectChanges();

    expect(boton().disabled).toBe(true);
  });
});
