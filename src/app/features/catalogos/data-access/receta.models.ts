/**
 * Fuente: backend dto/RecetaRequest.java, RecetaResponse.java, DisponibilidadProduccionResponse.java (V18).
 * Una receta fabrica UN producto (salida en UNA de sus presentaciones) a partir de `litrosBase` de leche.
 * La leche no es un insumo del catálogo: es la base de la receta. Todas las cantidades son "por litrosBase",
 * en la unidad de medida de cada insumo; el escalado lo calcula el backend, nunca el cliente.
 */
export interface RecetaInsumoRequest {
  insumoId: string;
  cantidad: number;
}

export interface RecetaRequest {
  nombre: string;
  productoId: string;
  presentacionId: string;
  litrosBase: number;
  /** Cantidad de la presentación de salida esperada por cada litrosBase (ej. 1 pieza por 100 L). */
  rendimientoBase: number;
  insumos: RecetaInsumoRequest[];
}

export interface RecetaInsumoResponse {
  insumoId: string;
  insumoNombre: string;
  unidadMedida: string;
  cantidad: number;
  insumoActivo: boolean;
}

export interface RecetaResponse {
  id: string;
  nombre: string;
  productoId: string;
  productoNombre: string;
  presentacionId: string;
  presentacionNombre: string;
  unidadConteo: string;
  litrosBase: number;
  rendimientoBase: number;
  activo: boolean;
  insumos: RecetaInsumoResponse[];
}

/** Una línea "INSUMO · NECESARIO · DISPONIBLE · ESTADO". `insumoId` es null para la leche. */
export interface LineaDisponibilidad {
  insumoId: string | null;
  nombre: string;
  unidadMedida: string;
  requerido: number;
  disponible: number;
  faltante: number;
  suficiente: boolean;
}

/**
 * Cálculo de una producción contra el stock actual. Informativo (sin bloqueo): el backend vuelve a validar
 * y bloquea al iniciar. `factor`, `litrosMaximos` y `cantidadEsperadaMaxima` solo vienen en la vista previa
 * de una receta; en la validación de un lote ya planificado son null (su plan es un snapshot).
 */
export interface DisponibilidadProduccion {
  litrosSolicitados: number;
  factor: number | null;
  leche: LineaDisponibilidad;
  insumos: LineaDisponibilidad[];
  /** Salida ESPERADA (no producida) en unidades de la presentación de la receta. */
  cantidadEsperada: number | null;
  presentacionNombre: string | null;
  unidadConteo: string | null;
  todoDisponible: boolean;
  litrosMaximos: number | null;
  cantidadEsperadaMaxima: number | null;
}
