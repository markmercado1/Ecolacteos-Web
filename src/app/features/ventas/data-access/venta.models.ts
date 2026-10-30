import { CompradorRef, CompradorResumen } from '../../clientes/data-access/cliente.models';

/** Fuente: docs/CONTRATOS.md, VentaRequest.java. Código de un tipo de precio del catálogo (`/api/tipos-precio`): MAYORISTA, PROVEEDOR, PUBLICO u otro creado por ADMIN. */
export type TipoClienteVenta = string;

/** V48: tipo de comprobante de la venta. Cada tipo lleva su propia serie y su propio correlativo (NOTA_VENTA: NV01, BOLETA: B001). */
export type TipoComprobante = 'NOTA_VENTA' | 'BOLETA';

export const ETIQUETAS_COMPROBANTE: Record<TipoComprobante, string> = {
  NOTA_VENTA: 'Nota de venta',
  BOLETA: 'Boleta de venta electrónica'
};

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
  /** Fase H (opcional): quien compra. Sin comprador = cliente varios (solo en canal PÚBLICO). */
  comprador?: CompradorRef | null;
  /** V48 (opcional): NOTA_VENTA (por defecto) o BOLETA. */
  tipoComprobante?: TipoComprobante;
}

/** Fuente: docs/CONTRATOS.md, DetalleVentaResponse.java. Una línea ya confirmada por el servidor. */
export interface DetalleVentaResponse {
  presentacionId: string;
  presentacionNombre: string;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  /**
   * Fase G: foto tributaria de la línea al venderse (todo null = sin determinar: ventas anteriores o cálculo del IGV apagado).
   * El precio ya incluye el IGV: valorVenta + igv = subtotal.
   */
  afectacionIgv?: 'GRAVADO' | 'EXONERADO' | 'INAFECTO' | null;
  tasaIgv?: number | null;
  valorVenta?: number | null;
  igv?: number | null;
  /** V48: código de la presentación (PRD-001...). Puede faltar si el backend es anterior. */
  codigo?: string | null;
}

/** Fase G: resumen del IGV contenido en el total de una venta (VentaResumenResponse.ResumenIgvVenta). */
export interface ResumenIgvVenta {
  estado: 'SIN_DETERMINAR' | 'DETERMINADO' | 'PARCIAL';
  incluyeIgv: boolean;
  operacionesGravadas: number;
  operacionesExoneradas: number;
  operacionesInafectas: number;
  igvTotal: number;
  montoSinDeterminar: number | null;
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
  /** Fase G: puede faltar si el backend es anterior a esta fase. */
  igv?: ResumenIgvVenta | null;
  /** Fase H: comprador (null = cliente varios; tipo null + nombre = nombre dado en la reserva, sin ficha) y reserva de origen. */
  comprador?: CompradorResumen | null;
  reservaId?: string | null;
  reservaCodigo?: string | null;
  /** V48: comprobante («NV01-00000041»), quién registró la venta y la hora real del registro (hora local de la planta, sin zona). Pueden faltar si el backend es anterior. */
  tipoComprobante?: TipoComprobante | null;
  comprobante?: string | null;
  vendedorNombre?: string | null;
  creadoEn?: string | null;
}

/**
 * Resultado del buscador de «Nueva venta» (GET /api/ventas/presentaciones). `disponible` = false (con su `motivo`) se muestra pero no se puede
 * agregar. El precio es el vigente para el canal y la fecha pedidos; el servidor vuelve a resolverlo al registrar la venta.
 */
export interface PresentacionVentaResultado {
  presentacionId: string;
  productoId: string;
  productoNombre: string;
  presentacionNombre: string;
  codigo: string;
  stockVendible: number;
  precio: number | null;
  disponible: boolean;
  motivo: 'SIN_STOCK' | 'SIN_PRECIO' | null;
}
