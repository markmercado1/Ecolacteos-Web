import { AbstractControl } from '@angular/forms';

/**
 * Mensaje claro del primer error de un control, o `null` si es válido. `etiqueta` es el nombre que el usuario ve en el
 * campo; `propios` permite reemplazar el texto de un error concreto (p. ej. `{ min: 'El monto debe ser mayor que cero.' }`).
 * No decide cuándo mostrarlo: quien lo usa lo pide solo si el campo fue tocado o si ya se intentó guardar.
 */
export function mensajeError(
  control: AbstractControl | null | undefined,
  etiqueta: string,
  propios: Partial<Record<string, string>> = {}
): string | null {
  const errores = control?.errors;
  if (!errores) return null;
  for (const clave of Object.keys(errores)) {
    const propio = propios[clave];
    if (propio) return propio;
  }
  if (errores['required']) return `Completa «${etiqueta}».`;
  if (errores['email']) return 'Escribe un correo válido, por ejemplo nombre@empresa.pe.';
  if (errores['minlength']) return `«${etiqueta}» debe tener al menos ${errores['minlength'].requiredLength} caracteres.`;
  if (errores['maxlength']) return `«${etiqueta}» admite como máximo ${errores['maxlength'].requiredLength} caracteres.`;
  if (errores['min']) return `«${etiqueta}» debe ser ${errores['min'].min} o más.`;
  if (errores['max']) return `«${etiqueta}» no puede superar ${errores['max'].max}.`;
  if (errores['pattern']) return `«${etiqueta}» no tiene el formato correcto.`;
  return `Revisa «${etiqueta}».`;
}

/** Etiquetas de los campos inválidos de un formulario, en el orden en que se declaran en `etiquetas` (clave del control → nombre visible). */
export function pendientesDe(form: AbstractControl, etiquetas: Record<string, string>): string[] {
  return Object.keys(etiquetas).filter((clave) => form.get(clave)?.invalid).map((clave) => etiquetas[clave]);
}

/**
 * Frase general para mostrar al intentar guardar un formulario inválido: nombra los campos pendientes y remite a los
 * mensajes junto a cada uno (no los repite). Devuelve `null` si no hay ninguno.
 */
export function resumenPendientes(etiquetas: string[]): string | null {
  if (etiquetas.length === 0) return null;
  return etiquetas.length === 1
    ? `Falta corregir un campo: ${etiquetas[0]}.`
    : `Faltan por corregir ${etiquetas.length} campos: ${etiquetas.join(', ')}.`;
}
