import { HttpErrorResponse } from '@angular/common/http';

export type TipoError = 'red' | 'validacion' | 'no-encontrado' | 'conflicto' | 'servidor' | 'desconocido';

export interface ErrorAmigable {
  status: number;
  tipo: TipoError;
  mensaje: string;
  /** true si no se sabe si el servidor llegó a procesar la solicitud (sin conexión, 5xx o corte). */
  resultadoIncierto: boolean;
}

/** Convierte un error HTTP del backend (`{ mensaje }`) en un texto comprensible para el visitante. */
export function errorAmigable(error: unknown): ErrorAmigable {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: -1, tipo: 'desconocido', mensaje: 'Ocurrió un error inesperado. Inténtalo de nuevo.', resultadoIncierto: true };
  }
  const cuerpo = error.error as { mensaje?: unknown } | null;
  const delServidor = typeof cuerpo?.mensaje === 'string' && cuerpo.mensaje.trim() ? cuerpo.mensaje.trim() : null;
  if (error.status === 0) {
    return { status: 0, tipo: 'red', resultadoIncierto: true,
      mensaje: 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.' };
  }
  if (error.status === 401 || error.status === 403) {
    return { status: error.status, tipo: 'desconocido', resultadoIncierto: false,
      mensaje: 'El servidor no aceptó la solicitud (acceso denegado). Si el problema continúa, avísanos.' };
  }
  if (error.status === 404) {
    return { status: 404, tipo: 'no-encontrado', resultadoIncierto: false, mensaje: delServidor ?? 'No encontramos lo que buscabas.' };
  }
  if (error.status === 409) {
    return { status: 409, tipo: 'conflicto', resultadoIncierto: false,
      mensaje: delServidor ?? 'No pudimos registrar la solicitud por un conflicto con otra reserva.' };
  }
  if (error.status === 400 || error.status === 422) {
    return { status: error.status, tipo: 'validacion', resultadoIncierto: false, mensaje: delServidor ?? 'Revisa los datos ingresados.' };
  }
  if (error.status >= 500) {
    return { status: error.status, tipo: 'servidor', resultadoIncierto: true,
      mensaje: 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.' };
  }
  return { status: error.status, tipo: 'desconocido', resultadoIncierto: false, mensaje: delServidor ?? 'Ocurrió un error inesperado.' };
}
