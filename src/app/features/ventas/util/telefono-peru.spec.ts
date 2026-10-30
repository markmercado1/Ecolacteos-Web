import { formatearTelefonoPeru, normalizarTelefonoPeru } from './telefono-peru';

describe('normalizarTelefonoPeru', () => {
  it('acepta nueve dígitos, con prefijo 51 o +51, y separadores', () => {
    for (const valor of ['900000000', '51900000000', '+51900000000', '+51 900 000 000', '(900) 000-000', ' 900 000 000 ']) {
      expect(normalizarTelefonoPeru(valor)).toBe('51900000000');
    }
  });

  it('rechaza lo que no es un móvil peruano', () => {
    for (const valor of ['', '   ', null, undefined, '800000000', '90000000', '9000000000', '5290000000', '+34900000000', 'abc', '51 800 000 000']) {
      expect(normalizarTelefonoPeru(valor)).toBeNull();
    }
  });
});

describe('formatearTelefonoPeru', () => {
  it('agrupa el número para mostrarlo y deja intacto lo que no reconoce', () => {
    expect(formatearTelefonoPeru('51987654321')).toBe('+51 987 654 321');
    expect(formatearTelefonoPeru('123')).toBe('123');
  });
});
