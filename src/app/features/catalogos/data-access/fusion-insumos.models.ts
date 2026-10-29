/** Fuente: backend dto/DuplicadosInsumoResponse.java, VistaPreviaFusionResponse.java, FusionInsumoResponse.java. */
export interface InsumoDuplicado {
  id: string;
  nombre: string;
  unidadMedida: string;
  activo: boolean;
  stock: number;
  movimientos: number;
}

/** Insumos cuyo nombre normalizado (sin mayúsculas, tildes ni espacios sobrantes) coincide. */
export interface GrupoDuplicados {
  clave: string;
  insumos: InsumoDuplicado[];
}

export interface DuplicadosInsumoResponse {
  /** true si la base de datos ya garantiza la unicidad (no quedan duplicados). */
  indiceUnicoActivo: boolean;
  grupos: GrupoDuplicados[];
}

export interface VistaPreviaFusion {
  origenId: string;
  origenNombre: string;
  destinoId: string;
  destinoNombre: string;
  unidadMedida: string;
  stockOrigen: number;
  stockDestino: number;
  stockResultante: number;
  movimientos: number;
  retiros: number;
  recetas: number;
  lotesProduccion: number;
  informes: number;
  impedimentos: string[];
  fusionable: boolean;
}

export interface FusionInsumoResponse {
  id: string;
  origenId: string;
  origenNombre: string;
  destinoId: string;
  destinoNombre: string;
  unidadMedida: string;
  stockOrigen: number;
  stockDestinoAntes: number;
  stockDestinoDespues: number;
  movimientos: number;
  retiros: number;
  recetas: number;
  lotesProduccion: number;
  informes: number;
  usuarioNombre: string;
  creadoEn: string;
}
