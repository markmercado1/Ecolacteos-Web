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
