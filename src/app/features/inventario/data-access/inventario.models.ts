/**
 * Fuente: docs/CONTRATOS.md, StockResponse.java. Calculado por el backend desde el libro mayor de
 * movimientos de inventario (SUM(cantidad) por producto) -- el frontend nunca calcula stock con
 * datos locales de producción/ventas, solo muestra lo que devuelve GET /api/inventario/stock.
 */
export interface StockResponse {
  productoId: string;
  producto: string;
  unidadesDisponibles: number;
}

/** Fuente: docs/CONTRATOS.md, StockPresentacionResponse.java. Consulta puntual de stock de UNA presentación
 *  (usada por el carrito de ventas al seleccionar una presentación) -- informativa, sin bloqueo. */
export interface StockPresentacionResponse {
  presentacionId: string;
  unidadesDisponibles: number;
}

/** Contrato actual de GET /inventario/stock/presentaciones. */
export interface FilaStockResponse {
  familiaId: string;
  familiaNombre: string;
  productoId: string;
  productoNombre: string;
  productoActivo: boolean;
  presentacionId: string;
  presentacionNombre: string;
  unidadConteo: string;
  presentacionActivo: boolean;
  /** Existencias físicas (todo lo que hay en el libro, vencido o no). */
  stock: number;
  /** Fase 2 (solo web): si el producto controla vencimiento. */
  controlaVencimiento: boolean;
  /** Fase 2: lo que se puede vender hoy (lotes vigentes). Igual a `stock` si el producto no controla vencimiento. */
  stockVendible: number;
  /** Fase 5: unidades separadas por reservas vigentes (pendientes sin vencer y confirmadas). Calculado por el servidor. */
  stockComprometido: number;
  /** Fase 5: unidades que una venta directa puede tomar hoy sin dejar sin cobertura a las reservas. Calculado por el servidor. */
  stockLibre: number;
}

/** Un lote con saldo dentro de ExistenciasPresentacionResponse. `origen`: salida de un lote de producción o
 *  existencias antiguas regularizadas a mano. `diasParaVencer` 0 = vence hoy (aún vendible); negativo = vencido. */
export interface LoteExistenciaResponse {
  origen: 'LOTE' | 'REGULARIZACION';
  id: string;
  loteProduccionId: string | null;
  fechaLote: string;
  fechaVencimiento: string;
  saldo: number;
  vencido: boolean;
  diasParaVencer: number;
}

/**
 * Fase 2. Fuente: docs/CONTRATOS.md, ExistenciasPresentacionResponse.java (GET
 * /inventario/presentaciones/{id}/existencias). Con control de vencimiento:
 * stockFisico = stockVendible + stockVencido + stockSinTrazabilidad. Lo vencido y lo sin trazabilidad NO se
 * venden. Sin control: stockVendible = stockFisico y `lotes` vacío. Informativo, sin bloqueo: la validación
 * autoritativa ocurre al confirmar la venta.
 */
export interface ExistenciasPresentacionResponse {
  presentacionId: string;
  controlaVencimiento: boolean;
  stockFisico: number;
  stockVendible: number;
  stockVencido: number;
  stockSinTrazabilidad: number;
  /** "Hoy" según el servidor (America/Lima por defecto), con el que se decidió qué está vencido. */
  fechaReferencia: string;
  lotes: LoteExistenciaResponse[];
}

/**
 * Fuente: docs/CONTRATOS.md, AjusteInventarioRequest.java. Acción "Ajustar stock": `cantidadFisica` es el
 * conteo real (nunca un delta) -- el backend calcula la diferencia contra el stock actual del sistema. El
 * motivo es obligatorio: un ajuste siempre debe explicar la diferencia encontrada (pérdida, rotura, error
 * de conteo...).
 */
export interface AjusteInventarioRequest {
  presentacionId: string;
  cantidadFisica: number;
  motivo: string;
}

/**
 * Fuente: docs/CONTRATOS.md, AjusteInventarioResponse.java. Un ajuste nunca devuelve ni consume leche, ni
 * reescribe cómo se produjo -- solo agrega un movimiento nuevo al libro mayor de esa presentación.
 */
export interface AjusteInventarioResponse {
  id: string;
  presentacionId: string;
  presentacionNombre: string;
  productoNombre: string;
  cantidadAnterior: number;
  cantidadCorregida: number;
  delta: number;
  motivo: string;
  usuarioNombre: string;
  creadoEn: string;
}

/**
 * Fuente: docs/CONTRATOS.md, SaldoLecheResponse.java (refactor de Producción, fase 3/backend). Calculado
 * por el backend desde el libro mayor de movimientos de leche (SUM(cantidad), un único pool de planta) --
 * el frontend nunca calcula el saldo con datos locales. Informativo: la validación autoritativa de saldo
 * suficiente para producir ocurre en el backend al confirmar POST /api/lotes-produccion, con su propio
 * bloqueo pesimista -- un valor leído aquí puede quedar desactualizado un instante después por otra
 * producción concurrente.
 */
export interface SaldoLecheResponse {
  litrosDisponibles: number;
}

/** VENCIMIENTO, DETERIORO y OTRA valen para insumos y producto terminado; los demás, solo para insumos. */
export type MotivoSalida = 'VENCIMIENTO' | 'DETERIORO' | 'OTRA' | 'MERMA' | 'DERRAME' | 'DEVOLUCION_PROVEEDOR' | 'CONSUMO_MANUAL';

export const MOTIVOS_INSUMO: { valor: MotivoSalida; etiqueta: string }[] = [
  { valor: 'MERMA', etiqueta: 'Merma' },
  { valor: 'DERRAME', etiqueta: 'Derrame' },
  { valor: 'VENCIMIENTO', etiqueta: 'Vencido' },
  { valor: 'DEVOLUCION_PROVEEDOR', etiqueta: 'Devolución a proveedor' },
  { valor: 'CONSUMO_MANUAL', etiqueta: 'Consumo manual' },
  { valor: 'OTRA', etiqueta: 'Otra salida justificada' }
];

export interface SalidaInventarioRequest {
  uuidCliente: string;
  cantidad: number;
  tipo: MotivoSalida;
  motivo: string;
  /** LOTE o REGULARIZACION: lote de producto terminado. INSUMO: lote de insumo (loteId); sin lote = se reparte en FEFO. */
  origenLote: 'LOTE' | 'REGULARIZACION' | 'INSUMO' | null;
  loteId: string | null;
}
export interface SalidaInventarioResponse {
  id: string;
  movimientoId: string;
  cantidad: number;
  tipo: string;
  motivo: string;
  origenLote: string | null;
  loteId: string | null;
  fechaVencimiento: string | null;
  usuarioNombre: string;
  creadoEn: string;
}
