// Desarrollo local. La URL real del backend canónico (ver README.md) todavía
// no fue proporcionada; este valor es un marcador de puerto convencional de
// Spring Boot y debe confirmarse contra el entorno real antes de integrar.
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080/api',
  /** Número de WhatsApp que se propone al enviar un comprobante la primera vez (FICTICIO: se cambia en el propio diálogo y se recuerda el último usado). */
  whatsappPorDefecto: '51900000000'
};
