import { fechaHoraActualLima, fechaHoyLima } from './fecha';

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
