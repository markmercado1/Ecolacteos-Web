/** Fuente: backend dto/LoteInsumoResponse.java, ConteoInsumoRequest.java, ConteoInsumoResponse.java (V43 a V45). */
export type EstadoLote = 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'AGOTADO';

export const ETIQUETA_ESTADO_LOTE: Record<EstadoLote, string> = {
  VIGENTE: 'Vigente',
  POR_VENCER: 'Por vencer',
  VENCIDO: 'Vencido',
  AGOTADO: 'Agotado'
};

export interface LoteInsumoResponse {
  id: string;
  insumoId: string;
  insumoNombre: string;
  unidadMedida: string;
  codigo: string;
  codigoProveedor: string | null;
  fechaIngreso: string;
  fechaVencimiento: string | null;
  proveedorId: string | null;
  proveedorNombre: string | null;
  proveedorRuc: string | null;
  documentoIngresoId: string | null;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  cantidadInicial: number;
  cantidadDisponible: number;
  estado: EstadoLote;
  /** Días hasta el último día válido (negativo si ya venció); null si no tiene vencimiento. */
  diasParaVencer: number | null;
}

/** Lotes con existencia que vencen pronto o ya vencieron (para avisar en Inventario). */
export interface AlertasLotes {
  diasAlerta: number;
  porVencer: number;
  vencidos: number;
  lotes: LoteInsumoResponse[];
}

export interface ConteoInsumoRequest {
  motivo: string;
  lotes: { loteId: string; cantidadContada: number }[];
}

export interface ConteoInsumoResponse {
  insumoId: string;
  insumoNombre: string;
  unidadMedida: string;
  saldoAnterior: number;
  saldoResultante: number;
  diferencias: {
    loteId: string;
    loteCodigo: string;
    cantidadSistema: number;
    cantidadContada: number;
    variacion: number;
    movimientoId: string;
  }[];
}
