import { RolNombre } from '../../shared/models/rol';

/** Fuente: docs/CONTRATOS.md, LoginRequest.java. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Fuente: docs/CONTRATOS.md, LoginResponse.java. */
export interface LoginResponse {
  token: string;
  rol: string;
  nombre: string;
  expiraEnSegundos: number;
  refreshToken: string;
  refreshExpiraEnSegundos: number;
}

/** Fuente: docs/CONTRATOS.md, RefreshTokenRequest.java. */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** Fuente: docs/CONTRATOS.md, UsuarioMeResponse.java. */
export interface UsuarioMeResponse {
  id: string;
  nombre: string;
  email: string;
  rolNombre: RolNombre;
  activo: boolean;
  unidadesResponsable: string[];
}

/** Fuente: docs/CONTRATOS.md, CambiarPasswordRequest.java. */
export interface CambiarPasswordRequest {
  passwordActual: string;
  passwordNueva: string;
}

/** Sesión activa en memoria: tokens del login y datos confirmados por /auth/me. */
export interface Sesion {
  token: string;
  refreshToken: string;
  expiraEn: number;
  refreshExpiraEn: number;
  usuario: UsuarioMeResponse;
}
