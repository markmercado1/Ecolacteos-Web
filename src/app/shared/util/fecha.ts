/** Fecha de hoy en la zona horaria de la planta (America/Lima), formato ISO yyyy-MM-dd. */
export function fechaHoyLima(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
