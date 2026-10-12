import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Precisión de la columna litros_usados: NUMERIC(9,2). */
export function litrosProduccionValidator(control: AbstractControl): ValidationErrors | null {
  const valor = control.value;
  if (valor === null || valor === '') return null;
  if (!Number.isFinite(valor) || valor <= 0 || valor > 9999999.99) return { litrosInvalidos: true };
  return Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6 ? null : { precisionLitros: true };
}
