import { Route } from '@angular/router';
import { roleGuard } from './core/auth/role.guard';
import { routes } from './app.routes';

function buscar(rutas: Route[], path: string): Route | undefined {
  for (const r of rutas) {
    if (r.path === path) return r;
    const hija = r.children ? buscar(r.children, path) : undefined;
    if (hija) return hija;
  }
  return undefined;
}

describe('rutas', () => {
  it('«Revisión de zonas» es solo para ADMIN y pasa por el guard de roles', () => {
    const ruta = buscar(routes, 'zonas-revision');
    expect(ruta).toBeDefined();
    expect(ruta!.canActivate).toContain(roleGuard);
    expect(ruta!.data?.['roles']).toEqual(['ADMIN']);
  });

  it('«Revisión de documentos» es solo para ADMIN y pasa por el guard de roles', () => {
    const ruta = buscar(routes, 'proveedores-revision');
    expect(ruta).toBeDefined();
    expect(ruta!.canActivate).toContain(roleGuard);
    expect(ruta!.data?.['roles']).toEqual(['ADMIN']);
  });

  it('«IGV de las ventas» es solo para ADMIN y pasa por el guard de roles', () => {
    const ruta = buscar(routes, 'igv');
    expect(ruta).toBeDefined();
    expect(ruta!.canActivate).toContain(roleGuard);
    expect(ruta!.data?.['roles']).toEqual(['ADMIN']);
  });

  it('«Clientes» es para ADMIN y VENTAS y pasa por el guard de roles', () => {
    const ruta = buscar(routes, 'clientes');
    expect(ruta).toBeDefined();
    expect(ruta!.canActivate).toContain(roleGuard);
    expect(ruta!.data?.['roles']).toEqual(['ADMIN', 'VENTAS']);
  });

  it('«Pagos a proveedores» es solo para ADMIN y RECEPCION y pasa por el guard de roles', () => {
    const ruta = buscar(routes, 'pagos-efectivos');
    expect(ruta).toBeDefined();
    expect(ruta!.canActivate).toContain(roleGuard);
    expect(ruta!.data?.['roles']).toEqual(['ADMIN', 'RECEPCION']);
  });
});
