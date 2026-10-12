/** Fuente: backend dto/InsumoRequest.java / InsumoResponse.java. */
export interface InsumoRequest {
  nombre: string;
  unidadMedida: string;
  /** Opcional: al crear, sin valor = 0; al editar, sin valor = se conserva el actual. */
  stock?: number;
}

export interface InsumoResponse {
  id: string;
  nombre: string;
  unidadMedida: string;
  activo: boolean;
  /** Stock disponible (V17). Desde V18 se descuenta al iniciar una producción (o al registrarla sin receta). */
  stock?: number;
}
