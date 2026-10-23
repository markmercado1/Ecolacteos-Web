import { DisponibilidadProduccion, LineaDisponibilidad } from '../../catalogos/data-access/receta.models';

const aCentesimas = (valor: number): number => Math.round(valor * 100);

/**
 * Suma las necesidades (leche e insumos) que el servidor calculó para cada receta de una producción con varias recetas.
 *
 * Las necesidades se suman en centésimas. El stock NO se suma: todas las recetas consumen del mismo inventario, así que
 * para cada insumo se toma el menor disponible observado. Las unidades no se convierten (un mismo insumo siempre llega
 * en su unidad de catálogo). No es una reserva: el servidor vuelve a validar y descontar al iniciar cada lote.
 */
export function sumarDisponibilidad(calculos: DisponibilidadProduccion[]): DisponibilidadProduccion {
  const lineas = new Map<string, LineaDisponibilidad>();

  for (const calculo of calculos) {
    for (const linea of [calculo.leche, ...calculo.insumos]) {
      const clave = linea.insumoId ?? 'leche';
      const previa = lineas.get(clave);
      const requerido = (aCentesimas(previa?.requerido ?? 0) + aCentesimas(linea.requerido)) / 100;
      const disponible = Math.min(previa?.disponible ?? linea.disponible, linea.disponible);
      lineas.set(clave, {
        ...linea,
        requerido,
        disponible,
        suficiente: requerido <= disponible,
        faltante: Math.max(0, aCentesimas(requerido - disponible) / 100)
      });
    }
  }

  const leche = lineas.get('leche')!;
  const todas = [...lineas.values()];
  return {
    leche,
    insumos: todas.filter((linea) => linea.insumoId !== null),
    litrosSolicitados: leche.requerido,
    factor: null,
    cantidadEsperada: null,
    presentacionNombre: null,
    unidadConteo: null,
    litrosMaximos: null,
    cantidadEsperadaMaxima: null,
    todoDisponible: todas.every((linea) => linea.suficiente) && calculos.every((calculo) => calculo.todoDisponible)
  };
}
