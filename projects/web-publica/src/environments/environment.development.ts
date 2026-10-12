/**
 * Desarrollo: `ng serve web-publica` redirige /api al backend con projects/web-publica/proxy.conf.json
 * (http://localhost:8080 por defecto), así que no hace falta CORS y apiOrigin queda vacío.
 */
export const environment = {
  production: false,
  apiOrigin: ''
};
