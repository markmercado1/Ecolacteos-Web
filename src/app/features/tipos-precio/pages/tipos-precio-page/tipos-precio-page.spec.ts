import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { CampoUnicoDialog, CampoUnicoDialogData } from '../../../../shared/ui/dialog/campo-unico-dialog';
import { TipoPrecioResponse } from '../../data-access/tipo-precio.models';
import { TiposPrecioPage } from './tipos-precio-page';

const url = `${environment.apiBaseUrl}/tipos-precio`;

const TIPOS: TipoPrecioResponse[] = [
  { codigo: 'MAYORISTA', nombre: 'Mayorista', descripcion: 'Cliente habilitado', activo: true, protegido: false, ultimoCambio: null },
  { codigo: 'PROVEEDOR', nombre: 'Proveedor', descripcion: 'Proveedor del padrón', activo: false, protegido: false,
    ultimoCambio: { activo: false, motivo: 'Ya no vendemos a proveedores', usuarioNombre: 'Admin Planta', creadoEn: '2026-10-27T09:30:00' } },
  { codigo: 'PUBLICO', nombre: 'Público', descripcion: 'Catálogo y reservas', activo: true, protegido: true, ultimoCambio: null }
];

function crear() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(TiposPrecioPage);
  http.expectOne((r) => r.url === url && r.params.get('soloActivos') === 'false').flush(TIPOS);
  f.detectChanges();
  return { f, http };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;

describe('TiposPrecioPage', () => {
  it('lista todos los tipos con su estado y el último cambio, y protege a PUBLICO', () => {
    const { f, http } = crear();
    const filas = Array.from(el(f).querySelectorAll('[data-testid="tipo-precio"]'));
    expect(filas.length).toBe(3);
    expect(Array.from(el(f).querySelectorAll('[data-testid="estado-tipo"]')).map((e) => e.textContent?.trim())).toEqual(['Activo', 'Desactivado', 'Activo']);
    expect(filas[1].textContent).toContain('Ya no vendemos a proveedores');
    expect(filas[1].textContent).toContain('27/10/2026 09:30');
    expect(filas[2].querySelector('[data-testid="protegido"]')).not.toBeNull();
    expect(filas[2].querySelector('[data-testid="cambiar-estado"]')).toBeNull();
    http.verify();
  });

  it('desactivar pide un motivo, llama al servidor con activo=false y recarga la lista', () => {
    const { f, http } = crear();
    const dialog = TestBed.inject(Dialog);
    const abrir = vi.spyOn(dialog, 'open').mockReturnValue({ closed: of(TIPOS[0]) } as never);
    (el(f).querySelectorAll('[data-testid="cambiar-estado"]')[0] as HTMLButtonElement).click();
    expect(abrir.mock.calls[0][0]).toBe(CampoUnicoDialog);
    const datos = (abrir.mock.calls[0][1] as { data: CampoUnicoDialogData }).data;
    expect(datos.titulo).toContain('Desactivar');
    datos.guardar('  Sin ventas mayoristas  ').subscribe();
    const req = http.expectOne(`${url}/MAYORISTA/estado`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ activo: false, motivo: 'Sin ventas mayoristas' });
    req.flush({ ...TIPOS[0], activo: false });
    http.expectOne((r) => r.url === url).flush(TIPOS);
    http.verify();
  });

  it('un tipo desactivado ofrece «Activar»', () => {
    const { f, http } = crear();
    const dialog = TestBed.inject(Dialog);
    const abrir = vi.spyOn(dialog, 'open').mockReturnValue({ closed: of(undefined) } as never);
    const boton = el(f).querySelectorAll('[data-testid="cambiar-estado"]')[1] as HTMLButtonElement;
    expect(boton.textContent).toContain('Activar');
    boton.click();
    expect((abrir.mock.calls[0][1] as { data: CampoUnicoDialogData }).data.titulo).toContain('Activar el tipo Proveedor');
    http.verify();
  });
});
