import { fechaHoraActualLima, fechaHoyLima, formatearFecha, formatearFechaHora } from './fecha';

describe('fecha (America/Lima)', () => {
  afterEach(() => vi.useRealTimers());

  it('fechaHoraActualLima usa la hora de Lima (UTC-5) y el formato de datetime-local', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T03:30:00Z'));
    expect(fechaHoraActualLima()).toBe('2026-10-21T22:30');
  });

  it('fechaHoyLima coincide con la fecha de fechaHoraActualLima', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T03:30:00Z'));
    expect(fechaHoraActualLima().slice(0, 10)).toBe(fechaHoyLima());
  });
});

describe('formatearFecha / formatearFechaHora', () => {
  it('reordena una fecha ISO a dd/MM/yyyy sin correrla un día', () => {
    expect(formatearFecha('2026-10-28')).toBe('28/10/2026');
    expect(formatearFecha('2026-01-01')).toBe('01/01/2026');
    expect(formatearFecha('2026-10-28T13:00:00')).toBe('28/10/2026');
  });

  it('un valor vacío muestra un guion y uno desconocido se deja como llegó', () => {
    expect(formatearFecha(null)).toBe('—');
    expect(formatearFecha('')).toBe('—');
    expect(formatearFecha('hoy')).toBe('hoy');
  });

  it('la fecha y hora sin zona se toman tal cual', () => {
    expect(formatearFechaHora('2026-08-31T13:00:00')).toBe('31/08/2026 13:00');
    expect(formatearFechaHora('2026-08-31 07:05')).toBe('31/08/2026 07:05');
  });

  it('con zona horaria se muestra en la hora de Lima (UTC-5)', () => {
    expect(formatearFechaHora('2026-10-22T03:30:00Z')).toBe('21/10/2026 22:30');
    expect(formatearFechaHora('2026-10-22T03:30:00-05:00')).toBe('22/10/2026 03:30');
  });

  it('sin hora equivale a formatearFecha', () => {
    expect(formatearFechaHora('2026-10-28')).toBe('28/10/2026');
    expect(formatearFechaHora(undefined)).toBe('—');
  });
});
