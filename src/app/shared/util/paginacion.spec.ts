import { paginaCorregida, paramsDePagina, textoPie } from './paginacion';

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
