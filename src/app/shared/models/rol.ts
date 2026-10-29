/** Roles reales del backend (ver docs/CONTRATOS.md, UsuarioRequest.java). */
export type RolNombre =
  | 'ADMIN'
  | 'ACOPIADOR'
  | 'CALIDAD'
  | 'RECEPCION'
  | 'PRODUCCION'
  | 'VENTAS';

/** Nombre con el que se muestra cada rol al usuario; el valor técnico (ADMIN, RECEPCION…) solo viaja a la API. */
export const ETIQUETAS_ROL: Record<RolNombre, string> = {
  ADMIN: 'Administrador',
  ACOPIADOR: 'Acopiador',
  CALIDAD: 'Calidad',
  RECEPCION: 'Recepción',
  PRODUCCION: 'Producción',
  VENTAS: 'Ventas'
};

/** Etiqueta legible de un rol; un rol desconocido se muestra tal cual y la ausencia de rol como «—». */
export function etiquetaRol(rol: string | null | undefined): string {
  if (!rol) return '—';
  return (ETIQUETAS_ROL as Record<string, string>)[rol] ?? rol;
}
