import { FormControl, FormGroup, Validators } from '@angular/forms';
import { mensajeError, pendientesDe, resumenPendientes } from './validacion';

describe('mensajeError', () => {
  it('un control válido no tiene mensaje', () => {
    expect(mensajeError(new FormControl('hola', Validators.required), 'Nombre')).toBeNull();
    expect(mensajeError(null, 'Nombre')).toBeNull();
  });

  it('un campo obligatorio vacío pide completarlo por su nombre', () => {
    expect(mensajeError(new FormControl('', Validators.required), 'Nombre completo')).toBe('Completa «Nombre completo».');
  });

  it('explica el correo, la longitud y los límites numéricos', () => {
    expect(mensajeError(new FormControl('x', Validators.email), 'Correo')).toContain('correo válido');
    expect(mensajeError(new FormControl('abc', Validators.minLength(8)), 'Contraseña')).toBe('«Contraseña» debe tener al menos 8 caracteres.');
    expect(mensajeError(new FormControl('abcdef', Validators.maxLength(3)), 'Código')).toBe('«Código» admite como máximo 3 caracteres.');
    expect(mensajeError(new FormControl(0, Validators.min(1)), 'Cantidad')).toBe('«Cantidad» debe ser 1 o más.');
    expect(mensajeError(new FormControl(9, Validators.max(5)), 'Cantidad')).toBe('«Cantidad» no puede superar 5.');
    expect(mensajeError(new FormControl('a', Validators.pattern(/^\d+$/)), 'DNI')).toBe('«DNI» no tiene el formato correcto.');
  });

  it('un mensaje propio reemplaza al genérico solo para ese error', () => {
    const monto = new FormControl(0, [Validators.required, Validators.min(0.01)]);
    expect(mensajeError(monto, 'Monto', { min: 'El monto debe ser mayor que cero.' })).toBe('El monto debe ser mayor que cero.');
    const vacio = new FormControl(null, [Validators.required, Validators.min(0.01)]);
    expect(mensajeError(vacio, 'Monto', { min: 'El monto debe ser mayor que cero.' })).toBe('Completa «Monto».');
  });

  it('un error desconocido igualmente remite al campo', () => {
    const control = new FormControl('x', () => ({ raro: true }));
    expect(mensajeError(control, 'Placa')).toBe('Revisa «Placa».');
  });
});

describe('pendientesDe', () => {
  it('lista, en el orden dado, solo los campos inválidos', () => {
    const form = new FormGroup({
      nombre: new FormControl('', Validators.required),
      email: new FormControl('ana@x.pe', Validators.email),
      clave: new FormControl('1', Validators.minLength(8))
    });
    const etiquetas = { nombre: 'Nombre', email: 'Correo', clave: 'Contraseña' };
    expect(pendientesDe(form, etiquetas)).toEqual(['Nombre', 'Contraseña']);
    form.patchValue({ nombre: 'Ana', clave: '12345678' });
    expect(pendientesDe(form, etiquetas)).toEqual([]);
  });
});

describe('resumenPendientes', () => {
  it('sin campos pendientes no hay resumen', () => {
    expect(resumenPendientes([])).toBeNull();
  });

  it('nombra el campo pendiente, en singular y en plural', () => {
    expect(resumenPendientes(['Monto'])).toBe('Falta corregir un campo: Monto.');
    expect(resumenPendientes(['Proveedor', 'Monto'])).toBe('Faltan por corregir 2 campos: Proveedor, Monto.');
  });
});
