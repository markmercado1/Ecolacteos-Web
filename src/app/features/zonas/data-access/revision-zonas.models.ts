/**
 * Fuente: RevisionZonasResponse.java (GET /api/admin/zonas/revision, solo ADMIN, solo lectura).
 * Casos de zona que el sistema no pudo decidir y que una persona debe revisar; el panel no corrige ninguno.
 */
export interface PeriodoParaRevisar {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  zonaNombre: string;
  desde: string;
  hasta: string | null;
  nota: string | null;
}

export interface EntregaSinZona {
  registroId: string;
  proveedorId: string;
  proveedorNombre: string;
  fechaHora: string;
  litros: number;
  /** DIA_DE_CAMBIO | SIN_PERIODO | OTRO */
  motivo: string;
}

export interface RevisionZonasResponse {
  periodos: PeriodoParaRevisar[];
  /** Total real de entregas sin zona; `entregasSinZona` trae como máximo `limiteEntregas`. */
  totalEntregasSinZona: number;
  limiteEntregas: number;
  entregasSinZona: EntregaSinZona[];
}

/** Texto para el motivo con el que el servidor clasificó una entrega sin zona. */
export function etiquetaMotivoSinZona(motivo: string): string {
  switch (motivo) {
    case 'DIA_DE_CAMBIO':
      return 'Día de cambio de zona: no se registró la hora del cambio';
    case 'SIN_PERIODO':
      return 'Ningún periodo de zona cubre esta fecha';
    case 'OTRO':
      return 'Otro motivo';
    default:
      return motivo;
  }
}
