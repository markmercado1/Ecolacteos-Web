/**
 * Fuente: docs/CONTRATOS.md, RecepcionPlantaResponse.java. `estado` (OK/ALERTA) lo calcula el backend por
 * un umbral configurable; si litrosCampo=0 con litrosPlanta>0 se fuerza ALERTA aunque diferenciaPct sea 0.
 */
export interface RecepcionPlanta {
  id: string;
  fecha: string;
  turno: string;
  unidadId: string;
  litrosCampo: number;
  litrosPlanta: number;
  diferenciaPct: number;
  estado: string;
  litrosRegistradosAcopio: number;
  registroAcopioIds: string[];
  jornadaId: string | null;
  horaLlegada: string | null;
  diferenciaLitros: number;
  observacion: string | null;
}
