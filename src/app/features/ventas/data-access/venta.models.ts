/** Fuente: docs/CONTRATOS.md, VentaRequest.java. Valores reales de tipoCliente. */
export type TipoClienteVenta = 'MAYORISTA' | 'PROVEEDOR' | 'PUBLICO';

/**
 * Fase 4 (Venta multi-línea / carrito): una línea del carrito enviada al confirmar la venta. El precio se
 * resuelve siempre en el servidor -- nunca se envía aquí.
 */
export interface DetalleVentaRequest {
  presentacionId: string;
  cantidad: number;
}

/**
 * Fuente: docs/CONTRATOS.md, CrearVentaCarritoRequest.java. El servidor determina el vendedor (usuario
 * autenticado), resuelve el precio de cada línea y calcula el total; no se envían aquí. `detalles` nunca es
 * una lista vacía: una venta sin ninguna línea no tiene sentido de negocio.
 */
export interface CrearVentaCarritoRequest {
  uuidCliente: string;
  fecha: string;
  tipoCliente: TipoClienteVenta;
  detalles: DetalleVentaRequest[];
}

/** Fuente: docs/CONTRATOS.md, DetalleVentaResponse.java. Una línea ya confirmada por el servidor. */
export interface DetalleVentaResponse {
  presentacionId: string;
  presentacionNombre: string;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

/**
 * Fuente: docs/CONTRATOS.md, VentaResumenResponse.java. Forma usada por el listado (GET /api/ventas), el
 * detalle (GET /api/ventas/{id}) y la confirmación del carrito (POST /api/ventas/carrito) -- una venta con
 * una o más líneas.
 */
export interface VentaResumenResponse {
  id: string;
  fecha: string;
  tipoCliente: TipoClienteVenta;
  detalles: DetalleVentaResponse[];
  total: number;
}
