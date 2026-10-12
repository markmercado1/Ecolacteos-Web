import { HttpErrorResponse } from '@angular/common/http';
import { mapHttpError } from './app-error';

describe('mapHttpError', () => {
  it('usa el mensaje real del ErrorResponse del backend cuando existe', () => {
    const error = new HttpErrorResponse({
      status: 404,
      error: { timestamp: '2026-09-16T00:00:00Z', status: 404, error: 'Not Found', mensaje: 'Proveedor no encontrado: 123' }
    });
    const resultado = mapHttpError(error);
    expect(resultado.tipo).toBe('no-encontrado');
    expect(resultado.mensaje).toBe('Proveedor no encontrado: 123');
  });

  it('clasifica un error de red (status 0) sin mensaje del servidor', () => {
    const error = new HttpErrorResponse({ status: 0 });
    const resultado = mapHttpError(error);
    expect(resultado.tipo).toBe('red');
    expect(resultado.mensaje).toContain('conectar');
  });

  it('clasifica un 403 como falta de permiso', () => {
    const error = new HttpErrorResponse({ status: 403 });
    expect(mapHttpError(error).tipo).toBe('permiso');
  });

  it('no confunde un error que no es HttpErrorResponse', () => {
    expect(mapHttpError(new Error('otra cosa')).tipo).toBe('desconocido');
  });
});
