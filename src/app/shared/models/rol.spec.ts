import { ETIQUETAS_ROL, RolNombre, etiquetaRol } from './rol';

describe('etiquetaRol', () => {
  it('muestra cada rol con un nombre legible', () => {
    expect(etiquetaRol('ADMIN')).toBe('Administrador');
    expect(etiquetaRol('RECEPCION')).toBe('Recepción');
    expect(etiquetaRol('PRODUCCION')).toBe('Producción');
  });

  it('todos los roles del sistema tienen etiqueta y ninguna conserva el nombre técnico en mayúsculas', () => {
    const roles: RolNombre[] = ['ADMIN', 'ACOPIADOR', 'CALIDAD', 'RECEPCION', 'PRODUCCION', 'VENTAS'];
    for (const rol of roles) {
      expect(ETIQUETAS_ROL[rol], rol).toBeTruthy();
      expect(etiquetaRol(rol), rol).not.toBe(rol);
    }
  });

  it('un rol desconocido se muestra tal cual y la ausencia de rol como un guion', () => {
    expect(etiquetaRol('SUPERVISOR')).toBe('SUPERVISOR');
    expect(etiquetaRol(undefined)).toBe('—');
    expect(etiquetaRol(null)).toBe('—');
  });
});
