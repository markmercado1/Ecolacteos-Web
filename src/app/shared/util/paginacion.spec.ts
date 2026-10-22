import { paginaCorregida, paramsDePagina, rangoMostrado, textoPie, ventanaPaginas } from './paginacion';

describe('paginacion util', () => {
  const pagina = (contenido: number[], paginaActual: number, totalPaginas: number, totalElementos: number) => ({
    contenido,
    paginaActual,
    tamanoPagina: 20,
    totalElementos,
    totalPaginas
  });

  it('paramsDePagina pone page y size', () => {
    const params = paramsDePagina({ page: 3, size: 20 });
    expect(params.get('page')).toBe('3');
    expect(params.get('size')).toBe('20');
  });

  it('paginaCorregida devuelve la última página válida si la pedida quedó fuera de rango', () => {
    expect(paginaCorregida(pagina([], 4, 3, 41))).toBe(2);
  });

  it('paginaCorregida devuelve null para una página válida o para un resultado vacío en la página 0', () => {
    expect(paginaCorregida(pagina([1], 2, 3, 41))).toBeNull();
    expect(paginaCorregida(pagina([], 0, 0, 0))).toBeNull();
  });

  it('paginaCorregida vuelve a la página 0 si ya no queda ningún resultado', () => {
    expect(paginaCorregida(pagina([], 2, 0, 0))).toBe(0);
  });

  it('textoPie muestra al menos "de 1" aunque no haya páginas', () => {
    expect(textoPie(0, 0, 0, 'pagos')).toBe('Página 1 de 1 · 0 pagos');
    expect(textoPie(1, 5, 87, 'pagos')).toBe('Página 2 de 5 · 87 pagos');
  });
});


describe('rangoMostrado', () => {
  it('21–40 de 87 en la segunda página de 20', () => {
    expect(rangoMostrado(1, 20, 87)).toEqual({ desde: 21, hasta: 40 });
  });

  it('la última página se corta en el total', () => {
    expect(rangoMostrado(4, 20, 87)).toEqual({ desde: 81, hasta: 87 });
  });

  it('sin resultados no hay rango', () => {
    expect(rangoMostrado(0, 20, 0)).toEqual({ desde: 0, hasta: 0 });
  });
});

describe('ventanaPaginas', () => {
  it('con pocas páginas muestra todas', () => {
    expect(ventanaPaginas(0, 1)).toEqual([0]);
    expect(ventanaPaginas(2, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(ventanaPaginas(3, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('sin páginas no devuelve nada', () => {
    expect(ventanaPaginas(0, 0)).toEqual([]);
  });

  it('en el medio deja la primera, la última, la actual con sus vecinas y saltos', () => {
    expect(ventanaPaginas(5, 12)).toEqual([0, null, 4, 5, 6, null, 11]);
  });

  it('cerca del inicio y del final no deja saltos de una sola página', () => {
    expect(ventanaPaginas(0, 12)).toEqual([0, 1, null, 11]);
    expect(ventanaPaginas(3, 12)).toEqual([0, 1, 2, 3, 4, null, 11]); // 1 no se reemplaza por «…»
    expect(ventanaPaginas(8, 12)).toEqual([0, null, 7, 8, 9, 10, 11]);
    expect(ventanaPaginas(11, 12)).toEqual([0, null, 10, 11]);
  });

  it('una página fuera de rango se acota', () => {
    expect(ventanaPaginas(99, 12)).toEqual([0, null, 10, 11]);
  });
});
