import { PaginaResponse } from '../../../shared/models/pagina-response';

/**
 * Fuente: backend dto/KardexResponse.java, MovimientoKardexResponse.java (V19). Kardex SOLO por cantidades:
 * no hay costos ni valorización (el precio de venta nunca se muestra como costo). El backend calcula el
 * saldo acumulado de cada fila sobre el libro completo y los totales sobre todo el rango, no sobre la página.
 */
export type TipoItemKardex = 'LECHE' | 'INSUMO' | 'PRESENTACION';

export interface MovimientoKardex {
  id: string;
  /** Fecha y hora de registro del movimiento. */
  fecha: string;
  tipoMovimiento: string;
  /** Positiva o null. */
  entrada: number | null;
  /** Positiva o null. */
  salida: number | null;
  /** Saldo acumulado real después de este movimiento. */
  saldo: number;
  documentoTipo: 'RECEPCION' | 'LOTE' | 'VENTA' | 'AJUSTE' | 'INGRESO' | 'SALDO_INICIAL' | string;
  documentoId: string | null;
  /** Fecha de negocio del documento (fecha de la recepción, del lote o de la venta). */
  documentoFecha: string | null;
  referencia: string | null;
  usuarioNombre: string | null;
  motivo: string | null;
  /** Solo el kardex de insumos (V43/V44): lote al que afecta, su proveedor y vencimiento, y el documento de ingreso del lote. */
  loteId?: string | null;
  loteCodigo?: string | null;
  proveedorNombre?: string | null;
  fechaVencimiento?: string | null;
  ingresoDocumentoTipo?: string | null;
  ingresoDocumentoNumero?: string | null;
}

export interface Kardex {
  tipoItem: TipoItemKardex;
  itemId: string | null;
  itemNombre: string;
  unidadMedida: string;
  desde: string | null;
  hasta: string | null;
  saldoInicial: number;
  totalEntradas: number;
  totalSalidas: number;
  saldoFinal: number;
  movimientos: PaginaResponse<MovimientoKardex>;
}

export interface FiltroKardex {
  desde?: string;
  hasta?: string;
  /** Solo kardex de insumos: los movimientos, el saldo y los totales de ESE lote. */
  loteId?: string;
  page: number;
  size: number;
}

/** Fuente: backend dto/IngresoInsumoRequest.java. Solo cantidad (sin costo). */
export interface IngresoInsumoRequest {
  cantidad: number;
  referencia?: string | null;
  observacion?: string | null;
}

/** Fuente: backend dto/AjusteInsumoRequest.java. `cantidadFisica` es el conteo real, nunca un delta. */
export interface AjusteInsumoRequest {
  cantidadFisica: number;
  motivo: string;
}

/** Fuente: backend dto/MovimientoInsumoResponse.java. `cantidad` con signo. */
export interface MovimientoInsumoResponse {
  id: string;
  insumoId: string;
  insumoNombre: string;
  unidadMedida: string;
  tipoMovimiento: 'INGRESO' | 'AJUSTE' | string;
  cantidad: number;
  saldoAnterior: number;
  saldoResultante: number;
  referencia: string | null;
  motivo: string | null;
  usuarioNombre: string | null;
  creadoEn: string;
}

export const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  ENTRADA_LECHE_RECEPCION: 'Recepción de leche',
  SALIDA_LECHE_PRODUCCION: 'Consumo en producción',
  SALDO_INICIAL: 'Saldo inicial',
  INGRESO: 'Ingreso',
  SALIDA_PRODUCCION: 'Consumo en producción',
  AJUSTE: 'Ajuste por conteo',
  ENTRADA_PRODUCCION: 'Ingreso por producción',
  SALIDA_VENTA: 'Venta',
  SALIDA_VENCIMIENTO: 'Retiro por vencimiento',
  SALIDA_DETERIORO: 'Baja por deterioro',
  SALIDA_OTRA: 'Otra salida justificada'
};
