/**
 * Fase G: persona natural (DNI obligatorio, RUC opcional en la misma ficha) o empresa (RUC y razón social obligatorios, sin DNI).
 * Fuente: ProveedorRequest.java / TipoPersona.java.
 */
export type TipoPersona = 'NATURAL' | 'EMPRESA';

/**
 * Fuente: docs/CONTRATOS.md, ProveedorRequest.java. Alta: zona opcional. Fase G: tipoPersona (NATURAL por defecto), ruc y
 * razonSocial; para una empresa el nombre es opcional (el servidor usa la razón social).
 */
export interface ProveedorRequest {
  nombre: string;
  dni: string | null;
  telefono: string | null;
  zonaActualId: string | null;
  tipoPersona?: TipoPersona;
  ruc?: string | null;
  razonSocial?: string | null;
}

/**
 * Fuente: docs/CONTRATOS.md, ProveedorUpdateRequest.java. No incluye zona:
 * el PUT de datos no la cambia (docs/ALCANCE.md); para eso existe
 * PUT /api/proveedores/{id}/zona. Fase G: mismos campos de documentos que el alta.
 */
export interface ProveedorUpdateRequest {
  nombre: string;
  dni: string | null;
  telefono: string | null;
  tipoPersona?: TipoPersona;
  ruc?: string | null;
  razonSocial?: string | null;
}

/** Fuente: docs/CONTRATOS.md, ProveedorAdminResponse.java. Fase G: dni es null en una empresa. */
export interface ProveedorAdminResponse {
  id: string;
  nombre: string;
  dni: string | null;
  telefono: string | null;
  zonaActualId: string | null;
  zonaActualNombre: string | null;
  codigoQr: string;
  activo: boolean;
  tipoPersona: TipoPersona;
  ruc: string | null;
  razonSocial: string | null;
}

/** Fuente: docs/CONTRATOS.md, ProveedorPublicoResponse.java (usado por el lookup de QR). */
export interface ProveedorPublicoResponse {
  id: string;
  nombre: string;
  zonaActualId: string | null;
  zonaActualNombre: string | null;
  codigoQr: string;
}

/** Fuente: docs/CONTRATOS.md, HistorialZonaResponse.java. */
export interface HistorialZonaResponse {
  id: string;
  zonaId: string;
  zonaNombre: string;
  desde: string;
  hasta: string | null;
  /** Fase A (aditivos): el periodo exacto [inicioEn, finEn) (finEn nulo = periodo actual), de dónde venía, por qué y quién lo hizo. */
  inicioEn: string;
  finEn: string | null;
  zonaOrigenNombre: string | null;
  motivo: string | null;
  usuarioNombre: string | null;
  /** Periodo con fechas invertidas heredado de una versión anterior: se conserva, pero no decide la zona de ninguna entrega. */
  requiereRevision: boolean;
  notaRevision: string | null;
}

/** Fuente: RevisionDocumentosResponse.java (GET /api/admin/proveedores/revision-documentos, solo ADMIN, solo lectura). */
export type CodigoObservacionDocumento =
  | 'DNI_FORMATO'
  | 'DNI_PARECE_RUC'
  | 'DNI_DUPLICADO_PROBABLE'
  | 'RUC_INVALIDO'
  | 'RUC_NO_COINCIDE_DNI'
  | 'POSIBLE_MISMA_PERSONA';

export interface ObservacionDocumento {
  proveedorId: string;
  nombre: string;
  tipoPersona: TipoPersona | null;
  dni: string | null;
  ruc: string | null;
  activo: boolean;
  codigo: CodigoObservacionDocumento;
  /** Explicación del servidor, en texto. */
  detalle: string;
}

export interface RevisionDocumentosResponse {
  totalProveedores: number;
  proveedoresConObservaciones: number;
  observaciones: ObservacionDocumento[];
}

const ETIQUETAS_OBSERVACION: Record<CodigoObservacionDocumento, string> = {
  DNI_FORMATO: 'DNI fuera de formato',
  DNI_PARECE_RUC: 'RUC escrito en el campo DNI',
  DNI_DUPLICADO_PROBABLE: 'DNI posiblemente repetido',
  RUC_INVALIDO: 'RUC no válido',
  RUC_NO_COINCIDE_DNI: 'RUC que no corresponde al DNI',
  POSIBLE_MISMA_PERSONA: 'Posible persona en dos fichas'
};

export function etiquetaObservacion(codigo: string): string {
  return ETIQUETAS_OBSERVACION[codigo as CodigoObservacionDocumento] ?? 'Otra observación';
}

export function etiquetaTipoPersona(tipo: TipoPersona | null | undefined): string {
  return tipo === 'EMPRESA' ? 'Empresa' : 'Persona natural';
}
