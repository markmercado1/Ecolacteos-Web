import { partesResaltadas } from './texto-resaltado';

describe('partesResaltadas', () => {
  it('resalta la primera coincidencia y conserva el texto original', () => {
    expect(partesResaltadas('Leche entera', 'lec')).toEqual([
      { texto: 'Lec', resaltada: true },
      { texto: 'he entera', resaltada: false }
    ]);
  });

  it('no distingue mayúsculas ni acentos y respeta cómo está escrito el original', () => {
    expect(partesResaltadas('Yogurt Lácteo', 'LACTEO')).toEqual([
      { texto: 'Yogurt ', resaltada: false },
      { texto: 'Lácteo', resaltada: true }
    ]);
    expect(partesResaltadas('Piña colada', 'pina')).toEqual([
      { texto: 'Piña', resaltada: true },
      { texto: ' colada', resaltada: false }
    ]);
  });

  it('resalta una coincidencia en medio y una que cubre todo el texto', () => {
    expect(partesResaltadas('Pan de leche', 'de')).toEqual([
      { texto: 'Pan ', resaltada: false },
      { texto: 'de', resaltada: true },
      { texto: ' leche', resaltada: false }
    ]);
    expect(partesResaltadas('Queso', 'queso')).toEqual([{ texto: 'Queso', resaltada: true }]);
  });

  it('sin término o sin coincidencia devuelve el texto entero sin resaltar', () => {
    expect(partesResaltadas('Queso', '')).toEqual([{ texto: 'Queso', resaltada: false }]);
    expect(partesResaltadas('Queso', '   ')).toEqual([{ texto: 'Queso', resaltada: false }]);
    expect(partesResaltadas('Queso', 'yogurt')).toEqual([{ texto: 'Queso', resaltada: false }]);
  });

  it('la coincidencia con espacios sobrantes en el término se recorta', () => {
    expect(partesResaltadas('Aceite vegetal', '  ace ')).toEqual([
      { texto: 'Ace', resaltada: true },
      { texto: 'ite vegetal', resaltada: false }
    ]);
  });
});
