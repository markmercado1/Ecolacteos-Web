import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TokenStoreService } from '../auth/token-store.service';
import { UsuarioMeResponse } from '../auth/auth.models';
import { Shell, coincideRuta } from './shell';

@Component({ template: '' })
class Vacia {}

const CLAVE = 'ecolacteos.nav.seccionesAbiertas';

function usuarioCon(rolNombre: UsuarioMeResponse['rolNombre']): UsuarioMeResponse {
  return { id: 'u-1', nombre: 'Ana Pérez', email: 'ana@ecolacteos.pe', rolNombre, activo: true, unidadesResponsable: [] };
}

async function crear(rol: UsuarioMeResponse['rolNombre'], url = '/produccion') {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: '**', component: Vacia }])]
  });
  TestBed.inject(TokenStoreService).establecer({
    token: 't', refreshToken: 'r', expiraEn: 0, refreshExpiraEn: Date.now() + 100000, usuario: usuarioCon(rol)
  });
  await TestBed.inject(Router).navigateByUrl(url);
  const f = TestBed.createComponent(Shell);
  f.detectChanges();
  return f;
}

const toggles = (f: { nativeElement: HTMLElement }) =>
  Array.from(f.nativeElement.querySelectorAll<HTMLButtonElement>('.nav-group-toggle'));
const enlaces = (f: { nativeElement: HTMLElement }) =>
  Array.from(f.nativeElement.querySelectorAll<HTMLAnchorElement>('a.nav-item')).map((a) => a.textContent?.trim());

describe('Shell — navegación desplegable', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('coincideRuta no confunde /produccion con /produccion-diaria', () => {
    expect(coincideRuta('/produccion', '/produccion')).toBe(true);
    expect(coincideRuta('/produccion?estado=X', '/produccion')).toBe(true);
    expect(coincideRuta('/produccion-diaria', '/produccion')).toBe(false);
  });

  it('ADMIN: secciones plegadas salvo la de la página actual, que se abre sola', async () => {
    const f = await crear('ADMIN', '/produccion');
    const produccion = toggles(f).find((b) => b.textContent?.includes('Producción'))!;
    expect(produccion.getAttribute('aria-expanded')).toBe('true');
    expect(toggles(f).filter((b) => b.getAttribute('aria-expanded') === 'true')).toHaveLength(1);
    expect(enlaces(f)).toContain('Inventario');
    expect(enlaces(f)).not.toContain('Usuarios'); // Administración plegada
    expect(f.componentInstance['tituloActual']()).toBe('Producción');
  });

  it('una sección con un único destino es un enlace directo (Panel económico), sin desplegable', async () => {
    const f = await crear('ADMIN', '/panel');
    expect(enlaces(f)).toContain('Panel económico');
    expect(toggles(f).some((b) => b.textContent?.includes('Visión general'))).toBe(false);
  });

  it('VENTAS ve Inventario como enlace directo y Ventas, Reservas y Clientes dentro de Comercial', async () => {
    const f = await crear('VENTAS', '/ventas');
    expect(toggles(f).map((b) => b.textContent?.trim())).toEqual(['Comercial']);
    expect(enlaces(f)).toEqual(['Inventario', 'Ventas', 'Reservas', 'Clientes']);
  });

  it('solo ADMIN y VENTAS ven Reservas en la navegación', async () => {
    const f = await crear('PRODUCCION', '/inventario');
    expect(enlaces(f)).not.toContain('Reservas');
  });

  it('ADMIN y RECEPCION ven «Desembolsos a proveedores»; los demás roles no', async () => {
    for (const rol of ['ADMIN', 'RECEPCION'] as const) {
      const f = await crear(rol, '/pagos');
      expect(enlaces(f), rol).toContain('Desembolsos a proveedores');
      TestBed.resetTestingModule();
    }
    for (const rol of ['CALIDAD', 'PRODUCCION', 'VENTAS', 'ACOPIADOR'] as const) {
      const f = await crear(rol, '/');
      expect(enlaces(f), rol).not.toContain('Desembolsos a proveedores');
      TestBed.resetTestingModule();
    }
  });

  it('ningún rol ve los módulos retirados', async () => {
    const admin = await crear('ADMIN', '/pagos');
    expect(enlaces(admin)).not.toContain('Revisión de zonas');
    expect(enlaces(admin)).not.toContain('Revisión de documentos');
    expect(enlaces(admin)).not.toContain('Producción diaria');
    TestBed.resetTestingModule();
    for (const rol of ['RECEPCION', 'CALIDAD', 'PRODUCCION', 'VENTAS', 'ACOPIADOR'] as const) {
      const f = await crear(rol, rol === 'RECEPCION' ? '/pagos' : '/');
      expect(enlaces(f), rol).not.toContain('Revisión de zonas');
      TestBed.resetTestingModule();
    }
  });

  it('alternar abre/cierra una sección, actualiza aria-expanded y lo recuerda en este navegador', async () => {
    const f = await crear('ADMIN', '/produccion');
    const admin = toggles(f).find((b) => b.textContent?.includes('Administración'))!;
    admin.click();
    f.detectChanges();
    expect(admin.getAttribute('aria-expanded')).toBe('true');
    expect(enlaces(f)).toContain('Usuarios');
    expect(JSON.parse(localStorage.getItem(CLAVE)!)).toContain('administracion');

    admin.click();
    f.detectChanges();
    expect(admin.getAttribute('aria-expanded')).toBe('false');
    expect(JSON.parse(localStorage.getItem(CLAVE)!)).not.toContain('administracion');
  });

  it('restaura las secciones abiertas guardadas', async () => {
    localStorage.setItem(CLAVE, JSON.stringify(['proveedores']));
    const f = await crear('ADMIN', '/produccion');
    expect(enlaces(f)).toContain('Liquidaciones de leche');     // recordada
    expect(enlaces(f)).toContain('Inventario'); // la actual, siempre abierta al entrar
  });

  it('si la sección actual se pliega, su encabezado queda marcado', async () => {
    const f = await crear('ADMIN', '/produccion');
    const produccion = toggles(f).find((b) => b.textContent?.includes('Producción'))!;
    produccion.click();
    f.detectChanges();
    expect(produccion.getAttribute('aria-expanded')).toBe('false');
    expect(produccion.classList).toContain('contiene-activo');
  });

  it('un valor corrupto en el almacenamiento no rompe el menú', async () => {
    localStorage.setItem(CLAVE, '{no-es-json');
    const f = await crear('ADMIN', '/ventas');
    expect(enlaces(f)).toContain('Ventas');
  });

  it('el icono del botón de menú tiene tamaño propio: sin él se encogía a 0×0 y el botón se veía vacío', async () => {
    const f = await crear('ADMIN', '/panel');
    const icono = (f.nativeElement as HTMLElement).querySelector<HTMLElement>('.mobile-menu ui-icon')!;
    expect(icono).not.toBeNull();
    const estilo = getComputedStyle(icono);
    expect(estilo.width).toBe('1.25rem');
    expect(estilo.height).toBe('1.25rem');
  });
});
