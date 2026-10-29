import { Route } from '@angular/router';
import { routes } from '../../app.routes';
import { roleGuard } from '../auth/role.guard';
import { GRUPOS_NAVEGACION } from './nav-items';

function buscar(rutas: Route[], path: string): Route | undefined {
  for (const r of rutas) {
    if (r.path === path) return r;
    const hija = r.children ? buscar(r.children, path) : undefined;
    if (hija) return hija;
  }
  return undefined;
}

const items = GRUPOS_NAVEGACION.flatMap((g) => g.items);

/** Módulos que existen hoy en el menú: reorganizar los grupos no debe sumar ni quitar ninguno. */
const RUTAS_DEL_MENU = [
  '/acopios', '/acopiadores', '/calidad', '/catalogos', '/clientes', '/comunicados', '/igv', '/inventario', '/jornadas',
  '/pagos', '/pagos-efectivos', '/panel', '/precios', '/produccion', '/proveedores', '/proveedores-compra', '/recepcion', '/reservas', '/rutas', '/trazabilidad',
  '/tipos-precio', '/unidades', '/usuarios', '/ventas'
];

describe('Navegación — coherencia con los permisos de las rutas', () => {
  it('el menú ofrece exactamente los mismos módulos, cada uno una sola vez', () => {
    expect(items.map((i) => i.ruta).sort()).toEqual([...RUTAS_DEL_MENU].sort());
  });

  it('cada ítem apunta a una ruta protegida por roleGuard con exactamente los mismos roles', () => {
    for (const item of items) {
      const ruta = buscar(routes, item.ruta.slice(1));
      expect(ruta, item.ruta).toBeDefined();
      expect(ruta!.canActivate, item.ruta).toContain(roleGuard);
      expect(ruta!.data?.['roles'], item.ruta).toEqual(item.roles);
    }
  });

  it('los grupos tienen id único y ningún grupo queda vacío', () => {
    const ids = GRUPOS_NAVEGACION.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const grupo of GRUPOS_NAVEGACION) expect(grupo.items.length, grupo.id).toBeGreaterThan(0);
  });
});
