import { signal } from '@angular/core';
import { ListaLocal, MS_RESALTADO_FILA } from './lista-local';

interface Fila {
  id: string;
  nombre: string;
  codigo?: string;
}

const filasDe = (n: number): Fila[] => Array.from({ length: n }, (_, i) => ({ id: `id-${i}`, nombre: `Zona ${String(i).padStart(2, '0')}` }));

function crear(filas: Fila[], tamano = 5) {
  const fuente = signal(filas);
  const lista = new ListaLocal(fuente, { campos: (f) => [f.nombre, f.codigo], id: (f) => f.id, tamano });
  return { fuente, lista };
}

describe('ListaLocal', () => {
  afterEach(() => vi.useRealTimers());

  it('pagina el conjunto completo y calcula totales', () => {
    const { lista } = crear(filasDe(12));
    expect(lista.totalElementos()).toBe(12);
    expect(lista.totalPaginas()).toBe(3);
    expect(lista.filas().map((f) => f.id)).toEqual(['id-0', 'id-1', 'id-2', 'id-3', 'id-4']);
    lista.irA(2);
    expect(lista.filas().map((f) => f.id)).toEqual(['id-10', 'id-11']);
  });

  it('irA ignora páginas fuera de rango', () => {
    const { lista } = crear(filasDe(12));
    lista.irA(9);
    lista.irA(-1);
    expect(lista.pagina()).toBe(0);
  });

  it('busca sobre TODO el conjunto (no solo la página visible), sin acentos ni mayúsculas, y vuelve a la página 0', () => {
    const { lista } = crear([...filasDe(12), { id: 'x', nombre: 'La Encañada' }]);
    lista.irA(2);
    lista.buscar('  ENCANADA ');
    expect(lista.pagina()).toBe(0);
    expect(lista.filas().map((f) => f.id)).toEqual(['x']);
    expect(lista.totalElementos()).toBe(1);
  });

  it('busca en todos los campos indicados y tolera campos vacíos', () => {
    const { lista } = crear([{ id: 'a', nombre: 'Uno', codigo: 'ABC-123' }, { id: 'b', nombre: 'Dos' }]);
    lista.buscar('abc');
    expect(lista.filas().map((f) => f.id)).toEqual(['a']);
  });

  it('limpiar la búsqueda devuelve todo', () => {
    const { lista } = crear(filasDe(12));
    lista.buscar('zona 03');
    expect(lista.totalElementos()).toBe(1);
    lista.buscar('');
    expect(lista.totalElementos()).toBe(12);
  });

  it('si la lista se reduce, la página efectiva nunca queda fuera de rango', () => {
    const { lista, fuente } = crear(filasDe(11));
    lista.irA(2); // 1 fila en la última página
    fuente.set(filasDe(5)); // ahora solo hay 1 página
    expect(lista.paginaActual()).toBe(0);
    expect(lista.filas()).toHaveLength(5);
  });

  it('cambiar el tamaño vuelve a la primera página', () => {
    const { lista } = crear(filasDe(30));
    lista.irA(2);
    lista.cambiarTamano(10);
    expect(lista.pagina()).toBe(0);
    expect(lista.totalPaginas()).toBe(3);
  });

  it('revelar lleva a la página de la fila y la resalta unos segundos', () => {
    vi.useFakeTimers();
    const { lista } = crear(filasDe(12));
    lista.revelar('id-7');
    expect(lista.pagina()).toBe(1);
    expect(lista.esResaltada(lista.filas().find((f) => f.id === 'id-7')!)).toBe(true);
    expect(lista.esResaltada(lista.filas().find((f) => f.id === 'id-6')!)).toBe(false);
    vi.advanceTimersByTime(MS_RESALTADO_FILA + 1);
    expect(lista.resaltadoId()).toBeNull();
  });

  it('revelar quita la búsqueda si estaba ocultando la fila', () => {
    vi.useFakeTimers();
    const { lista } = crear(filasDe(12));
    lista.buscar('zona 01');
    lista.revelar('id-9');
    expect(lista.busqueda()).toBe('');
    expect(lista.pagina()).toBe(1);
    expect(lista.resaltadoId()).toBe('id-9');
  });

  it('revelar una fila que no existe no cambia nada', () => {
    const { lista } = crear(filasDe(12));
    lista.irA(1);
    lista.revelar('no-existe');
    expect(lista.pagina()).toBe(1);
    expect(lista.resaltadoId()).toBeNull();
  });
});
