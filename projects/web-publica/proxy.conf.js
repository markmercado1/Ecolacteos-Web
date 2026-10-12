/**
 * Proxy de desarrollo: redirige /api al backend (por defecto http://localhost:8080).
 *
 * Quita la cabecera Origin de lo que llega al backend. El navegador la envía en los POST aunque sean del mismo origen
 * (http://localhost:4300) y el backend solo acepta los orígenes de CORS_ALLOWED_ORIGINS (por defecto http://localhost:4200), así
 * que respondería 403. Sin Origin, para el backend es una petición normal, igual que lo sería detrás de un proxy inverso.
 */
module.exports = {
  '/api': {
    target: 'http://localhost:8080',
    secure: false,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
    }
  }
};
