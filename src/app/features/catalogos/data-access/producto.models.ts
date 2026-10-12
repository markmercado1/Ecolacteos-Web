/** Fuente: docs/CONTRATOS.md, ProductoRequest.java / ProductoResponse.java (Fase 1: Producto + Presentación).
 *  Generaliza el antiguo "tipo de queso": rendimientoEsperadoPct/cicloCapital son atributos de producción
 *  de queso específicamente, no comerciales -- opcionales para productos de otras familias. */
export type CicloCapital = 'RAPIDO' | 'MADURACION';

export type UnidadContenido = 'ML' | 'L' | 'G' | 'KG';

export interface RangoRendimiento {
  minimo: number;
  maximo: number;
  unidad: 'KG' | 'L' | 'UNIDAD';
}

export interface ProductoRequest {
  rangoRendimiento?: RangoRendimiento | null;
  nombre: string;
  familiaId: string;
  rendimientoEsperadoPct?: number | null;
  cicloCapital?: CicloCapital | null;
}

export interface ProductoResponse {
  rangoRendimiento?: RangoRendimiento | null;
  id: string;
  nombre: string;
  familiaId: string;
  familiaNombre: string;
  rendimientoEsperadoPct: number | null;
  cicloCapital: CicloCapital | null;
  activo: boolean;
  /** Presentaciones activas e inactivas de este producto. Crear un producto no genera presentaciones. */
  presentaciones: PresentacionResponse[];
  /** URL relativa de la foto pública del producto (ver urlFotoCatalogo); null/ausente si no tiene. */
  fotoUrl?: string | null;
}

/** Cómo se cuenta/almacena/vende un producto (ej. "Botella 1 L", "Pieza"). contenidoCantidad/contenidoUnidad
 *  son descriptivos y opcionales -- una "Pieza" sin peso/volumen declarado deja ambos en null, nunca se
 *  inventa un valor. unidadConteo es vocabulario abierto ("botella", "frasco", "pieza", "envase"...). */
export interface PresentacionRequest {
  nombre: string;
  contenidoCantidad?: number | null;
  contenidoUnidad?: UnidadContenido | null;
  unidadConteo: string;
}

export interface PresentacionResponse {
  id: string;
  productoId: string;
  nombre: string;
  contenidoCantidad: number | null;
  contenidoUnidad: UnidadContenido | null;
  unidadConteo: string;
  activo: boolean;
  /** Foto propia de la presentación; si es null el catálogo usa la del producto. */
  fotoUrl?: string | null;
}
