/**
 * Móvil peruano para WhatsApp: acepta 9 dígitos que empiezan con 9, o el mismo número con prefijo 51 o +51, con espacios, guiones o paréntesis.
 * Devuelve el número internacional sin «+» (519XXXXXXXX, lo que pide wa.me) o null si no es un móvil peruano válido. Misma regla que el
 * backend (TelefonoPeru.java), que guarda +519XXXXXXXX.
 */
export function normalizarTelefonoPeru(crudo: string | null | undefined): string | null {
  if (!crudo) return null;
  let limpio = crudo.replace(/[\s\-() ]/g, '');
  if (limpio.startsWith('+51')) limpio = limpio.slice(3);
  else if (limpio.startsWith('51') && limpio.length === 11) limpio = limpio.slice(2);
  return /^9\d{8}$/.test(limpio) ? `51${limpio}` : null;
}

/** «+51 900 000 000» para mostrar un número ya normalizado. */
export function formatearTelefonoPeru(normalizado: string): string {
  const m = /^51(9\d{2})(\d{3})(\d{3})$/.exec(normalizado);
  return m ? `+51 ${m[1]} ${m[2]} ${m[3]}` : normalizado;
}
