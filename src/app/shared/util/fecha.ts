/** Fecha de hoy en la zona horaria de la planta (America/Lima), formato ISO yyyy-MM-dd. */
export function fechaHoyLima(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Fecha y hora actuales en la zona horaria de la planta (America/Lima), con el formato de <input type="datetime-local">: yyyy-MM-ddTHH:mm. */
export function fechaHoraActualLima(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}T${valor('hour')}:${valor('minute')}`;
}

/**
 * Fecha para mostrar al usuario: dd/MM/yyyy. Recibe el texto ISO que entrega la API (yyyy-MM-dd, con o sin hora) y lo
 * reordena sin pasar por `Date`, así una fecha sin hora nunca se corre un día por la zona horaria. Un valor vacío o con
 * otro formato se devuelve tal cual (o «—» si no hay nada), para no ocultar un dato inesperado.
 */
export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/**
 * Fecha y hora para mostrar: dd/MM/yyyy HH:mm. Si el texto trae zona horaria (Z o ±hh:mm) se muestra en la hora de la
 * planta (America/Lima); si no la trae, se toma tal cual. Sin hora, equivale a `formatearFecha`.
 */
export function formatearFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  if (!m) return formatearFecha(iso);
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(iso));
    const v = (t: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === t)?.value;
    return `${v('day')}/${v('month')}/${v('year')} ${v('hour')}:${v('minute')}`;
  }
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}
