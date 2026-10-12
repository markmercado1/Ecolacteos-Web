import { PresentacionResponse } from '../../catalogos/data-access/producto.models';
import { revisarProduccion } from './revision-produccion';

const botella: PresentacionResponse = {
  id: '1', productoId: 'p', nombre: 'Botella', contenidoCantidad: 500,
  contenidoUnidad: 'ML', unidadConteo: 'botella', activo: true
};

describe('revisarProduccion', () => {
  it('suma tamaños de la misma dimensión y compara con límites inclusivos', () => {
    const litro = { ...botella, id: '2', contenidoCantidad: 1, contenidoUnidad: 'L' as const };
    const revision = revisarProduccion(100, [
      { presentacionId: '1', cantidadObtenida: 100 }, { presentacionId: '2', cantidadObtenida: 50 }
    ], [botella, litro], { minimo: 90, maximo: 100, unidad: 'L' });
    expect(revision.totales).toEqual([{ cantidad: 100, unidad: 'L' }]);
    expect(revision.fueraDeRango).toBe(false);
  });

  it('advierte sobre mil piezas con cien litros cuando existe un rango configurado', () => {
    const revision = revisarProduccion(100, [{ presentacionId: '1', cantidadObtenida: 1000 }],
      [botella], { minimo: 10, maximo: 20, unidad: 'UNIDAD' });
    expect(revision.fueraDeRango).toBe(true);
    expect(revision.rendimiento).toBe(1000);
  });

  it('no compara kilos con litros ni sustituye contenido ausente por cero', () => {
    const detalles = [{ presentacionId: '1', cantidadObtenida: 2 }];
    expect(revisarProduccion(10, detalles, [botella], { minimo: 1, maximo: 2, unidad: 'KG' }).error).toBeTruthy();
    const sinContenido = { ...botella, contenidoCantidad: null, contenidoUnidad: null };
    const revision = revisarProduccion(10, detalles, [sinContenido], null);
    expect(revision.totales).toEqual([]);
    expect(revision.sinContenido).toBe(true);
    expect(revision.rendimiento).toBeNull();
  });

  it('rechaza duplicados, presentaciones ajenas y cantidades fraccionarias', () => {
    const detalle = { presentacionId: '1', cantidadObtenida: 1 };
    expect(revisarProduccion(1, [detalle, detalle], [botella], null).error).toBeTruthy();
    expect(revisarProduccion(1, [detalle], [], null).error).toBeTruthy();
    expect(revisarProduccion(1, [{ ...detalle, cantidadObtenida: 1.5 }], [botella], null).error).toBeTruthy();
  });

  it('evalúa la ausencia explícita de salidas como rendimiento cero', () => {
    expect(revisarProduccion(100, [], [], { minimo: 1, maximo: 2, unidad: 'KG' }).fueraDeRango).toBe(true);
  });
});
