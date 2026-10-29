import { RolNombre } from '../../shared/models/rol';
import { rutaInicial } from './home-redirect';
import { GRUPOS_NAVEGACION } from './nav-items';

describe('rutaInicial — pantalla inicial por rol', () => {
  const esperadas: Record<RolNombre, string> = {
    ADMIN: '/panel',
    CALIDAD: '/calidad',
    RECEPCION: '/jornadas',
    PRODUCCION: '/produccion',
    VENTAS: '/ventas',
    ACOPIADOR: '/rutas'
  };

  for (const [rol, ruta] of Object.entries(esperadas)) {
    it(`${rol} entra a ${ruta}`, () => {
      expect(rutaInicial(rol as RolNombre)).toBe(ruta);
    });
  }

  it('VENTAS ya no cae en Inventario, que es el primer ítem del menú que ve', () => {
    expect(rutaInicial('VENTAS')).not.toBe('/inventario');
  });

  it('la pantalla inicial de cada rol es un módulo que ese rol puede abrir', () => {
    const items = GRUPOS_NAVEGACION.flatMap((g) => g.items);
    for (const rol of Object.keys(esperadas) as RolNombre[]) {
      const item = items.find((i) => i.ruta === rutaInicial(rol));
      expect(item, rol).toBeDefined();
      expect(item!.roles, rol).toContain(rol);
    }
  });

  it('sin rol conocido usa el primer ítem del menú', () => {
    expect(rutaInicial(undefined)).toBe('/panel');
  });
});
