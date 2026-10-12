/**
 * Fuente: docs/CONTRATOS.md, JornadaBandejaResponse.java. GET /api/jornadas solo devuelve jornadas en
 * REGRESANDO_A_PLANTA (docs/ALCANCE.md, hallazgo 4): no es un histórico ni la lista de todas las activas.
 */
export interface JornadaBandeja {
  id: string;
  uuidCliente: string;
  estado: string;
  unidadId: string;
  unidadPlaca: string;
  acopiadorId: string;
  acopiadorNombre: string;
  horaInicio: string;
  horaFin: string | null;
  cantidadAcopios: number;
  cantidadProveedores: number;
  litrosEsperados: number;
}
