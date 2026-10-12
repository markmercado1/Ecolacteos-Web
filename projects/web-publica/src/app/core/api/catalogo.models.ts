/** Fuente: CatalogoPublicoResponse.java (GET /api/catalogo/productos, público). */
export type Disponibilidad = 'DISPONIBLE' | 'POCAS_UNIDADES' | 'AGOTADO';

export interface PresentacionCatalogo {
  id: string;
  nombre: string;
  contenidoCantidad: number | null;
  contenidoUnidad: string | null;
  unidadConteo: string;
  /** Ruta relativa del backend o null; resolver con `urlFoto()`. */
  fotoUrl: string | null;
  /** null = «Precio a confirmar». */
  precio: number | null;
  precioAConfirmar: boolean;
  disponibilidad: Disponibilidad;
  /** Unidades que se pueden reservar, solo cuando quedan pocas (POCAS_UNIDADES); null en otro caso (no se publica la cantidad). */
  unidadesDisponibles: number | null;
}

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  familia: string;
  fotoUrl: string | null;
  presentaciones: PresentacionCatalogo[];
}

export interface CatalogoResponse {
  productos: ProductoCatalogo[];
}
