/** Fuente: backend dto/ProveedorCompraRequest.java / ProveedorCompraResponse.java (V42). */
export interface CategoriaProveedor {
  id: string;
  codigo: string;
  nombre: string;
}

export interface InsumoResumen {
  id: string;
  nombre: string;
  unidadMedida: string;
}

export interface ProveedorCompraResponse {
  id: string;
  nombre: string;
  ruc: string;
  telefono: string | null;
  contacto: string | null;
  activo: boolean;
  categorias: CategoriaProveedor[];
  insumosHabituales: InsumoResumen[];
}

/** Solo nombre y RUC son obligatorios (el alta rápida desde el ingreso envía solo eso). */
export interface ProveedorCompraRequest {
  nombre: string;
  ruc: string;
  telefono?: string | null;
  contacto?: string | null;
  /** Códigos de categoría (LECHE, OTROS_INSUMOS...). Sin valor al crear = «Otros insumos»; null al editar = no cambia. */
  categorias?: string[] | null;
  insumosHabituales?: string[] | null;
}
