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

/** Clave que guardaban versiones anteriores del menú: ya no se lee, pero hay navegadores que aún la tienen. */
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
    expect(enlaces(f)).not.toContain('Usuarios'); // Configuración plegada
    expect(f.componentInstance['tituloActual']()).toBe('Producción');
  });

  it('una sección con un único destino es un enlace directo (Panel económico), sin desplegable', async () => {
    const f = await crear('ADMIN', '/panel');
    expect(enlaces(f)).toContain('Panel económico');
    expect(toggles(f).some((b) => b.textContent?.includes('Visión general'))).toBe(false);
  });

  it('VENTAS ve Inventario como enlace directo y Ventas, Reservas y Clientes dentro de Ventas', async () => {
    const f = await crear('VENTAS', '/ventas');
    expect(toggles(f).map((b) => b.textContent?.trim())).toEqual(['Ventas']);
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

  it('alternar abre/cierra una sección y actualiza aria-expanded, sin guardar nada en el navegador', async () => {
    const f = await crear('ADMIN', '/produccion');
    const configuracion = toggles(f).find((b) => b.textContent?.includes('Configuración'))!;
    configuracion.click();
    f.detectChanges();
    expect(configuracion.getAttribute('aria-expanded')).toBe('true');
    expect(enlaces(f)).toContain('Usuarios');
    expect(localStorage.getItem(CLAVE)).toBeNull();

    configuracion.click();
    f.detectChanges();
    expect(configuracion.getAttribute('aria-expanded')).toBe('false');
    expect(enlaces(f)).not.toContain('Usuarios');
  });

  it('no restaura secciones guardadas por versiones anteriores: solo se abre la de la página actual', async () => {
    localStorage.setItem(CLAVE, JSON.stringify(['proveedores', 'comercial']));
    const f = await crear('ADMIN', '/produccion');
    expect(enlaces(f)).not.toContain('Liquidaciones de leche');
    expect(enlaces(f)).toContain('Inventario');
    expect(toggles(f).filter((b) => b.getAttribute('aria-expanded') === 'true')).toHaveLength(1);
  });

  it('al navegar a otra sección se abre solo la nueva y se pliegan las demás', async () => {
    const f = await crear('ADMIN', '/produccion');
    await TestBed.inject(Router).navigateByUrl('/ventas');
    f.detectChanges();
    const abiertas = toggles(f).filter((b) => b.getAttribute('aria-expanded') === 'true').map((b) => b.textContent?.trim());
    expect(abiertas).toEqual(['Ventas']);
    expect(enlaces(f)).toContain('Reservas');
    expect(enlaces(f)).not.toContain('Inventario');
  });

  it('navegar dentro de la misma sección también pliega lo que se abrió a mano', async () => {
    const f = await crear('ADMIN', '/ventas');
    toggles(f).find((b) => b.textContent?.includes('Configuración'))!.click();
    f.detectChanges();
    expect(toggles(f).filter((b) => b.getAttribute('aria-expanded') === 'true')).toHaveLength(2);

    await TestBed.inject(Router).navigateByUrl('/reservas');
    f.detectChanges();
    const abiertas = toggles(f).filter((b) => b.getAttribute('aria-expanded') === 'true').map((b) => b.textContent?.trim());
    expect(abiertas).toEqual(['Ventas']);
  });

  it('en una página sin sección (p. ej. /403) todas las secciones quedan plegadas', async () => {
    const f = await crear('ADMIN', '/403');
    expect(toggles(f).filter((b) => b.getAttribute('aria-expanded') === 'true')).toHaveLength(0);
  });

  it('si la sección actual se pliega, su encabezado queda marcado', async () => {
    const f = await crear('ADMIN', '/produccion');
    const produccion = toggles(f).find((b) => b.textContent?.includes('Producción'))!;
    produccion.click();
    f.detectChanges();
    expect(produccion.getAttribute('aria-expanded')).toBe('false');
    expect(produccion.classList).toContain('contiene-activo');
  });

  it('un valor corrupto en el almacenamiento no afecta al menú', async () => {
    localStorage.setItem(CLAVE, '{no-es-json');
    const f = await crear('ADMIN', '/ventas');
    expect(enlaces(f)).toContain('Ventas');
  });

  describe('agrupación por rol (los permisos no cambian al reagrupar)', () => {
    async function todo(rol: UsuarioMeResponse['rolNombre']) {
      const f = await crear(rol, '/');
      for (const b of toggles(f)) if (b.getAttribute('aria-expanded') !== 'true') b.click();
      f.detectChanges();
      return { secciones: toggles(f).map((b) => b.textContent?.trim()), enlaces: enlaces(f) };
    }

    const esperado: Record<UsuarioMeResponse['rolNombre'], { secciones: string[]; enlaces: string[] }> = {
      ADMIN: {
        secciones: ['Acopio y calidad', 'Producción', 'Ventas', 'Proveedores y pagos', 'Configuración'],
        enlaces: [
          'Panel económico',
          'Acopios', 'Calidad', 'Jornadas', 'Recepción', 'Rutas',
          'Producción', 'Inventario',
          'Ventas', 'Reservas', 'Clientes',
          'Proveedores', 'Liquidaciones de leche', 'Desembolsos a proveedores', 'Comunicados',
          'Precios', 'Tipos de precio', 'IGV de las ventas', 'Catálogos', 'Usuarios', 'Acopiadores', 'Unidades'
        ]
      },
      RECEPCION: {
        secciones: ['Acopio y calidad', 'Proveedores y pagos'],
        enlaces: ['Jornadas', 'Recepción', 'Liquidaciones de leche', 'Desembolsos a proveedores']
      },
      CALIDAD: { secciones: [], enlaces: ['Calidad'] },
      PRODUCCION: { secciones: ['Producción'], enlaces: ['Producción', 'Inventario'] },
      VENTAS: { secciones: ['Ventas'], enlaces: ['Inventario', 'Ventas', 'Reservas', 'Clientes'] },
      ACOPIADOR: { secciones: [], enlaces: ['Rutas'] }
    };

    for (const rol of Object.keys(esperado) as UsuarioMeResponse['rolNombre'][]) {
      it(`${rol} ve exactamente sus secciones y módulos`, async () => {
        expect(await todo(rol)).toEqual(esperado[rol]);
      });
    }

    it('solo ADMIN ve «Configuración»', async () => {
      for (const rol of ['RECEPCION', 'CALIDAD', 'PRODUCCION', 'VENTAS', 'ACOPIADOR'] as const) {
        expect((await todo(rol)).secciones, rol).not.toContain('Configuración');
        TestBed.resetTestingModule();
      }
    });
  });

  it('la barra superior muestra sección › página, sin repetir el nombre de la aplicación ni el de la sección', async () => {
    const f = await crear('ADMIN', '/reservas');
    const crumb = (f.nativeElement as HTMLElement).querySelector('.crumb')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(crumb).toMatch(/^Ventas\s*\/\s*Reservas$/); // sección › página
    TestBed.resetTestingModule();

    const g = await crear('ADMIN', '/ventas'); // la sección y la página se llaman igual: solo la página
    expect((g.nativeElement as HTMLElement).querySelector('.crumb')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Ventas');
  });

  it('el rol de la cuenta se muestra con su nombre legible', async () => {
    const f = await crear('RECEPCION', '/jornadas');
    expect((f.nativeElement as HTMLElement).querySelector('.account small')?.textContent?.trim()).toBe('Recepción');
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
