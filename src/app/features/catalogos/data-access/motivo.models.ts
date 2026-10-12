/**
 * Fuente: docs/CONTRATOS.md, MotivoObservacionRequest.java / MotivoObservacionResponse.java.
 * La respuesta NO trae un campo "activo": GET solo lista los motivos activos
 * (docs/ALCANCE.md, hallazgo 13), así que uno desactivado desaparece del
 * listado y no hay forma de recuperar su id desde la UI para reactivarlo.
 */
export interface MotivoObservacionRequest {
  descripcion: string;
}

export interface MotivoObservacionResponse {
  id: string;
  descripcion: string;
}
