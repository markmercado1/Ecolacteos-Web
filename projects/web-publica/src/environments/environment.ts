/**
 * Producción. `apiOrigin` es el ORIGEN del backend (sin /api ni barra final). Vacío = el mismo origen que sirve esta web
 * (un proxy inverso que reenvíe /api al backend). Para un backend en otro dominio, escribe su origen (por ejemplo
 * "https://api.midominio.pe") y agrega el origen de esta web a CORS_ALLOWED_ORIGINS del backend.
 * Aquí NUNCA van credenciales ni claves: la web pública no las usa.
 */
export const environment = {
  production: true,
  apiOrigin: ''
};
