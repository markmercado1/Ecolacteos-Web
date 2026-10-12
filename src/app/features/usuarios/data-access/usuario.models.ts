import { RolNombre } from '../../../shared/models/rol';

/** Fuente: docs/CONTRATOS.md, UsuarioRequest.java. Alta: password obligatorio. */
export interface UsuarioRequest {
  nombre: string;
  email: string;
  password: string;
  rolNombre: RolNombre;
}

/**
 * Fuente: docs/CONTRATOS.md, UsuarioUpdateRequest.java. `nuevaPassword` es
 * opcional (min 8 si se envía); se omite del cuerpo cuando no se cambia.
 */
export interface UsuarioUpdateRequest {
  nombre: string;
  email: string;
  rolNombre: RolNombre;
  nuevaPassword?: string;
}

/** Fuente: docs/CONTRATOS.md, UsuarioResponse.java. */
export interface UsuarioResponse {
  id: string;
  nombre: string;
  email: string;
  rolNombre: RolNombre;
  activo: boolean;
}

/** Fuente: docs/CONTRATOS.md, RolResponse.java. */
export interface RolResponse {
  id: string;
  nombre: RolNombre;
}
