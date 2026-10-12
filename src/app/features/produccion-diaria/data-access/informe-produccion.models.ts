/** Fuente: backend dto/CrearInformeProduccionRequest.java, EditarInformeProduccionRequest.java,
 * InformeProduccionDiarioResponse.java, InsumoUsadoRequest.java / InsumoUsadoResponse.java. */

export interface InsumoUsadoRequest {
  insumoId: string;
  cantidad: number;
}

export interface InsumoUsadoResponse {
  insumoId: string;
  insumoNombre: string;
  unidadMedida: string;
  cantidad: number;
}

export interface CrearInformeProduccionRequest {
  uuidCliente: string;
  fecha: string;
  quesosDiarios: number;
  quesosReparados: number;
  quesosDeRecorte: number;
  recorteEnKilos: number | null;
  insumos: InsumoUsadoRequest[];
}

export interface EditarInformeProduccionRequest {
  quesosDiarios: number;
  quesosReparados: number;
  quesosDeRecorte: number;
  recorteEnKilos: number | null;
  insumos: InsumoUsadoRequest[];
}

export interface InformeProduccionDiario {
  id: string;
  uuidCliente: string;
  fecha: string;
  quesosDiarios: number;
  quesosReparados: number;
  quesosDeRecorte: number;
  totalQuesos: number;
  recorteEnKilos: number | null;
  responsableNombre: string;
  creadoEn: string;
  actualizadoPorNombre: string | null;
  actualizadoEn: string | null;
  insumos: InsumoUsadoResponse[];
}
