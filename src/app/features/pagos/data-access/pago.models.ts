/** Fuente: docs/CONTRATOS.md, GenerarPagoRequest.java / PagoResponse.java. */
export interface GenerarPagoRequest {
  proveedorId: string;
  semanaInicio: string;
  semanaFin: string;
}

export interface PagoResponse {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  semanaInicio: string;
  semanaFin: string;
  litrosTotales: number;
  /** Precio del pago ORIGINAL (inmutable). */
  precioLitro: number;
  /** Total del pago ORIGINAL (inmutable). */
  total: number;
  comprobanteGenerado: boolean;
  registroAcopioIds: string[];
  /** Precio por litro vigente para ESTE pago: el del ajuste de precio más reciente, o `precioLitro` si no hay ajustes. */
  precioLitroEfectivo: number;
  /**
   * Lo que realmente se paga (total reconocido): suma, entrega por entrega, de litros liquidados × precio aplicado, redondeada una sola
   * vez. Ya incluye el ajuste de precio del pago y los precios de calidad de cada entrega. Lo calcula el servidor.
   */
  totalAPagar: number;
  /** Fase C. Lo que suman los precios de calidad propios de algunas entregas frente al precio del pago; negativo = se paga menos. */
  ajusteCalidad: number;
}

/** ¿Algún precio de calidad de entregas cambia el total de este pago? */
export function pagoConAjusteDeCalidad(pago: Pick<PagoResponse, 'ajusteCalidad'>): boolean {
  return pago.ajusteCalidad !== 0;
}

/** ¿Este pago tiene un precio ajustado respecto al original? */
export function pagoAjustado(pago: Pick<PagoResponse, 'precioLitro' | 'precioLitroEfectivo'>): boolean {
  return pago.precioLitroEfectivo !== pago.precioLitro;
}

/**
 * Total de un pago a un precio dado, con el MISMO redondeo que el servidor (PagoService.calcularTotal: half-up a
 * céntimos). Aritmética entera para no arrastrar errores de coma flotante (p. ej. 123 × 1.255 = 154.365 → 154.37).
 * Solo para la vista previa: el total oficial siempre lo devuelve el servidor.
 */
export function totalDePago(litros: number, precioLitro: number): number {
  const centilitros = Math.round(litros * 100);
  const milesimas = Math.round(precioLitro * 1000);
  return Math.floor((centilitros * milesimas + 500) / 1000) / 100;
}

/** Fuente: AjustePrecioPagoRequest.java. El motivo es obligatorio (auditoría); el precio, entre 0.001 y 999.999. */
export interface AjustePrecioPagoRequest {
  precioLitroNuevo: number;
  motivo: string;
}

/** Fuente: AjustePrecioPagoResponse.java. Una fila del historial de cambios de precio de un pago. */
export interface AjustePrecioPagoResponse {
  id: string;
  pagoId: string;
  precioLitroAnterior: number;
  precioLitroNuevo: number;
  totalAnterior: number;
  totalNuevo: number;
  motivo: string;
  usuarioNombre: string;
  creadoEn: string;
}

/** Estados reales de un ajuste de litros (EstadoAjustePago.java). */
export type EstadoAjustePago = 'PENDIENTE' | 'LIQUIDADO';

/**
 * Fuente: docs/CONTRATOS.md, AjustePagoResponse.java. Ajuste de litros generado por una corrección posterior a la liquidación.
 *
 * `precioLitro` y `monto` son los VIGENTES que calcula el servidor: mientras el ajuste está PENDIENTE siguen al precio de su entrega
 * (su precio de calidad o, si no tiene, el del pago); al LIQUIDARLO quedan congelados. `precioLitroAlCrear` y `montoAlCrear` son los del
 * momento de la creación.
 */
export interface AjustePagoResponse {
  id: string;
  pagoId: string;
  registroAcopioId: string;
  correccionRegistroId: string;
  litrosDiferencia: number;
  precioLitro: number;
  monto: number;
  estado: EstadoAjustePago;
  creadoEn: string;
  precioLitroAlCrear: number;
  montoAlCrear: number;
}

/**
 * Fuente: LineaPagoResponse.java (GET /api/pagos/{id}/lineas, ADMIN y RECEPCION). Una entrega liquidada en el pago. Cada cantidad es un
 * concepto distinto y el panel no las convierte entre sí: todas las trae el servidor.
 */
export interface LineaPagoResponse {
  registroAcopioId: string;
  fechaHora: string;
  /** Lo que se recibió. Nunca cambia. */
  litrosOriginales: number;
  /** Lo que se pagó al generar el pago (el original o la última corrección válida de ese momento). */
  litrosLiquidados: number;
  /** Liquidados más lo que sumaron los ajustes de litros posteriores = lo que el pago tiene en cuenta hoy. */
  litrosContabilizados: number;
  /** Original o última corrección válida de hoy. Difiere de los contabilizados solo si hay una corrección sin ajuste. */
  litrosEfectivosActuales: number;
  /** Precio normal con el que se generó el pago. */
  precioBase: number;
  /** Precio aplicado hoy a ESTA entrega: su precio de calidad o, si no tiene, el del pago (con sus ajustes). */
  precioAplicado: number;
  correccionAplicadaId: string | null;
  /** true si la entrega tiene precio de calidad propio (manda sobre el ajuste del pago completo). */
  precioPropioDeCalidad: boolean;
  analisisCalidadId: string | null;
  motivoAjusteCalidad: string | null;
}

/** Fuente: AjusteCalidadEntregaRequest.java. Precio entre 0.001 y 999.999 (3 decimales), análisis de ESA entrega y motivo (máx. 500). */
export interface AjusteCalidadEntregaRequest {
  precioLitroNuevo: number;
  analisisCalidadId: string;
  motivo: string;
}

/** Fuente: AjusteCalidadEntregaResponse.java. Un precio de calidad aplicado a una entrega de un pago. */
export interface AjusteCalidadEntregaResponse {
  id: string;
  pagoId: string;
  registroAcopioId: string;
  analisisCalidadId: string;
  analisisFolio: string;
  analisisResultado: string | null;
  litrosLiquidados: number;
  precioNormal: number;
  precioAnterior: number;
  precioLitroNuevo: number;
  /** litros liquidados × (precio nuevo − precio normal), calculado por el servidor; negativo = se paga menos por esta entrega. */
  efectoEnElTotal: number;
  motivo: string;
  usuarioNombre: string;
  creadoEn: string;
}

/** Roles que pueden consultar el historial de precios de calidad (GET /pagos/{id}/ajustes-calidad). Solo ADMIN los aplica. */
const ROLES_HISTORIAL_CALIDAD = ['ADMIN', 'RECEPCION', 'CALIDAD'];

export function puedeVerHistorialDeCalidad(rol: string | null | undefined): boolean {
  return !!rol && ROLES_HISTORIAL_CALIDAD.includes(rol);
}
