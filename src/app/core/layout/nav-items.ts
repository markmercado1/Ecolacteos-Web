import { RolNombre } from '../../shared/models/rol';
import { NombreIcono } from '../../shared/ui/icon/icon';

export interface ItemNavegacion {
  ruta: string;
  etiqueta: string;
  icono: NombreIcono;
  roles: RolNombre[];
}

export interface GrupoNavegacion {
  /** Clave estable: se usa para recordar qué secciones dejó abiertas el usuario. */
  id: string;
  titulo: string;
  icono: NombreIcono;
  items: ItemNavegacion[];
}

/**
 * Roles tomados de docs/ENDPOINTS.md (@PreAuthorize real de cada controlador),
 * no de una suposición de producto. Ver docs/REGISTRO.md para el detalle.
 *
 * Secciones (rediseño de navegación): antes "Operación" era una sola lista de 12 items sin dividir; se
 * partió en subgrupos temáticos para que sea escaneable. Shell.grupos() ya filtra por rol y oculta
 * secciones vacías, así que dividir en más grupos no muestra secciones en blanco a ningún usuario.
 *
 * "Supervisión" se eliminó: apuntaba a PendingFeaturePage (sin implementar), no era una función real.
 *
 * Secciones desplegables (2026-10-02): cada grupo es un acordeón en Shell. Un grupo con un solo ítem visible
 * para el rol se muestra como enlace directo (sin desplegable). "Precios" se movió a Comercial (son precios
 * de venta) y "Visión general" queda como enlace directo al panel.
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
      { ruta: '/recepcion', etiqueta: 'Recepción', icono: 'recepcion', roles: ['ADMIN', 'RECEPCION'] }
    ]
  },
  {
    id: 'produccion',
    titulo: 'Producción',
    icono: 'produccion',
    items: [
      { ruta: '/produccion', etiqueta: 'Producción', icono: 'produccion', roles: ['ADMIN', 'PRODUCCION'] },
      { ruta: '/produccion-diaria', etiqueta: 'Producción diaria', icono: 'produccion-diaria', roles: ['ADMIN', 'PRODUCCION'] },
      { ruta: '/inventario', etiqueta: 'Inventario', icono: 'inventario', roles: ['ADMIN', 'PRODUCCION', 'VENTAS'] }
    ]
  },
  {
    id: 'comercial',
    titulo: 'Comercial',
    icono: 'ventas',
    items: [
      { ruta: '/ventas', etiqueta: 'Ventas', icono: 'ventas', roles: ['ADMIN', 'VENTAS'] },
      { ruta: '/reservas', etiqueta: 'Reservas', icono: 'reservas', roles: ['ADMIN', 'VENTAS'] },
      { ruta: '/precios', etiqueta: 'Precios', icono: 'precios', roles: ['ADMIN'] },
      { ruta: '/igv', etiqueta: 'IGV de las ventas', icono: 'precios', roles: ['ADMIN'] }
    ]
  },
  {
    id: 'proveedores',
    titulo: 'Proveedores y logística',
    icono: 'proveedores',
    items: [
      { ruta: '/proveedores', etiqueta: 'Proveedores', icono: 'proveedores', roles: ['ADMIN'] },
      { ruta: '/proveedores-revision', etiqueta: 'Revisión de documentos', icono: 'alerta', roles: ['ADMIN'] },
      { ruta: '/zonas-revision', etiqueta: 'Revisión de zonas', icono: 'alerta', roles: ['ADMIN'] },
      { ruta: '/pagos', etiqueta: 'Pagos', icono: 'pagos', roles: ['ADMIN', 'RECEPCION'] },
      { ruta: '/pagos-efectivos', etiqueta: 'Pagos a proveedores', icono: 'pagos', roles: ['ADMIN', 'RECEPCION'] },
      { ruta: '/rutas', etiqueta: 'Rutas', icono: 'rutas', roles: ['ADMIN', 'ACOPIADOR'] },
      { ruta: '/comunicados', etiqueta: 'Comunicados', icono: 'comunicados', roles: ['ADMIN'] }
    ]
  },
  {
    id: 'administracion',
    titulo: 'Administración',
    icono: 'usuarios',
    items: [
      { ruta: '/usuarios', etiqueta: 'Usuarios', icono: 'usuarios', roles: ['ADMIN'] },
      { ruta: '/acopiadores', etiqueta: 'Acopiadores', icono: 'acopiadores', roles: ['ADMIN'] },
      { ruta: '/unidades', etiqueta: 'Unidades', icono: 'unidades', roles: ['ADMIN'] },
      { ruta: '/catalogos', etiqueta: 'Catálogos', icono: 'catalogos', roles: ['ADMIN'] }
    ]
  }
];
