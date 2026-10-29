/** Fuente: backend dto/IngresoDocumentoRequest.java y DocumentoIngresoResponse.java (V44). */
export type TipoDocumentoIngreso = 'GUIA' | 'FACTURA' | 'BOLETA' | 'OTRO' | 'SIN_DOCUMENTO';

export const ETIQUETA_DOCUMENTO: Record<TipoDocumentoIngreso, string> = {
  GUIA: 'Guía',
  FACTURA: 'Factura',
  BOLETA: 'Boleta',
  OTRO: 'Otro documento',
  SIN_DOCUMENTO: 'Sin documento'
};

export interface LineaIngresoRequest {
  insumoId: string;
  cantidad: number;
  /** Vacío = se autogenera (AAA-yyyymmdd-NN); si se indica debe ser único para el insumo. */
  codigoLote?: string | null;
  loteProveedor?: string | null;
  /** Último día válido (yyyy-mm-dd), opcional; no puede ser anterior a hoy. */
  fechaVencimiento?: string | null;
}

export interface IngresoDocumentoRequest {
  /** Hace el reenvío idempotente: el mismo ingreso reenviado no se duplica. */
  uuidCliente: string;
  proveedorId?: string | null;
  tipoDocumento: TipoDocumentoIngreso;
  numeroDocumento?: string | null;
  fechaDocumento?: string | null;
  observacion?: string | null;
  lineas: LineaIngresoRequest[];
}

export interface LineaIngresoResponse {
  insumoId: string;
  insumoNombre: string;
  unidadMedida: string;
  cantidad: number;
  loteId: string;
  loteCodigo: string;
  loteProveedor: string | null;
  fechaVencimiento: string | null;
  movimientoId: string | null;
  saldoAnterior: number | null;
  saldoResultante: number | null;
}

export interface DocumentoIngresoResponse {
  id: string;
  proveedorId: string | null;
  proveedorNombre: string | null;
  proveedorRuc: string | null;
  tipoDocumento: TipoDocumentoIngreso;
  numeroDocumento: string | null;
  fechaDocumento: string | null;
  observacion: string | null;
  usuarioNombre: string;
  creadoEn: string;
  lineas: LineaIngresoResponse[];
}
