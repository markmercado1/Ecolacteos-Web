import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';
import { roleGuard } from './core/auth/role.guard';
import { HomeRedirect } from './core/layout/home-redirect';
import { Shell } from './core/layout/shell';
import { ForbiddenPage } from './shared/ui/pages/forbidden-page';
import { NotFoundPage } from './shared/ui/pages/not-found-page';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/pages/login-page/login-page').then((m) => m.LoginPage)
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', component: HomeRedirect },
      {
        path: 'acopios', canActivate: [roleGuard], data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/acopios/acopios-page').then(m => m.AcopiosPage)
      },
      {
        path: 'calidad', canActivate: [roleGuard], data: { roles: ['ADMIN', 'CALIDAD'] },
        loadComponent: () => import('./features/calidad/pages/calidad-page/calidad-page').then(m => m.CalidadPage)
      },
      {
        path: 'jornadas', canActivate: [roleGuard], data: { roles: ['ADMIN', 'RECEPCION'] },
        loadComponent: () => import('./features/jornadas/pages/jornadas-page/jornadas-page').then(m => m.JornadasPage)
      },
      {
        path: 'recepcion', canActivate: [roleGuard], data: { roles: ['ADMIN', 'RECEPCION'] },
        loadComponent: () => import('./features/recepcion/pages/recepcion-page/recepcion-page').then(m => m.RecepcionPage)
      },
      {
        path: 'produccion', canActivate: [roleGuard], data: { roles: ['ADMIN', 'PRODUCCION'] },
        loadComponent: () => import('./features/produccion/pages/lotes-page/lotes-page').then(m => m.LotesPage)
      },
      { path: '403', component: ForbiddenPage },
      {
        path: 'panel', canActivate: [roleGuard], data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/panel/pages/panel-page/panel-page').then((m) => m.PanelPage)
      },
      {
        path: 'proveedores',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () =>
          import('./features/proveedores/pages/proveedores-page/proveedores-page').then((m) => m.ProveedoresPage)
      },
      {
        path: 'pagos',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RECEPCION'] },
        loadComponent: () => import('./features/pagos/pages/pagos-page/pagos-page').then((m) => m.PagosPage)
      },
      {
        path: 'pagos-efectivos',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RECEPCION'] },
        loadComponent: () =>
          import('./features/pagos-efectivos/pages/pagos-efectivos-page/pagos-efectivos-page').then((m) => m.PagosEfectivosPage)
      },
      {
        path: 'rutas',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'ACOPIADOR'] },
        loadComponent: () => import('./features/rutas/pages/rutas-page/rutas-page').then((m) => m.RutasPage)
      },
      {
        path: 'comunicados',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () =>
          import('./features/comunicados/pages/comunicados-page/comunicados-page').then((m) => m.ComunicadosPage)
      },
      {
        path: 'ventas',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'VENTAS'] },
        loadComponent: () => import('./features/ventas/pages/ventas-page/ventas-page').then((m) => m.VentasPage)
      },
      {
        path: 'clientes',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'VENTAS'] },
        loadComponent: () => import('./features/clientes/pages/clientes-page/clientes-page').then((m) => m.ClientesPage)
      },
      {
        path: 'reservas',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'VENTAS'] },
        loadComponent: () => import('./features/reservas/pages/reservas-page/reservas-page').then((m) => m.ReservasPage)
      },
      {
        path: 'usuarios',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/usuarios/pages/usuarios-page/usuarios-page').then((m) => m.UsuariosPage)
      },
      {
        path: 'acopiadores',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () =>
          import('./features/acopiadores/pages/acopiadores-page/acopiadores-page').then((m) => m.AcopiadoresPage)
      },
      {
        path: 'unidades',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/unidades/pages/unidades-page/unidades-page').then((m) => m.UnidadesPage)
      },
      {
        path: 'catalogos',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/catalogos/pages/catalogos-page/catalogos-page').then((m) => m.CatalogosPage)
      },
      {
        path: 'igv',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/tributario/pages/igv-page/igv-page').then((m) => m.IgvPage)
      },
      {
        path: 'precios',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/precios/pages/precios-page/precios-page').then((m) => m.PreciosPage)
      },
      {
        path: 'inventario',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'PRODUCCION', 'VENTAS'] },
        loadComponent: () => import('./features/inventario/pages/inventario-page/inventario-page').then((m) => m.InventarioPage)
      }
    ]
  },
  { path: '**', component: NotFoundPage }
];
