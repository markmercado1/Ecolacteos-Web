import {
  PresentacionResponse,
  RangoRendimiento
} from '../../catalogos/data-access/producto.models';
import { DetalleSalidaRequest } from '../data-access/lote-produccion.models';

export interface TotalContenido {
  unidad: 'KG' | 'L';
  cantidad: number;
}

export interface RevisionProduccion {
  totales: TotalContenido[];
  sinContenido: boolean;
  rendimiento: number | null;
  fueraDeRango: boolean;
  error: string | null;
}

/** Convierte únicamente medidas de la misma dimensión. La leche consumida no es el volumen de salida. */
export function revisarProduccion(
  litros: number,
  detalles: DetalleSalidaRequest[],
  presentaciones: PresentacionResponse[],
  rango: RangoRendimiento | null | undefined
): RevisionProduccion {
  const cantidades = new Map<'KG' | 'L', number>();
  const ids = new Set<string>();
  let sinContenido = false;
  let error: string | null = null;

  for (const detalle of detalles) {
    const presentacion = presentaciones.find((p) => p.id === detalle.presentacionId && p.activo);
    if (!presentacion || ids.has(detalle.presentacionId)) {
      error = 'Selecciona presentaciones activas del producto, sin repetirlas.';
      break;
    }
    ids.add(detalle.presentacionId);
    if (
      !Number.isInteger(detalle.cantidadObtenida) ||
      detalle.cantidadObtenida < 1 ||
      detalle.cantidadObtenida > 2147483647
    ) {
      error = 'Cada cantidad debe ser un número entero entre 1 y 2.147.483.647.';
      break;
    }
    const { contenidoCantidad, contenidoUnidad } = presentacion;
    if (contenidoCantidad === null || contenidoUnidad === null) {
      sinContenido = true;
      continue;
    }
    const unidad = contenidoUnidad === 'G' || contenidoUnidad === 'KG' ? 'KG' : 'L';
    const factor = contenidoUnidad === 'G' || contenidoUnidad === 'ML' ? 0.001 : 1;
    cantidades.set(
      unidad,
      (cantidades.get(unidad) ?? 0) + contenidoCantidad * factor * detalle.cantidadObtenida
    );
  }

  let rendimiento: number | null = null;
  let fueraDeRango = false;
  if (!error && rango && litros > 0) {
    if (rango.unidad === 'UNIDAD' && detalles.length > 1) {
      error =
        'Un rango en unidades requiere una sola presentación. Configura kg o L para combinar tamaños.';
    } else if (
      rango.unidad !== 'UNIDAD' &&
      (sinContenido || [...cantidades.keys()].some((unidad) => unidad !== rango.unidad))
    ) {
      error = `Las presentaciones necesitan contenido compatible con el rango en ${rango.unidad}. Revisa el catálogo.`;
    } else {
      const salida =
        rango.unidad === 'UNIDAD'
          ? (detalles[0]?.cantidadObtenida ?? 0)
          : (cantidades.get(rango.unidad) ?? 0);
      rendimiento = (salida * 100) / litros;
      // Tolerancia de representación numérica; el servidor confirma con aritmética decimal exacta.
      const tolerancia = 1e-9 * Math.max(1, rendimiento, rango.maximo);
      fueraDeRango =
        rendimiento < rango.minimo - tolerancia || rendimiento > rango.maximo + tolerancia;
    }
  }

  return {
    totales: [...cantidades].map(([unidad, cantidad]) => ({ unidad, cantidad })),
    sinContenido,
    rendimiento,
    fueraDeRango,
    error
  };
}
