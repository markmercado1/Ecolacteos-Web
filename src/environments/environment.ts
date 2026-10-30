// Build de producción del panel. La API se llama en el MISMO ORIGEN (/api): en Netlify, netlify.toml reenvía /api/* al
// backend (hoy un túnel de ngrok), así no hay CORS ni se escribe la URL del backend en el código. Si el backend queda en
// otro dominio, poner aquí su URL completa (p. ej. 'https://api.midominio.pe/api') y agregar el origen del panel a
// CORS_ALLOWED_ORIGINS del backend.
export const environment = {
  production: true,
  apiBaseUrl: '/api',
  /** Número de WhatsApp que se propone al enviar un comprobante la primera vez (FICTICIO: se cambia en el propio diálogo y se recuerda el último usado). */
  whatsappPorDefecto: '51900000000'
};
