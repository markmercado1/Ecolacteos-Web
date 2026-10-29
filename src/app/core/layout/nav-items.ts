import { RolNombre } from '../../shared/models/rol';
import { NombreIcono } from '../../shared/ui/icon/icon';

export interface ItemNavegacion {
  ruta: string;
  etiqueta: string;
  icono: NombreIcono;
  roles: RolNombre[];
}

export interface GrupoNavegacion {
  /** Clave estable de la sección (la usa Shell para saber cuál está abierta). */
  id: string;
  titulo: string;
  icono: NombreIcono;
  items: ItemNavegacion[];
}

/**
 * Roles tomados de docs/ENDPOINTS.md (@PreAuthorize real de cada controlador),
 * no de una suposición de producto. Ver docs/REGISTRO.md para el detalle. nav-items.spec.ts comprueba que cada ítem
 * tenga exactamente los mismos roles que su ruta en app.routes.ts: reagrupar no cambia quién puede entrar a qué.
 *
 * Secciones (reagrupación UX 5): el trabajo diario va primero y la configuración de uso poco frecuente (precios,
 * impuestos, catálogos, usuarios, flota) queda reunida en «Configuración», solo para ADMIN. Shell.grupos() filtra por
 * rol y oculta las secciones vacías, así que ningún rol ve secciones en blanco.
 *
 * Secciones desplegables: cada grupo es un acordeón en Shell y solo queda abierta la de la página actual. Un grupo
 * con un solo ítem visible para el rol se muestra como enlace directo (sin desplegable). «Visión general» queda como
 * enlace directo al panel.
 *
 * "Supervisión" se eliminó: apuntaba a PendingFeaturePage (sin implementar), no era una función real.
 */
export const GRUPOS_NAVEGACION: GrupoNavegacion[] = [
  {
    id: 'vision',
    titulo: 'Visión general',
    icono: 'panel',
    items: [{ ruta: '/panel', etiqueta: 'Panel económico', icono: 'panel', roles: ['ADMIN'] }]
  },
  {
    id: 'acopio',
    titulo: 'Acopio y calidad',
    icono: 'acopios',
    items: [
      { ruta: '/acopios', etiqueta: 'Acopios', icono: 'acopios', roles: ['ADMIN'] },
      { ruta: '/calidad', etiqueta: 'Calidad', icono: 'calidad', roles: ['ADMIN', 'CALIDAD'] },
      { ruta: '/jornadas', etiqueta: 'Jornadas', icono: 'jornadas', roles: ['ADMIN', 'RECEPCION'] },
      { ruta: '/recepcion', etiqueta: 'Recepción', icono: 'recepcion', roles: ['ADMIN', 'RECEPCION'] },
      { ruta: '/rutas', etiqueta: 'Rutas', icono: 'rutas', roles: ['ADMIN', 'ACOPIADOR'] }
    ]
  },
  {
    id: 'produccion',
    titulo: 'Producción',
    icono: 'produccion',
    items: [
      { ruta: '/produccion', etiqueta: 'Producción', icono: 'produccion', roles: ['ADMIN', 'PRODUCCION'] },
      { ruta: '/inventario', etiqueta: 'Inventario', icono: 'inventario', roles: ['ADMIN', 'PRODUCCION', 'VENTAS'] }
    ]
  },
  {
    id: 'ventas',
    titulo: 'Ventas',
    icono: 'ventas',
    items: [
      { ruta: '/ventas', etiqueta: 'Ventas', icono: 'ventas', roles: ['ADMIN', 'VENTAS'] },
      { ruta: '/reservas', etiqueta: 'Reservas', icono: 'reservas', roles: ['ADMIN', 'VENTAS'] },
      { ruta: '/clientes', etiqueta: 'Clientes', icono: 'usuarios', roles: ['ADMIN', 'VENTAS'] }
    ]
  },
  {
    id: 'proveedores',
    titulo: 'Proveedores y pagos',
    icono: 'proveedores',
    items: [
      { ruta: '/proveedores', etiqueta: 'Proveedores', icono: 'proveedores', roles: ['ADMIN'] },
      { ruta: '/proveedores-compra', etiqueta: 'Proveedores de compra', icono: 'proveedores', roles: ['ADMIN'] },
      { ruta: '/pagos', etiqueta: 'Liquidaciones de leche', icono: 'pagos', roles: ['ADMIN', 'RECEPCION'] },
      { ruta: '/pagos-efectivos', etiqueta: 'Desembolsos a proveedores', icono: 'pagos', roles: ['ADMIN', 'RECEPCION'] },
      { ruta: '/comunicados', etiqueta: 'Comunicados', icono: 'comunicados', roles: ['ADMIN'] }
    ]
  },
  {
    id: 'configuracion',
    titulo: 'Configuración',
    icono: 'catalogos',
    items: [
      { ruta: '/precios', etiqueta: 'Precios', icono: 'precios', roles: ['ADMIN'] },
      { ruta: '/tipos-precio', etiqueta: 'Tipos de precio', icono: 'precios', roles: ['ADMIN'] },
      { ruta: '/igv', etiqueta: 'IGV de las ventas', icono: 'precios', roles: ['ADMIN'] },
      { ruta: '/catalogos', etiqueta: 'Catálogos', icono: 'catalogos', roles: ['ADMIN'] },
      { ruta: '/usuarios', etiqueta: 'Usuarios', icono: 'usuarios', roles: ['ADMIN'] },
      { ruta: '/acopiadores', etiqueta: 'Acopiadores', icono: 'acopiadores', roles: ['ADMIN'] },
      { ruta: '/unidades', etiqueta: 'Unidades', icono: 'unidades', roles: ['ADMIN'] }
    ]
  }
];
