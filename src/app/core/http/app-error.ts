import { HttpErrorResponse } from '@angular/common/http';
import { ErrorResponse } from '../../shared/models/error-response';

export type TipoError = 'validacion' | 'permiso' | 'no-encontrado' | 'red' | 'servidor' | 'desconocido';

export interface AppError {
  status: number;
  mensaje: string;
  tipo: TipoError;
}

function tipoPorEstado(status: number): TipoError {
  if (status === 0) return 'red';
  if (status === 400 || status === 422) return 'validacion';
  if (status === 403) return 'permiso';
  if (status === 404) return 'no-encontrado';
  if (status >= 500) return 'servidor';
  return 'desconocido';
}

function mensajePorDefecto(tipo: TipoError): string {
  switch (tipo) {
    case 'red':
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    case 'permiso':
      return 'No tienes permiso para realizar esta acción.';
    case 'no-encontrado':
      return 'No se encontró el recurso solicitado.';
    case 'servidor':
      return 'El servidor tuvo un error inesperado. Intenta de nuevo.';
    case 'validacion':
      return 'Revisa los datos ingresados.';
    default:
      return 'Ocurrió un error inesperado.';
  }
}

/** Traduce un HttpErrorResponse a un mensaje mostrable, usando ErrorResponse.mensaje cuando existe. */
export function mapHttpError(error: unknown): AppError {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: -1, tipo: 'desconocido', mensaje: mensajePorDefecto('desconocido') };
  }
  const tipo = tipoPorEstado(error.status);
  const cuerpo = error.error as Partial<ErrorResponse> | undefined;
  const mensaje = typeof cuerpo?.mensaje === 'string' && cuerpo.mensaje.trim().length > 0
    ? cuerpo.mensaje
    : mensajePorDefecto(tipo);
  return { status: error.status, tipo, mensaje };
}
