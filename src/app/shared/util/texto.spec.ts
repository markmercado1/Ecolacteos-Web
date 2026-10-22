import { contieneTexto, normalizarTexto } from './texto';

describe('normalizarTexto', () => {
  it('pasa a minúsculas y quita acentos y diéresis (la ñ cuenta como n, igual que en el servidor)', () => {
    expect(normalizarTexto('  HUAMÁN Peña  Pingüino ')).toBe('huaman pena  pinguino');
  });

  it('acepta null, undefined y vacío', () => {
    expect(normalizarTexto(null)).toBe('');
    expect(normalizarTexto(undefined)).toBe('');
    expect(normalizarTexto('')).toBe('');
  });
});

describe('contieneTexto', () => {
  it('encuentra en cualquier posición sin distinguir mayúsculas ni acentos', () => {
    expect(contieneTexto('Alejandro Terrones Huamán', 'huaman')).toBe(true);
    expect(contieneTexto('Alejandro Terrones Huamán', 'TERRO')).toBe(true);
    expect(contieneTexto('Niña', 'nina')).toBe(true);
    expect(contieneTexto('Huamán', 'ñ')).toBe(true); // la ñ se compara como n
    expect(contieneTexto('Huamán', 'z')).toBe(false);
  });

  it('un término vacío coincide con todo, y un texto vacío no coincide con un término', () => {
    expect(contieneTexto('algo', '   ')).toBe(true);
    expect(contieneTexto(null, 'a')).toBe(false);
  });
});
