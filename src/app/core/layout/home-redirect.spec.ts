import { RolNombre } from '../../shared/models/rol';
import { rutaInicial } from './home-redirect';

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

  it('sin rol conocido usa el primer ítem del menú', () => {
    expect(rutaInicial(undefined)).toBe('/panel');
  });
});
