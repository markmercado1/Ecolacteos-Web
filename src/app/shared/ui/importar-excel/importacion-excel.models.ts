/** Fuente: backend `importacion/*Response.java` (ImportacionController, /api/admin/importaciones). */

/** Tipos de dato maestro que se pueden importar. Nunca movimientos operativos (acopios, pagos, ventas...). */
export type TipoImportacion = 'proveedores' | 'insumos' | 'clientes' | 'ingresos-insumo' | 'saldos-iniciales';

export type EstadoFilaImportacion = 'VALIDA' | 'INVALIDA' | 'DUPLICADA' | 'OMITIDA' | 'CREADA';

export interface ColumnaImportacion {
  clave: string;
  encabezado: string;
}

export interface FilaImportacion {
  /** Número de fila tal como se ve en Excel (la 1 es el encabezado). */
  fila: number;
  estado: EstadoFilaImportacion;
  valores: Record<string, string>;
  mensajes: string[];
}

/** Lo que el servidor entendió del archivo, ANTES de guardar nada. `omitidas` son las filas en blanco. */
export interface VistaPreviaImportacion {
  id: string;
  tipo: string;
  titulo: string;
  version: number;
  nombreArchivo: string;
  totalFilas: number;
  validas: number;
  invalidas: number;
  duplicadas: number;
  omitidas: number;
  expiraEn: string;
  puedeConfirmar: boolean;
  /** true = con filas con error, confirmar exige elegir «importar solo las válidas» (los ingresos no se importan a medias por defecto). */
  exigeConfirmarParcial?: boolean;
  columnas: ColumnaImportacion[];
  filas: FilaImportacion[];
}

export interface ResultadoImportacion {
  id: string;
  tipo: string;
  titulo: string;
  creadas: number;
  invalidas: number;
  duplicadas: number;
  omitidas: number;
  /** true cuando la petición repite una confirmación anterior: no se creó nada nuevo. */
  yaConfirmada: boolean;
  confirmadoEn: string;
  columnas: ColumnaImportacion[];
  filasNoCreadas: FilaImportacion[];
}

export const ETIQUETA_ESTADO_FILA: Record<EstadoFilaImportacion, string> = {
  VALIDA: 'Válida',
  INVALIDA: 'Inválida',
  DUPLICADA: 'Duplicada',
  OMITIDA: 'Omitida',
  CREADA: 'Creada'
};
