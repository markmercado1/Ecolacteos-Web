/**
 * Fase G: configuración del IGV de las ventas. Fuente: ConfiguracionIgvDtos.java (GET/POST /api/admin/tributario/*, solo ADMIN).
 * Los precios son FINALES: el IGV se desglosa dentro del precio, nunca se suma. Mientras el servidor tenga el cálculo apagado
 * (estado PENDIENTE) nada de esto cambia una venta.
 */
export type AfectacionIgv = 'SIN_DEFINIR' | 'GRAVADO' | 'EXONERADO' | 'INAFECTO';

export interface TasaIgvRequest {
  /** Porcentaje: 18 = 18 %. */
  tasa: number;
  vigenteDesde: string;
  motivo: string;
}

export interface TasaIgvResponse {
  id: string;
  tasa: number;
  vigenteDesde: string;
  motivo: string;
  usuarioNombre: string | null;
  creadoEn: string;
}

export interface AfectacionIgvRequest {
  afectacion: AfectacionIgv;
  vigenteDesde: string;
  motivo: string;
}

export interface AfectacionIgvResponse {
  id: string;
  presentacionId: string;
  afectacion: AfectacionIgv;
  vigenteDesde: string;
  motivo: string;
  usuarioNombre: string | null;
  creadoEn: string;
}

export interface FilaAfectacionIgvResponse {
  presentacionId: string;
  presentacionNombre: string;
  productoId: string;
  productoNombre: string;
  familiaNombre: string | null;
  /** SIN_DEFINIR si nunca se clasificó. */
  afectacionVigente: AfectacionIgv;
  vigenteDesde: string | null;
  afectacionProgramada: AfectacionIgv | null;
  programadaDesde: string | null;
}

export interface EstadoIgvResponse {
  calculoHabilitado: boolean;
  /** PENDIENTE: cálculo apagado (las ventas se registran sin desglose). ACTIVO: se desglosa lo clasificado. */
  estado: 'PENDIENTE' | 'ACTIVO';
  tasaVigente: TasaIgvResponse | null;
  tasaProgramada: TasaIgvResponse | null;
  presentacionesActivas: number;
  sinDefinir: number;
  gravadas: number;
  exoneradas: number;
  inafectas: number;
  /** Avisos del servidor, en texto. */
  avisos: string[];
  /** El último cambio del interruptor (quién, cuándo y por qué), o null si nadie lo ha cambiado desde el panel. */
  ultimoCambio: CambioCalculoResponse | null;
}

export interface CambioCalculoResponse {
  habilitado: boolean;
  motivo: string;
  usuarioNombre: string | null;
  creadoEn: string;
}

/** Clasifica de una vez las presentaciones activas; soloSinDefinir (por defecto true) no pisa lo ya decidido. */
export interface AfectacionLoteRequest {
  afectacion: AfectacionIgv;
  vigenteDesde: string;
  motivo: string;
  soloSinDefinir?: boolean;
}

export interface AfectacionLoteResponse {
  aplicadas: number;
  omitidas: number;
}

const ETIQUETAS_AFECTACION: Record<AfectacionIgv, string> = {
  SIN_DEFINIR: 'Sin definir',
  GRAVADO: 'Gravado',
  EXONERADO: 'Exonerado',
  INAFECTO: 'Inafecto'
};

export function etiquetaAfectacion(afectacion: string | null | undefined): string {
  return ETIQUETAS_AFECTACION[afectacion as AfectacionIgv] ?? 'Sin determinar';
}

export const AFECTACIONES: AfectacionIgv[] = ['GRAVADO', 'EXONERADO', 'INAFECTO', 'SIN_DEFINIR'];
