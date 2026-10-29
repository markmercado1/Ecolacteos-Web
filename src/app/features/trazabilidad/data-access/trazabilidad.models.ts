import { LoteInsumoResponse } from '../../inventario/data-access/lotes.models';

/** Fuente: backend dto/TrazabilidadResponse.java y AdjuntoResponse.java (V44 a V46). */
export interface AdjuntoResponse {
  id: string;
  entidadTipo: string;
  entidadId: string;
  nombreOriginal: string;
  contentType: string;
  tamanoBytes: number;
  subidoPorNombre: string;
  subidoEn: string;
  urlContenido: string;
}

export interface DocumentoTrazado {
  id: string;
  tipo: string;
  numero: string | null;
  fecha: string | null;
  proveedorNombre: string | null;
  proveedorRuc: string | null;
  usuarioNombre: string;
  creadoEn: string;
}

export interface MovimientoTrazado {
  fecha: string;
  tipo: string;
  cantidad: number;
  usuarioNombre: string | null;
  motivo: string | null;
  referencia: string | null;
}

export interface ProduccionTrazada {
  loteProduccionId: string;
  fecha: string;
  productoNombre: string;
  cantidad: number;
}

export interface LoteInsumoTrazado {
  lote: LoteInsumoResponse;
  documento: DocumentoTrazado | null;
  adjuntos: AdjuntoResponse[];
  movimientos: MovimientoTrazado[];
  producciones: ProduccionTrazada[];
}

export interface LoteConsumido {
  loteId: string;
  codigo: string;
  codigoProveedor: string | null;
  proveedorNombre: string | null;
  fechaVencimiento: string | null;
  cantidad: number;
}

export interface LoteProduccionTrazado {
  id: string;
  fecha: string;
  productoNombre: string;
  insumos: { insumoNombre: string; unidadMedida: string; lotes: LoteConsumido[] }[];
}

export interface TrazabilidadResponse {
  consulta: string;
  lotesInsumo: LoteInsumoTrazado[];
  lotesProduccion: LoteProduccionTrazado[];
}

/** Etiquetas de los movimientos del libro de insumos. */
export const ETIQUETA_MOV: Record<string, string> = {
  SALDO_INICIAL: 'Saldo inicial',
  INGRESO: 'Ingreso',
  SALIDA_PRODUCCION: 'Consumo en producción',
  AJUSTE: 'Conteo físico',
  SALIDA_VENCIMIENTO: 'Salida · vencido',
  SALIDA_DETERIORO: 'Salida · deterioro',
  SALIDA_OTRA: 'Salida · otra',
  SALIDA_MERMA: 'Salida · merma',
  SALIDA_DERRAME: 'Salida · derrame',
  SALIDA_DEVOLUCION_PROVEEDOR: 'Salida · devolución a proveedor',
  SALIDA_CONSUMO_MANUAL: 'Salida · consumo manual',
  ANULACION_INGRESO: 'Anulación de ingreso',
  TRANSFERENCIA_LOTE: 'Transferencia entre lotes'
};
