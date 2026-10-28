import { TipoClienteVenta } from '../../ventas/data-access/venta.models';

/**
 * Fuente: docs/CONTRATOS.md, PrecioQuesoRequest.java / PrecioQuesoResponse.java.
 * Fase 2 (Precios por presentación, V11__precio_presentacion.sql): serie histórica append-only por
 * PRESENTACIÓN + modalidad -- cada presentación tiene sus propias tarifas, nunca se deduce el precio de
 * una a partir de otra. Reutiliza TipoClienteVenta (MAYORISTA/PROVEEDOR/PUBLICO) -- no se define un enum
 * de modalidad nuevo. Sin editar ni eliminar: cada registro abre una vigencia nueva. No es necesario
 * configurar las tres modalidades.
 */
export interface PrecioQuesoRequest {
  presentacionId: string;
  modalidad: TipoClienteVenta;
  precio: number;
  vigenteDesde: string;
}

/** productoId/productoNombre vienen denormalizados desde el backend (vía presentación → producto) para
 *  no necesitar una llamada aparte al mostrar a qué producto pertenece cada presentación. */
export interface PrecioQuesoResponse {
  id: string;
  presentacionId: string;
  presentacionNombre: string;
  productoId: string;
  productoNombre: string;
  modalidad: TipoClienteVenta;
  precio: number;
  vigenteDesde: string;
}

/**
 * Ampliación de Fase 2 (pantalla /precios reorganizada por familia con paginación real). Situación de
 * precio de una presentación para UNA modalidad, ya resuelta por el servidor con la fecha de hoy (nunca
 * calculada en el cliente): "VIGENTE" (precio/vigenteDesde de la tarifa aplicable ahora), "PROGRAMADO"
 * (precio/vigenteDesde de la próxima tarifa futura) o "SIN_PRECIO" (precio/vigenteDesde null).
 */
export interface PrecioModalidadResponse {
  estado: 'VIGENTE' | 'PROGRAMADO' | 'SIN_PRECIO';
  precio: number | null;
  vigenteDesde: string | null;
}

/** Una fila por presentación ACTIVA de un producto ACTIVO. Un producto activo sin ninguna presentación
 *  activa llega con presentacionId/presentacionNombre null y las tres modalidades en SIN_PRECIO -- el
 *  backend nunca inventa una presentación para que la fila "encaje". */
export interface FilaPrecioPresentacionResponse {
  familiaId: string;
  familiaNombre: string;
  productoId: string;
  productoNombre: string;
  presentacionId: string | null;
  presentacionNombre: string | null;
  mayorista: PrecioModalidadResponse;   // compatibilidad: los tres tipos originales
  proveedor: PrecioModalidadResponse;
  publico: PrecioModalidadResponse;
  /** Un resumen por cada tipo del catálogo, por código: la tabla no depende de columnas fijas. */
  porTipo: Record<string, PrecioModalidadResponse>;
}

export interface FiltroPreciosPresentacion {
  familiaId?: string;
  busqueda?: string;
  page: number;
  size: number;
}
